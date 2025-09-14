// content.js
// DoorDash Deal Finder content script
// Scrapes visible restaurant cards on DoorDash listing/search pages

function extractNumber(str) {
  if (!str) return null;
  // Extract first number (supports $12.99, 18–30 min, From $9.49, $0 delivery fee, $2.99 delivery)
  const match = String(str).replace(/,/g, '').match(/([\d]+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

const findCards = () => {
  const cards = document.querySelectorAll('a[data-anchor-id="StoreCard"], a[data-test="storeCard"], a[href*="/store/"]');
  const out = [];

  cards.forEach(card => {
    // Name
    const nameEl = card.querySelector('h3, h2, [data-test="store-name"]');
    const name = nameEl ? nameEl.textContent.trim() : null;
    if (!name) return; // skip if no name

    // Image
    const imgEl = card.querySelector('img');
    const img = imgEl ? (imgEl.currentSrc || imgEl.src) : null;

    // ETA
    const etaEl = card.querySelector('[data-test*="delivery-time"], span, div');
    const etaMinutes = etaEl ? parseMinutes(etaEl.textContent) : null;

    // Delivery fee
    const feeEl = card.querySelector('[data-test*="delivery-fee"], span, div');
    const deliveryFee = feeEl ? parseMoney(feeEl.textContent) : null;

    // Rating
    const ratingEl = card.querySelector('[data-test*="rating"], span, div');
    const rating = ratingEl ? parseRating(ratingEl.textContent) : null;

    // Price (DoorDash doesn’t always show upfront — might be null)
    const priceEl = card.querySelector('[data-test*="price"], span, div');
    const price = priceEl ? parseMoney(priceEl.textContent) : null;

    out.push({
      name,
      img,
      etaMinutes,
      deliveryFee,
      rating,
      price,
      href: card.href || null
    });
  });

  return out;
};


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCAN_DOORDASH') {
    try {
      const result = findCards();
      sendResponse(result);
    } catch (e) {
      sendResponse({ error: 'Scraping failed: ' + e.message });
    }
    return true;
  }
});
