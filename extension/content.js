// DoorDash Deal Finder Content Script
// Scrapes visible restaurant cards on DoorDash listing/search pages

/**
 * Safely extracts a number from a string (e.g., "$12.99", "18–30 min", "From $9.49", "$0 delivery fee", "$2.99 delivery")
 * Returns null if not found.
 */
function extractNumber(str) {
  if (!str || typeof str !== 'string') return null;
  // Price: $12.99, From $9.49
  let priceMatch = str.match(/\$\s?(\d+[.,]?\d*)/);
  if (priceMatch) return parseFloat(priceMatch[1].replace(',', ''));
  // ETA: 18 min, 18–30 min
  let etaMatch = str.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*min/);
  if (etaMatch) return parseInt(etaMatch[1], 10);
  // Delivery fee: $2.99, $0 delivery fee
  let feeMatch = str.match(/\$\s?(\d+[.,]?\d*)\s*delivery/i);
  if (feeMatch) return parseFloat(feeMatch[1].replace(',', ''));
  // Rating: 4.3
  let ratingMatch = str.match(/(\d+\.\d+)/);
  if (ratingMatch) return parseFloat(ratingMatch[1]);
  return null;
}

/**
 * Scrapes all visible restaurant cards on DoorDash listing/search results page
 * Returns array of normalized objects
 */
function scrapeDoorDash() {
  const results = [];
  // Try to find restaurant cards (data-*, fallback to common selectors)
  let cards = Array.from(document.querySelectorAll('[data-anchor-id^="StoreCard"]'));
  if (cards.length === 0) {
    // Fallback: try other selectors
    cards = Array.from(document.querySelectorAll('a[href*="/store/"]'));
  }
  for (const card of cards) {
    try {
      // Name
      let name = card.getAttribute('aria-label') || card.querySelector('[data-testid="store-name"], [data-anchor-id*="StoreCardTitle"], .storeName')?.textContent?.trim() || null;
      // Price (look for price chips, "From $9.49", etc)
      let priceText = card.querySelector('[data-anchor-id*="StoreCardPrice"], [data-testid*="price"], .price')?.textContent || card.textContent;
      let price = extractNumber(priceText);
      // ETA
      let etaText = card.querySelector('[data-anchor-id*="StoreCardEta"], [data-testid*="delivery-time"], .deliveryTime')?.textContent || card.textContent;
      let etaMinutes = extractNumber(etaText);
      // Delivery Fee
      let feeText = card.querySelector('[data-anchor-id*="StoreCardDeliveryFee"], [data-testid*="delivery-fee"], .deliveryFee')?.textContent || card.textContent;
      let deliveryFee = extractNumber(feeText);
      // Rating
      let ratingText = card.querySelector('[data-anchor-id*="StoreCardRating"], [data-testid*="star-rating"], .starRating')?.textContent || card.textContent;
      let rating = extractNumber(ratingText);
      // Image
      let img = card.querySelector('img')?.src || null;
      // Href
      let href = card.querySelector('a[href*="/store/"]')?.href || card.getAttribute('href') || null;
      // Normalize href (absolute)
      if (href && !href.startsWith('http')) {
        href = location.origin + href;
      }
      results.push({ name, price, etaMinutes, deliveryFee, rating, img, href });
    } catch (e) {
      // Defensive: skip card on error
      continue;
    }
  }
  return results;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SCAN_DOORDASH') {
    try {
      const data = scrapeDoorDash();
      sendResponse({ success: true, data });
    } catch (e) {
      sendResponse({ success: false, error: e.message || 'Scraping failed.' });
    }
  }
  // Required for async sendResponse
  return true;
});

// For testing: window.scrapeDoorDash = scrapeDoorDash;
