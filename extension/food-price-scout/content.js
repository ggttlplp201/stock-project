// content.js
// DoorDash Deal Finder content script
// Scrapes visible restaurant cards on DoorDash listing/search pages

function extractNumber(str) {
  if (!str) return null;
  const match = String(str).replace(/,/g, '').match(/([\d]+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function scrapeDoorDash() {
  // Try all known selectors for restaurant cards
  let cards = Array.from(document.querySelectorAll(
    'a[data-anchor-id="StoreCard"], a[data-test="storeCard"], a[href*="/store/"]'
  ));

  if (!cards.length) {
    // Fallback: divs with store card data, or any card-like container
    cards = Array.from(document.querySelectorAll(
      'div[data-anchor-id*="StoreCard"], div[data-test*="storeCard"], div:has(a[href*="/store/"])'
    ));
    if (!cards.length) {
      // Log a sample of the DOM for debugging
      console.warn('[DoorDash Deal Finder] No restaurant cards found. Sample DOM:', document.body.innerHTML.slice(0, 1000));
      return { error: 'No restaurant cards found. Try scrolling or updating selectors.' };
    }
  }

  // Helper to get text from multiple possible selectors
  function getText(card, selectors) {
    for (const sel of selectors) {
      const el = card.querySelector(sel);
      if (el && el.textContent) return el.textContent.trim();
    }
    return '';
  }

  const results = cards.map(card => {
    // Name
    const name = getText(card, ['h3', 'h2', '[data-test="store-name"]', '[aria-label]']);
    if (!name) return null;

    // Price
    const priceText = getText(card, ['[data-test*="price"]', '.price', 'span', 'div']);
    const price = extractNumber(priceText);

    // ETA
    const etaText = getText(card, ['[data-test*="delivery-time"]', '.delivery-time', 'span', 'div']);
    const etaMinutes = extractNumber(etaText);

    // Delivery fee
    const feeText = getText(card, ['[data-test*="delivery-fee"]', '.delivery-fee', 'span', 'div']);
    const deliveryFee = extractNumber(feeText);

    // Rating
    const ratingText = getText(card, ['[data-test*="rating"]', '.star-rating', 'span', 'div']);
    const rating = extractNumber(ratingText);

    // Image
    const img = card.querySelector('img')?.currentSrc || card.querySelector('img')?.src || null;

    // Href
    let href = card.href || null;
    if (!href) {
      // Try to find anchor inside card
      const anchor = card.querySelector('a[href*="/store/"]');
      if (anchor) href = anchor.href;
    }

    return { name, price, etaMinutes, deliveryFee, rating, img, href };
  }).filter(Boolean);

  return { items: results };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCAN_DOORDASH') {
    try {
      const result = scrapeDoorDash();
      sendResponse(result);
    } catch (e) {
      sendResponse({ error: 'Scraping failed: ' + e.message });
    }
    return true;
  }
});
