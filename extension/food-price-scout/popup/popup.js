// popup.js
const scanBtn = document.getElementById('scanBtn');
const sortPriceToggle = document.getElementById('sortPriceToggle');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');
const foundCount = document.getElementById('foundCount');

let items = [];
let bestIdx = -1;

function render() {
  let filtered = items;
  // Sort by price only
  filtered = filtered.sort((a, b) => a.price - b.price);
  bestIdx = filtered.length ? 0 : -1;
  foundCount.textContent = `${filtered.length} found`;
  resultsDiv.innerHTML = filtered.map((item, idx) => `
    <div class="result-card${idx === bestIdx ? ' best' : ''}">
      <div class="result-title">${item.name}</div>
      <div class="badges">
        <span class="badge price">$${item.price.toFixed(2)}${idx === bestIdx ? ' <span class=badge best>Lowest Price</span>' : ''}</span>
        <span class="badge eta">⏱ ${item.etaMin}m</span>
        <span class="badge fee">🚚 $${item.deliveryFee?.toFixed(2) ?? '--'}</span>
        <span class="badge star">⭐ ${item.star ?? '--'}</span>
      </div>
    </div>
  `).join('');
}

function scanPage() {
  errorDiv.textContent = '';
  resultsDiv.innerHTML = '<div class="hint">Scanning…</div>';
  chrome.runtime.sendMessage({ type: 'SCAN_PAGE' }, resp => {
    if (resp?.error) {
      errorDiv.textContent = resp.error;
      resultsDiv.innerHTML = '';
      return;
    }
    items = (resp.items || []).map(i => ({
      ...i,
      deliveryFee: i.deliveryFee ?? 0,
      star: i.star ?? '--'
    }));
    render();
  });
}

scanBtn.addEventListener('click', scanPage);
sortPriceToggle.addEventListener('change', render);
