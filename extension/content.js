// content.js — Scrape the DoorDash DOM defensively and return normalized data.

(() => {
  // Utility: parse dollars from "$12.99" or "From $9.49"
  const parseMoney = (text) => {
    if (!text) return null;
    const m = String(text).replace(/\u00A0/g, ' ').match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? Number(m[1]) : null;
  };

  // Utility: parse minutes from "18 min", "18–30 min"
  const parseMinutes = (text) => {
    if (!text) return null;
    const range = String(text).match(/(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*m/i);
    if (!range) return null;
    return Number(range[1]); // use the lower bound
  };

  // Utility: parse rating like "4.6", "4.6 (1,200+)"
  const parseRating = (text) => {
    if (!text) return null;
    const m = String(text).match(/(\d\.\d)/);
    return m ? Number(m[1]) : null;
  };

  // Grab visible “cards” on DoorDash listing pages.
  const findCards = () => {
    // Try several selectors (DoorDash changes often)
    const candidates = [
      // new grid/list containers—anchor wraps the card
      'a[data-anchor-id*="StoreCard"], a[href*="/store/"]',
      // generic card containers
      'div[data-test="storeCard"], div[aria-label*="store card"] a',
      // fallback: any anchor with role=link that contains image + name
      'a[role="link"]'
    ];
    const seen = new Set();
    const out = [];
    candidates.forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        // Avoid offscreen/hidden containers
        const rect = node.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 40) return;

        // Dedupe by href
        const href = node.href || node.getAttribute('href') || null;
        if (href && seen.has(href)) return;
        if (href) seen.add(href);

        // Extract text fields by probing descendants
        const container = node;

        // Name: prefer heading or strong text
        const nameEl = container.querySelector('h3,h2,[data-test="store-name"], [data-telemetry-id="StoreCardName"]') ||
                       container.querySelector('div,span strong');
        const name = nameEl ? nameEl.textContent.trim() : null;
        if (!name || name.length < 2) return; // likely not a restaurant card

        // Image
        const imgEl = container.querySelector('img') || container.querySelector('picture img');
        const img = imgEl ? (imgEl.currentSrc || imgEl.src || null) : null;

        // Price: often appears as "From $x.xx" or on chips
        const priceTextEl =
          container.querySelector('[data-test*="price"], [class*="price"], [aria-label*="$"], [aria-label*="price"], [data-telemetry-id*="Price"]') ||
          Array.from(container.querySelectorAll('span,div'))
            .find(x => /\$\s*\d/.test(x.textContent));
        const price = parseMoney(priceTextEl?.textContent || '');

        // ETA: “18 min”, “18–30 min”
        const etaEl =
          container.querySelector('[data-test*="delivery-time"], [aria-label*="min"], [data-telemetry-id*="Time"]') ||
          Array.from(container.querySelectorAll('span,div'))
            .find(x => /\d+\s*(?:–|-)?\s*\d*\s*m/i.test(x.textContent));
        const etaMinutes = parseMinutes(etaEl?.textContent || '');

        // Delivery fee: “$2.99 delivery”, “$0 delivery fee”
        const feeEl =
          container.querySelector('[data-test*="delivery-fee"], [aria-label*="delivery"], [data-telemetry-id*="Fee"]') ||
          Array.from(container.querySelectorAll('span,div'))
            .find(x => /\$\s*\d+(?:\.\d{2})?\s*(?:delivery|fee)/i.test(x.textContent));
        // If not found, also match isolated "$2.99" near "delivery"
        let deliveryFee = parseMoney(feeEl?.textContent || '');
        if (deliveryFee === null) {
          const near = Array.from(container.querySelectorAll('span,div'))
            .find(x => /delivery/i.test(x.textContent) && /\$\s*\d/.test(x.textContent));
          deliveryFee = parseMoney(near?.textContent || '');
        }

        // Rating
        const ratingEl =
          container.querySelector('[data-test*="rating"], [aria-label*="rating"], [data-telemetry-id*="Rating"]') ||
          Array.from(container.querySelectorAll('span,div'))
            .find(x => /\d\.\d/.test(x.textContent) && /⭐|star|rating/i.test(x.closest('*')?.textContent || ''));
        const rating =
          parseRating(ratingEl?.textContent || '') ||
          parseRating(Array.from(container.querySelectorAll('span,div')).map(n => n.textContent).join(' '));

        out.push({
          name,
          price,
          etaMinutes,
          deliveryFee,
          rating,
          img,
          href: href || null
        });
      });
    });
    return out;
  };

  // Listen for popup requests
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'DD_SCAN') {
      try {
        const rows = findCards();
        sendResponse({ ok: true, rows });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true; // async response
    }
  });
})();
