// content.js — scrape DoorDash list pages; return: name, displayName, etaMinutes, deliveryFee, rating, ratingCount, href

(() => {
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 100 && r.height > 60 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  // Minutes must include 'min' / 'mins' / 'minute(s)' — never match 'mi'
// Strict minutes: require 'min/mins/minute(s)'
const MINUTES_RE = /(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*(?:min(?:ute)?s?)\b/i;
const parseMinutes = (txt) => {
  if (!txt) return null;
  const m = String(txt).match(MINUTES_RE);
  return m ? Number(m[1]) : null;
};

// Strict currency (requires $ or CA$ etc.)
const CURRENCY_RE = /(?:[A-Z]{1,3}\s*\$|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)/;

// Delivery-fee specific extractor: looks for "delivery ... $X" or "free"
const extractDeliveryFeeFromText = (txt) => {
  if (!txt) return null;
  const s = String(txt).replace(/\u00A0/g, ' ').toLowerCase();

  // any "free" near 'delivery'
  if (/delivery[^|]*\bfree\b/.test(s)) return 0;

  // first currency amount after the word "delivery"
  const after = s.match(/delivery[^$]*?(?:[a-z]{0,3}\s*\$|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (after) return Number(after[1]);

  // fallback: any currency amount in the same phrase containing 'delivery'
  const inPhrase = s.match(/(?:[a-z]{0,3}\s*\$|\$)\s*([0-9]+(?:\.[0-9]{1,2})?).*delivery|delivery.*(?:[a-z]{0,3}\s*\$|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (inPhrase) return Number(inPhrase[1] || inPhrase[2]);

  return null;
};



  const parseRating = (txt) => {
    if (!txt) return null;
    const m = String(txt).match(/(\d\.\d)/);
    return m ? Number(m[1]) : null;
  };
  const parseRatingCount = (txt) => {
    if (!txt) return null;
    // "(200+)" or "(1,200+)" or "200+"
    const s = String(txt);
    const m = s.match(/\(\s*([\d,]+(?:\+)?)/) || s.match(/\b([\d,]+(?:\+))\b/);
    return m ? m[1] : null;
  };

  const waitForListings = (timeout = 5000) =>
    new Promise((resolve) => {
      const grab = () => {
        const nodes = findCandidateCards();
        if (nodes.length) return resolve(nodes);
      };
      grab();
      const obs = new MutationObserver(grab);
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(findCandidateCards()); }, timeout);
    });

  function findCandidateCards() {
    const selectors = [
      'a[href*="/store/"]',
      'a[data-anchor-id*="StoreCard"]',
      'a[data-testid*="store-card"]',
      '[role="link"][data-testid*="store"]',
      '[role="link"][aria-label*="store"]',
      'article a[href*="/store/"]',
      'section a[href*="/store/"]'
    ];
    const nodes = new Set();
    selectors.forEach(sel => $$(document, sel).forEach(n => nodes.add(n)));
    if (!nodes.size) {
      $$('h3, h2').forEach(h => {
        const card = h.closest('a, [role="link"], article, section, div');
        if (card && isVisible(card)) nodes.add(card);
      });
    }
    return Array.from(nodes).filter(isVisible);
  }

  const cleanNameText = (raw) => {
    if (!raw) return '';
    let t = raw.replace(/\s+/g, ' ').trim();
    // cut at rating or meta delimiters
    t = t.replace(/\s*\d\.\d.*$/,'');        // drop "4.2 ...", etc.
    t = t.replace(/\s*·.*$/,'');             // drop after dot separators
    t = t.replace(/\s*\(.*\)$/,'');          // trailing "(200+)"
    t = t.replace(/\s*CA?\$\s*\d.+$/i,'');   // trailing price/fee
    t = t.replace(/\s*\d+\s*m(in)?$/i,'');   // trailing minutes
    return t.trim();
  };

  function extractName(card) {
    const heading = card.querySelector('h3, h2, [data-test="store-name"], [data-testid*="store-name"]');
    if (heading && heading.textContent.trim()) return { name: heading.textContent.trim(), displayName: heading.textContent.trim() };

    let aria = card.getAttribute('aria-label');
    if (aria) {
      const displayName = cleanNameText(aria);
      return { name: displayName, displayName };
    }

    // fallback: first line of text block
    const pool = (card.textContent || '').trim();
    const candidate = cleanNameText(pool.split('\n')[0] || pool);
    return { name: candidate, displayName: candidate };
  }

  function extractFromCard(card) {
    const { name, displayName } = extractName(card);
    if (!displayName) return null;

    // href
    let href = card.href || card.getAttribute?.('href') || null;
    if (!href) {
      const a = card.querySelector('a[href*="/store/"]');
      if (a) href = a.href;
    }

    const pool = (card.textContent || '').replace(/\s+/g, ' ');

    // ETA
   
const etaNode =
  card.querySelector('[data-testid*="delivery-time"], [data-test*="delivery-time"], [aria-label*="min"]') ||
  Array.from(card.querySelectorAll('span,div')).find(x => MINUTES_RE.test(x.textContent));
const etaMinutes = parseMinutes(etaNode?.textContent || '');



    // Delivery fee
   

    // Rating + rating count
    const rating = parseRating(pool);
    const ratingCount = parseRatingCount(pool);

    return { name, displayName, etaMinutes, deliveryFee, rating, ratingCount, href };
  }

  async function scan({ debug = false } = {}) {
    const cards = await waitForListings(5000);
    if (debug) console.log('[DDF] candidate nodes:', cards.length);

    let rows = cards.map(extractFromCard).filter(Boolean);

    // dedupe
    const seenHref = new Set(); const seenName = new Set();
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
