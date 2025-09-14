// DoorDash Deal Finder Popup Script
// Handles UI, messaging, sorting, error states

const scanBtn = document.getElementById('scan-btn');
const sortToggle = document.getElementById('sort-toggle');
const pillCount = document.getElementById('pill-count');
const resultsMain = document.getElementById('results');
const toast = document.getElementById('toast');
const cardTemplate = document.getElementById('card-template');
const emptyTemplate = document.getElementById('empty-template');

let results = [];
let sortByPrice = false;

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2500);
}

function renderResults() {
  resultsMain.innerHTML = '';
  if (!results || results.length === 0) {
    resultsMain.appendChild(emptyTemplate.content.cloneNode(true));
    pillCount.textContent = '0 found';
    return;
  }
  // Find lowest price
  let lowestIdx = null;
  let minPrice = null;
  results.forEach((r, i) => {
    if (typeof r.price === 'number' && (minPrice === null || r.price < minPrice)) {
      minPrice = r.price;
      lowestIdx = i;
    }
  });
  // Sort if needed
  let sorted = [...results];
  if (sortByPrice) {
    sorted.sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });
  }
  pillCount.textContent = `${sorted.length} found`;
  sorted.forEach((r, i) => {
    const card = cardTemplate.content.cloneNode(true);
    const cardEl = card.querySelector('.card');
    // Thumbnail
    const thumb = cardEl.querySelector('.thumb');
    thumb.src = r.img || '';
    thumb.alt = r.name || 'Restaurant';
    // Name
    const nameEl = cardEl.querySelector('.name');
    nameEl.textContent = r.name || 'Unknown';
    // Badge
    const badge = cardEl.querySelector('.badge');
    if (lowestIdx !== null && results[lowestIdx] && r.name === results[lowestIdx].name && r.price === results[lowestIdx].price) {
      badge.hidden = false;
    }
    // Chips
    const chips = cardEl.querySelector('.chips');
    if (typeof r.price === 'number') chips.appendChild(makeChip(`$ ${r.price.toFixed(2)}`));
    if (typeof r.etaMinutes === 'number') chips.appendChild(makeChip(`⏱ ${r.etaMinutes}m`));
    if (typeof r.deliveryFee === 'number') chips.appendChild(makeChip(`🚚 $${r.deliveryFee.toFixed(2)}`));
    if (typeof r.rating === 'number') chips.appendChild(makeChip(`⭐ ${r.rating.toFixed(1)}`));
    // Card click
    if (r.href) {
      cardEl.addEventListener('click', () => {
        window.open(r.href, '_blank');
      });
    }
    resultsMain.appendChild(card);
  });
}

function makeChip(text) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = text;
  return chip;
}

function scanPage() {
  pillCount.textContent = '...';
  resultsMain.innerHTML = '';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab || !tab.url.includes('doordash.com')) {
      results = [];
      renderResults();
      showToast('Not a DoorDash page.');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_DOORDASH' }, res => {
      if (!res || !res.success) {
        results = [];
        renderResults();
        showToast(res?.error || 'Scraping failed.');
        return;
      }
      results = Array.isArray(res.data) ? res.data.filter(r => r.name) : [];
      renderResults();
      if (results.length === 0) showToast('No deals found.');
    });
  });
}

scanBtn.addEventListener('click', scanPage);
sortToggle.addEventListener('change', e => {
  sortByPrice = !!e.target.checked;
  renderResults();
});

// Initial empty state
renderResults();
