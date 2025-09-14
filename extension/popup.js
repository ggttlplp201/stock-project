// popup.js — orchestrates scan and renders UI

const scanBtn = document.getElementById('scanBtn');
const countPill = document.getElementById('countPill');
const sortPrice = document.getElementById('sortPrice');
const resultsEl = document.getElementById('results');
const alertEl = document.getElementById('alert');

let rawRows = [];
let lowestIndex = -1;

const fmtMoney = (n) => (typeof n === 'number' && !Number.isNaN(n)) ? `$ ${n.toFixed(2)}` : null;
const fmtFee = (n) => (typeof n === 'number') ? `$${n.toFixed(2)}` : null;
const fmtEta = (m) => (typeof m === 'number') ? `${m}m` : null;

function setAlert(msg, kind='info'){
  alertEl.textContent = msg;
  alertEl.classList.remove('hidden');
}
function clearAlert(){
  alertEl.classList.add('hidden');
}

function computeLowest(rows){
  let min = Number.POSITIVE_INFINITY;
  let idx = -1;
  rows.forEach((r, i) => {
    if (typeof r.price === 'number' && r.price < min) {
      min = r.price; idx = i;
    }
  });
  return idx;
}

function render(rows){
  resultsEl.innerHTML = '';
  lowestIndex = computeLowest(rows);
  countPill.textContent = `${rows.length} found`;

  if (!rows.length){
    setAlert('No restaurants detected. Open a DoorDash listing/search page and try again.');
    return;
  }
  clearAlert();

  rows.forEach((r, i) => {
    const a = document.createElement('a');
    a.className = 'card-item linkish';
    if (r.href) { a.href = r.href; a.target = '_blank'; a.rel = 'noreferrer'; }

    const img = document.createElement('img');
    img.className = 'thumb';
    img.alt = '';
    img.src = r.img || 'icons/icon128.png';

    const meta = document.createElement('div'); meta.className = 'meta';

    // Row 1
    const row1 = document.createElement('div'); row1.className = 'row1';
    const title = document.createElement('div'); title.className = 'title'; title.textContent = r.name || 'Unknown';

    row1.appendChild(title);
    if (i === lowestIndex) {
      const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'Lowest Price';
      row1.appendChild(badge);
    }

    // Row 2 chips
    const row2 = document.createElement('div'); row2.className = 'row2';
    const chips = [];

    const priceTxt = fmtMoney(r.price);
    if (priceTxt) chips.push({txt: priceTxt, symbol: '$'});

    const etaTxt = fmtEta(r.etaMinutes);
    if (etaTxt) chips.push({txt: etaTxt, symbol: '⏱'});

    const feeTxt = fmtFee(r.deliveryFee);
    if (feeTxt) chips.push({txt: feeTxt, symbol: '🚚'});

    if (typeof r.rating === 'number') chips.push({txt: String(r.rating), symbol: '⭐'});

    chips.forEach(c => {
      const chip = document.createElement('span'); chip.className = 'chip';
      const s = document.createElement('span'); s.textContent = c.symbol;
      const t = document.createElement('strong'); t.textContent = ` ${c.txt}`;
      chip.appendChild(s); chip.appendChild(t);
      row2.appendChild(chip);
    });

    meta.appendChild(row1);
    meta.appendChild(row2);
    a.appendChild(img);
    a.appendChild(meta);
    resultsEl.appendChild(a);
  });
}

function sortRows(rows){
  if (!sortPrice.checked) return rows.slice();
  return rows.slice().sort((a, b) => {
    const pa = (typeof a.price === 'number') ? a.price : Number.POSITIVE_INFINITY;
    const pb = (typeof b.price === 'number') ? b.price : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    // tiebreaker: faster ETA first if available
    const ea = (typeof a.etaMinutes === 'number') ? a.etaMinutes : Number.POSITIVE_INFINITY;
    const eb = (typeof b.etaMinutes === 'number') ? b.etaMinutes : Number.POSITIVE_INFINITY;
    return ea - eb;
  });
}

async function injectContentIfNeeded(tabId) {
  try {
    // Try a no-op message; if it fails, we'll inject.
    await chrome.tabs.sendMessage(tabId, { type: 'DD_PING' }, { timeout: 300 });
    return; // listener exists
  } catch {
    // No listener → inject
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

async function scan(){
  clearAlert();
  resultsEl.innerHTML = '';
  countPill.textContent = '…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    if (!tab || !/^https?:\/\/([\w-]+\.)*doordash\.com/i.test(url)) {
      setAlert('Open a DoorDash listing page (restaurants near you) and click “Scan”.');
      countPill.textContent = '0 found';
      return;
    }

    // Ensure the content script exists, then message it.
    await injectContentIfNeeded(tab.id);

    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'DD_SCAN', debug: true });
    if (!resp?.ok) throw new Error(resp?.error || 'Unknown content-script error.');

    rawRows = resp.rows || [];
    render(sortRows(rawRows));
  } catch (e) {
    setAlert(`Scan failed: ${String(e.message || e)}`);
    countPill.textContent = '0 found';
  }
}


scanBtn.addEventListener('click', scan);
sortPrice.addEventListener('change', () => {
  if (!rawRows.length) return;
  render(sortRows(rawRows));
});

// Optional: auto-scan when popup opens
document.addEventListener('DOMContentLoaded', () => {
  // Comment out if you prefer manual
  // scan();
});
