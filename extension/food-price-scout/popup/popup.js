// popup.js
// DoorDash Deal Finder popup logic
// Modular, commented, and ready for future feature toggles

const scanBtn = document.getElementById('scanBtn');
const sortPriceToggle = document.getElementById('sortPriceToggle');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');
const foundCount = document.getElementById('foundCount');

let items = [];
let sortByPrice = false;

function render() {
  let sorted = [...items];
  if (sortByPrice) {
    sorted = sorted.sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });
  }
  // Find lowest price index
  let lowestIdx = sorted.findIndex(
    r => r.price != null && r.price === Math.min(...sorted.filter(x => x.price != null).map(x => x.price))
  );
  foundCount.textContent = `${sorted.length} found`;
  if (!sorted.length) {
    resultsDiv.innerHTML = `<div class="hint">No restaurants found. Make sure you're on a DoorDash listing/search page.</div>`;
    return;
  }
  resultsDiv.innerHTML = sorted.map((item, idx) => {
    return `<div class="result-card${idx === lowestIdx ? ' best' : ''}" tabindex="0" ${item.href ? `onclick=window.open('${item.href}','_blank')` : ''}>
      <div class="result-row">
        ${item.img ? `<img class="result-img" src="${item.img}" alt="">` : ''}
        <div class="result-title" title="${item.name}">${item.name}</div>
        ${idx === lowestIdx ? '<span class="badge lowest">Lowest Price</span>' : ''}
      </div>
      <div class="badges">
        ${item.price != null ? `<span class="badge price">$${item.price.toFixed(2)}</span>` : ''}
        ${item.etaMinutes != null ? `<span class="badge eta">⏱ ${item.etaMinutes}m</span>` : ''}
        ${item.deliveryFee != null ? `<span class="badge fee">🚚 $${item.deliveryFee.toFixed(2)}</span>` : ''}
        ${item.rating != null ? `<span class="badge star">⭐ ${item.rating}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function showError(msg) {
  errorDiv.textContent = msg;
  setTimeout(() => { errorDiv.textContent = ''; }, 3500);
}

function scanPage() {
  errorDiv.textContent = '';
  resultsDiv.innerHTML = '<div class="hint">Scanning…</div>';
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (!tabs[0]) return showError('No active tab found.');
    chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_DOORDASH' }, resp => {
      if (!resp || resp.error) {
        showError(resp?.error || 'Scraping failed. Try refreshing the page.');
        resultsDiv.innerHTML = '';
        foundCount.textContent = '0 found';
        return;
      }
      items = Array.isArray(resp.items) ? resp.items : [];
      render();
    });
  });
}

scanBtn.addEventListener('click', scanPage);
sortPriceToggle.addEventListener('change', e => {
  sortByPrice = e.target.checked;
  render();
});

// Initial state
sortByPrice = false;
render();
