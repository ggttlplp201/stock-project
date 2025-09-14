// content.js
// DoorDash Deal Finder content script
// Scrapes visible restaurant cards on DoorDash listing/search pages

function extractNumber(str) {
  if (!str) return null;
  // Extract first number (supports $12.99, 18–30 min, From $9.49, $0 delivery fee, $2.99 delivery)
  const match = String(str).replace(/,/g, '').match(/([\d]+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function scrapeDoorDash() {
  // Try to find all restaurant cards (defensive selectors)
  const cards = Array.from(document.querySelectorAll('[data-anchor-id^="StoreCard"]:not([aria-hidden="true"]), [data-testid^="store-card"], [data-anchor-id*="StoreCard"], [aria-label*="restaurant"]'));
  if (!cards.length) return { error: 'No restaurant cards found.' };
  const results = cards.map(card => {
    // Name
    let name = card.querySelector('[data-anchor-id*="StoreCardTitle"], [data-testid*="store-card-title"], h2, h3')?.textContent?.trim() || null;
    // Price (try to find lowest displayed item price or bundle price)
    let priceText = card.querySelector('[data-anchor-id*="StoreCardPrice"], [data-testid*="store-card-price"], .Price, .price')?.textContent || '';
    let price = extractNumber(priceText);
    // ETA
    let etaText = card.querySelector('[data-anchor-id*="StoreCardEta"], [data-testid*="store-card-eta"], .DeliveryTime, .delivery-time')?.textContent || '';
    let etaMinutes = extractNumber(etaText);
    // Delivery Fee
    let feeText = card.querySelector('[data-anchor-id*="StoreCardDeliveryFee"], [data-testid*="store-card-delivery-fee"], .DeliveryFee, .delivery-fee')?.textContent || '';
    let deliveryFee = extractNumber(feeText);
    // Rating
    let ratingText = card.querySelector('[data-anchor-id*="StoreCardRating"], [data-testid*="store-card-rating"], .StarRating, .star-rating')?.textContent || '';
    let rating = extractNumber(ratingText);
    // Image
    let img = card.querySelector('img')?.src || null;
    // Href
    let href = card.querySelector('a')?.href || null;
    return { name, price, etaMinutes, deliveryFee, rating, img, href };
  });
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
