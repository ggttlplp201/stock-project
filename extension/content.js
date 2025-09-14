// content.js — resilient DoorDash listing scraper

(() => {
  // ====== Utilities ======
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

  // Shallow shadow search: scan all custom elements that expose a shadowRoot and query inside
  const queryAllDeepShallow = (selectorList) => {
    const selectors = Array.isArray(selectorList) ? selectorList : [selectorList];
    const found = new Set();
    const results = [];

    const push = (el) => {
      if (!el) return;
      if (found.has(el)) return;
      found.add(el);
      results.push(el);
    };

    // normal DOM
    selectors.forEach(sel => $$(document, sel).forEach(push));

    // shallow shadow DOM sweep (do not recurse deeply to avoid perf spikes)
    const withShadow = $$(
      document,
      '*'
    ).filter(el => el.shadowRoot && el.shadowRoot instanceof ShadowRoot);

    withShadow.forEach(host => {
      selectors.forEach(sel => $$(host.shadowRoot, sel).forEach(push));
    });

    return results;
  };

  const parseMoney = (text) => {
    if (!text) return null;
    const m = String(text).replace(/\u00A0/g, ' ').match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? Number(m[1]) : null;
  };

  const parseMinutes = (text) => {
    if (!text) return null;
    const m = String(text).match(/(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*m/i);
    return m ? Number(m[1]) : null; // lower bound
  };

  const parseRating = (text) => {
    if (!text) return null;
    const m = String(text).match(/(\d\.\d)/);
    return m ? Number(m[1]) : null;
  };

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 80 && r.height > 40 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  // ====== Robust waiter ======
  const waitForCards = (timeoutMs = 4000) =>
    new Promise((resolve) => {
      const tryGet = () => {
        const nodes = findCardNodes();
        if (nodes.length) return resolve(nodes);
      };

      // first quick check
      tryGet();

      const obs = new MutationObserver(() => tryGet());
      obs.observe(document.documentElement, { childList: true, subtree: true });

      const t = setTimeout(() => {
        obs.disconnect();
        resolve(findCardNodes()); // may be empty
      }, timeoutMs);
    });

  // ====== Core: find card containers/anchors on listing page ======
  function findCardNodes() {
    // DoorDash frequently changes test ids—cover many variants
    const selectors = [
      // typical anchor around a card
      'a[data-anchor-id*="StoreCard"]',
      'a[data-testid*="store-card"]',
      'a[href*="/store/"]',
      'a[href*="/business/"]',
      // block that contains name and info (fallback)
      '[data-test="storeCard"] a',
      '[data-testid="StoreCard"] a',
      // very generic fallback: article/section cards with a link inside
      'article a[href*="/store/"]',
      'section a[href*="/store/"]'
    ];

    // Collect candidate anchors and filter to visible
    const anchors = queryAllDeepShallow(selectors).filter(isVisible);

    // Deduplicate by href
    const seen = new Set();
    const unique = anchors.filter(a => {
      const href = a.href || a.getAttribute('href') || '';
      if (!href) return false;
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    });

    return unique;
  }

  // Extract info from a single card anchor/container
  function extractFromCard(anchor) {
    const container = anchor;

    // NAME
    const nameEl =
      container.querySelector('h3, h2, [data-test="store-name"], [data-testid*="store-name"], [data-telemetry-id*="StoreCardName"]') ||
      container.querySelector('div[aria-label], span[aria-label]'); // fallback
    let name = nameEl?.textContent?.trim() || '';

    // Some cards put the name in an aria-label on the anchor
    if (!name && anchor.getAttribute('aria-label')) {
      name = anchor.getAttribute('aria-label').trim();
    }
    if (!name) return null; // not a valid card

    // IMAGE
    const imgEl = container.querySelector('img') || container.querySelector('picture img');
    const img = imgEl ? (imgEl.currentSrc || imgEl.src || null) : null;

    // TEXT POOL for heuristic matches
    const textPool = [container.textContent || ''].join(' ').replace(/\s+/g, ' ');

    // PRICE (look for "From $x.xx" or any $x.xx near the top row)
    let priceNode =
      container.querySelector('[data-test*="price"], [data-testid*="price"], [aria-label*="$"], [aria-label*="price"]') ||
      Array.from(container.querySelectorAll('span,div')).find(x => /\$\s*\d/.test(x.textContent));
    const price = parseMoney(priceNode?.textContent || '');

    // ETA
    let etaNode =
      container.querySelector('[data-test*="delivery-time"], [data-testid*="delivery-time"], [aria-label*="min"]') ||
      Array.from(container.querySelectorAll('span,div')).find(x => /\d+\s*(?:–|-)?\s*\d*\s*m/i.test(x.textContent));
    const etaMinutes = parseMinutes(etaNode?.textContent || '');

    // DELIVERY FEE
    let feeNode =
      container.querySelector('[data-test*="delivery-fee"], [data-testid*="delivery-fee"], [aria-label*="delivery"]') ||
      Array.from(container.querySelectorAll('span,div')).find(x => /\$\s*\d+(?:\.\d{2})?\s*(?:delivery|fee)/i.test(x.textContent));
    let deliveryFee = parseMoney(feeNode?.textContent || '');
    if (deliveryFee === null) {
      const near = Array.from(container.querySelectorAll('span,div'))
        .find(x => /delivery/i.test(x.textContent) && /\$\s*\d/.test(x.textContent));
      deliveryFee = parseMoney(near?.textContent || '');
    }

    // RATING
    let ratingNode =
      container.querySelector('[data-test*="rating"], [data-testid*="rating"], [aria-label*="rating"]') ||
      Array.from(container.querySelectorAll('span,div')).find(x => /\d\.\d/.test(x.textContent) && /⭐|star|rating/i.test((x.closest('*')?.textContent || '')));
    const rating =
      parseRating(ratingNode?.textContent || '') ||
      parseRating(textPool);

    // HREF
    const href = anchor.href || anchor.getAttribute('href') || null;

    return { name, price, etaMinutes, deliveryFee, rating, img, href };
  }

  // Optional: parse Next.js data as a last resort (DoorDash uses Next)
  function tryParseNextData() {
    try {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script?.textContent) return [];
      const json = JSON.parse(script.textContent);

      // Heuristic deep search for objects that look like stores
      const stores = [];
      const walk = (v) => {
        if (!v) return;
        if (Array.isArray(v)) return v.forEach(walk);
        if (typeof v === 'object') {
          const keys = Object.keys(v);
          const hasName = keys.includes('name') || keys.includes('storeName') || keys.includes('title');
          const hasUrl = keys.includes('url') || keys.includes('href') || keys.includes('slug');
          const looksStore = hasName && (keys.some(k => /rating|price|fee|delivery|eta/i.test(k)));
          if (looksStore) {
            const name = v.name || v.storeName || v.title;
            const href = v.url || v.href || (v.slug ? `/store/${v.slug}` : null);
            const rating = v.rating || v.starRating || null;
            const price = v.price ? Number(v.price) : null;
            const etaMinutes = v.etaMinutes || (typeof v.eta === 'string' ? parseMinutes(v.eta) : null);
            const deliveryFee = v.deliveryFee ? Number(v.deliveryFee) : (typeof v.fee === 'string' ? parseMoney(v.fee) : null);
            const img = v.imageUrl || v.img || null;
            if (name) stores.push({ name, price, etaMinutes, deliveryFee, rating, img, href });
          }
          for (const k in v) walk(v[k]);
        }
      };
      walk(json);
      // Deduplicate on name+href
      const seen = new Set();
      return stores.filter(s => {
        const key = `${s.name}|${s.href || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return [];
    }
  }

  async function scanListing({ debug = false } = {}) {
    const anchors = await waitForCards(4500);

    if (debug) console.log('[DDF] anchors found:', anchors.length);

    let rows = anchors
      .map(extractFromCard)
      .filter(Boolean)
      .filter(r => !!r.name && isFinite((r.price ?? 0)) || !!r.href); // keep if name present; price may be null

    // Fallback to Next.js data if DOM yielded nothing
    if (!rows.length) {
      const nextRows = tryParseNextData();
      if (debug) console.log('[DDF] __NEXT_DATA__ rows:', nextRows.length);
      rows = nextRows;
    }

    // Final polish: visible only, dedupe by href then name
    const seenHref = new Set();
    const seenName = new Set();
    rows = rows.filter(r => {
      if (r.href && seenHref.has(r.href)) return false;
      if (r.href) seenHref.add(r.href);
      if (seenName.has(r.name)) return false;
      seenName.add(r.name);
      return true;
    });

    if (debug) console.table(rows);
    return rows;
  }

  // Message bridge
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'DD_SCAN') {
      (async () => {
        try {
          const rows = await scanListing({ debug: !!msg.debug });
          sendResponse({ ok: true, rows });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message || e) });
        }
      })();
      return true; // keep channel open
    }
  });
})();
