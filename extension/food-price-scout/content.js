// content.js
// DoorDash Deal Finder content script
// Scrapes visible restaurant cards on DoorDash listing/search pages

function extractNumber(str) {
  if (!str) return null;
  const match = String(str).replace(/,/g, '').match(/([\d]+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function scrapeDoorDash() {
  // Safer: only anchors that actually link to stores
  const cards = Array.from(document.querySelectorAll(
    'a[data-anchor-id="StoreCard"], a[data-test="storeCard"], a[href*="/store/"]'
  ));

  // Debug: log how many cards found and selectors used
  if (!cards.length) {
    console.warn('[DoorDash Deal Finder] No restaurant cards found. Selectors may need updating.');
    // Try fallback selectors (for new DoorDash DOMs)
    const fallbackCards = Array.from(document.querySelectorAll('div[data-anchor-id*="StoreCard"], div[data-test*="storeCard"]'));
    if (fallbackCards.length) {
      console.info('[DoorDash Deal Finder] Fallback selectors found', fallbackCards.length, 'cards.');
      // Try to get anchor parent
      return { items: fallbackCards.map(card => {
        const anchor = card.closest('a') || card.querySelector('a[href*="/store/"]');
        const name = card.querySelector('h3, h2, [data-test="store-name"]')?.textContent?.trim() || null;
        if (!name) return null;
        const priceText = card.querySelector('[data-test*="price"], span, div')?.textContent || '';
        const price = extractNumber(priceText);
        const etaText = card.querySelector('[data-test*="delivery-time"], span, div')?.textContent || '';
        const etaMinutes = extractNumber(etaText);
        const feeText = card.querySelector('[data-test*="delivery-fee"], span, div')?.textContent || '';
        const deliveryFee = extractNumber(feeText);
        const ratingText = card.querySelector('[data-test*="rating"], span, div')?.textContent || '';
        const rating = extractNumber(ratingText);
        const img = card.querySelector('img')?.currentSrc || card.querySelector('img')?.src || null;
        const href = anchor?.href || null;
        return { name, price, etaMinutes, deliveryFee, rating, img, href };
      }).filter(Boolean) };
    }
    return { error: 'No restaurant cards found. Try scrolling or updating selectors.' };
  }

  const results = cards.map(card => {
    // Name
    const name = card.querySelector('h3, h2, [data-test="store-name"]')
      ?.textContent?.trim() || null;

    if (!name) return null; // skip junk links

    // Price (DoorDash doesn’t always show upfront)
    const priceText = card.querySelector('[data-test*="price"], span, div')
      ?.textContent || '';
    const price = extractNumber(priceText);

    // ETA
    const etaText = card.querySelector('[data-test*="delivery-time"], span, div')
      ?.textContent || '';
    const etaMinutes = extractNumber(etaText);

    // Delivery fee
    const feeText = card.querySelector('[data-test*="delivery-fee"], span, div')
      ?.textContent || '';
    const deliveryFee = extractNumber(feeText);

    // Rating
    const ratingText = card.querySelector('[data-test*="rating"], span, div')
      ?.textContent || '';
    const rating = extractNumber(ratingText);

    // Image
    const img = card.querySelector('img')?.currentSrc ||
                card.querySelector('img')?.src || null;

    // Href
    const href = card.href || null;

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
