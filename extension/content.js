// content.js — resilient scraper for DoorDash listing/search pages

(() => {
  // ---------- helpers ----------
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 100 && r.height > 60 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };

  // Accept $ or CA$ (or other 2–3 letter codes) and "Free"
  const parseMoney = (txt) => {
    if (!txt) return null;
    const s = String(txt).replace(/\u00A0/g, ' ').trim();
    if (/free/i.test(s)) return 0;
    // matches "$9.99", "CA$ 9.99", "CA$9.99"
    const m = s.match(/(?:[A-Z]{1,3}\s*\$|\$)?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? Number(m[1]) : null;
  };

  const parseMinutes = (txt) => {
    if (!txt) return null;
    const m = String(txt).match(/(\d{1,3})(?:\s*[–-]\s*\d{1,3})?\s*m/i);
    return m ? Number(m[1]) : null; // use lower bound
  };

  const parseRating = (txt) => {
    if (!txt) return null;
    const m = String(txt).match(/(\d\.\d)/);
    return m ? Number(m[1]) : null;
  };

  // --------- wait for UI to render ----------
  const waitForListings = (timeout = 4500) =>
    new Promise((resolve) => {
      const tryNow = () => {
        const nodes = findCandidateCards();
        if (nodes.length) return resolve(nodes);
      };
      tryNow();
      const obs = new MutationObserver(tryNow);
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve(findCandidateCards()); // may be empty
      }, timeout);
    });

  // --------- find card containers (anchor or role=link) ----------
  function findCandidateCards() {
    const selectors = [
      // Direct anchors
      'a[href*="/store/"]',
      'a[data-anchor-id*="StoreCard"]',
      'a[data-testid*="store-card"]',
      // DoorDash often uses <div role="link"> for cards
      '[role="link"][data-testid*="store"]',
      '[role="link"][aria-label*="store"]',
      // Generic card groupings with a link inside
      'article a[href*="/store/"]',
      'section a[href*="/store/"]'
    ];

    // Collect both anchors and role="link" blocks
    const nodes = new Set();
    selectors.forEach(sel => $$(document, sel).forEach(n => nodes.add(n)));

    // If we still didn't get anything, heuristically use headings on grid cards
    if (!nodes.size) {
      $$(
        document,
        'h3, h2'
      ).forEach(h => {
        const card = h.closest('a, [role="link"], article, section, div');
        if (card && isVisible(card)) nodes.add(card);
      });
    }

    return Array.from(nodes).filter(isVisible);
  }

  // --------- extract fields from a card ----------
  function extractFromCard(card) {
    // Name
    const nameEl =
      card.querySelector('h3, h2, [data-test="store-name"], [data-testid*="store-name"]') ||
      card;
    let name = (nameEl.textContent || '').trim();
    // Sometimes anchor/role node has aria-label with name
    if (!name && card.getAttribute('aria-label')) name = card.getAttribute('aria-label').trim();
    if (!name || name.length < 2) return null;

    // Image
    const imgEl = card.querySelector('img') || card.querySelector('picture img');
    const img = imgEl ? (imgEl.currentSrc || imgEl.src || null) : null;

    // Href (for role="link", look for inner anchor)
    let href = card.href || card.getAttribute?.('href') || null;
    if (!href) {
      const a = card.querySelector('a[href*="/store/"]');
      if (a) href = a.href;
    }

    // Build a small text pool from children to search for meta chips
    const pool = (card.textContent || '').replace(/\s+/g, ' ');

    // ETA like "18–30 min" or "32 min"
    const etaNode =
      card.querySelector('[data-testid*="delivery-time"], [data-test*="delivery-time"], [aria-label*="min"]') ||
      Array.from(card.querySelectorAll('span,div')).find(x => /\d+\s*(?:–|-)?\s*\d*\s*m/i.test(x.textContent));
    const etaMinutes = parseMinutes(etaNode?.textContent || pool);

    // Delivery fee: prefer text near "delivery"
    let feeNode =
      card.querySelector('[data-testid*="delivery-fee"], [data-test*="delivery-fee"], [aria-label*="delivery"]') ||
      Array.from(card.querySelectorAll('span,div')).find(x => /delivery\s*fee|delivery/i.test(x.textContent) && /(?:\$|[A-Z]{1,3}\s*\$)\s*\d/.test(x.textContent));
    let deliveryFee = parseMoney(feeNode?.textContent || '');
    if (deliveryFee === null) {
      // Some cards say "CA$0 delivery fee over CA$15" -> parse first money in that phrase
      const feePhrase = Array.from(card.querySelectorAll('span,div')).map(n => n.textContent).find(t => /delivery/i.test(t));
      if (feePhrase) deliveryFee = parseMoney(feePhrase);
    }

    // Price (many listing cards won't have one; leave null)
    const priceNode =
      card.querySelector('[data-test*="price"], [data-testid*="price"], [aria-label*="price"]') ||
      Array.from(card.querySelectorAll('span,div')).find(x => /\b(?:From|Starting at)\b.*\$/i.test(x.textContent)) ||
      Array.from(card.querySelectorAll('span,div')).find(x => /^\s*(?:CA\$|\$)\s*\d/.test(x.textContent));
    const price = parseMoney(priceNode?.textContent || '');

    // Rating
    const ratingNode =
      card.querySelector('[data-test*="rating"], [data-testid*="rating"], [aria-label*="rating"]') ||
      Array.from(card.querySelectorAll('span,div')).find(x => /\d\.\d/.test(x.textContent) && /★|⭐|rating/i.test((x.closest('*')?.textContent || '')));
    const rating = parseRating(ratingNode?.textContent || pool);

    return { name, price, etaMinutes, deliveryFee, rating, img, href };
  }

  async function scan({ debug = false } = {}) {
    const cards = await waitForListings(5000);
    if (debug) console.log('[DDF] candidate nodes:', cards.length);

    let rows = cards
      .map(extractFromCard)
      .filter(Boolean);

    // Deduplicate: href first, then name
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

  // ---------- message bridge ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'DD_PING') { sendResponse({ ok: true }); return true; }
    if (msg?.type === 'DD_SCAN') {
      (async () => {
        try {
          const rows = await scan({ debug: !!msg.debug });
          sendResponse({ ok: true, rows });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message || e) });
        }
      })();
      return true;
    }
  });
})();
