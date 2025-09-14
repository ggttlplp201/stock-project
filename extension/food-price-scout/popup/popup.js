// popup.js
const scanBtn = document.getElementById('scanBtn');
const sortMode = document.getElementById('sortMode');
const filterInput = document.getElementById('filterInput');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');

let items = [];
let bestIdx = -1;

function render() {
  const filter = filterInput.value.trim().toLowerCase();
  let filtered = items.filter(i => i.name.toLowerCase().includes(filter));
  if (sortMode.value === 'price') {
    filtered = filtered.sort((a, b) => a.price - b.price);
    bestIdx = filtered.length ? 0 : -1;
  } else {
    filtered = filtered.sort((a, b) => a.etaMin - b.etaMin);
    bestIdx = filtered.length ? 0 : -1;
  }
  resultsDiv.innerHTML = filtered.map((item, idx) => `
    <div class="result-card${idx === bestIdx ? ' best' : ''}">
      <div class="result-title">${item.name}</div>
      <div class="badges">
        <span class="badge">$${item.price}</span>
        <span class="badge">${item.etaMin} min ETA</span>
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
    items = resp.items || [];
    render();
  });
}

scanBtn.addEventListener('click', scanPage);
sortMode.addEventListener('change', render);
filterInput.addEventListener('input', render);
