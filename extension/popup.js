// popup.js — sorting by Lowest Fee / Fastest / Best Rating

const scanBtn = document.getElementById('scanBtn');
const countPill = document.getElementById('countPill');
const resultsEl = document.getElementById('results');
const alertEl = document.getElementById('alert');
const sortGroup = document.getElementById('sortGroup');

let rawRows = [];
let sortMode = 'fee'; // 'fee' | 'eta' | 'rating'

const fmtFee = (n) => (typeof n === 'number')
  ? (n === 0 ? 'Free' : `$${n.toFixed(2)}`)
  : null;
const fmtEta = (m) => (typeof m === 'number') ? `${m}m` : null;

// Normalize ratingCount into a number for tie-breaks
const ratingCountNum = (v) => {
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

function setAlert(msg){ alertEl.textContent = msg; alertEl.classList.remove('hidden'); }
function clearAlert(){ alertEl.classList.add('hidden'); }

function render(rows){
  resultsEl.innerHTML = '';
  countPill.textContent = `${rows.length} found`;
  if (!rows.length){
    setAlert('No restaurants detected. Open a DoorDash listing/search page and try again.');
    return;
  }
  clearAlert();

  rows.forEach(r => {
    const a = document.createElement('a');
    a.className = 'card-item linkish';
    if (r.href) { a.href = r.href; a.target = '_blank'; a.rel = 'noreferrer'; }

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = r.displayName || r.name || 'Restaurant';

    const row2 = document.createElement('div'); row2.className = 'row2';
    const chips = [];

    const feeTxt = fmtFee(r.deliveryFee);
    if (feeTxt) chips.push({txt: feeTxt, symbol: '🚚'});

    const etaTxt = fmtEta(r.etaMinutes);
    if (etaTxt) chips.push({txt: etaTxt, symbol: '⏱'});

    if (typeof r.rating === 'number') chips.push({txt: String(r.rating), symbol: '⭐'});
    if (r.ratingCount) chips.push({txt: String(r.ratingCount), symbol: '👥'});

    chips.forEach(c => {
      const chip = document.createElement('span'); chip.className = 'chip';
      const s = document.createElement('span'); s.textContent = c.symbol;
      const t = document.createElement('strong'); t.textContent = ` ${c.txt}`;
      chip.appendChild(s); chip.appendChild(t);
      row2.appendChild(chip);
    });

    a.appendChild(title);
    a.appendChild(row2);
    resultsEl.appendChild(a);
  });
}

function sortRows(rows, mode){
  const list = rows.slice();

  const byFee = (a, b) => {
    const fa = (typeof a.deliveryFee === 'number') ? a.deliveryFee : Number.POSITIVE_INFINITY;
    const fb = (typeof b.deliveryFee === 'number') ? b.deliveryFee : Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    // tie-breakers: faster ETA, then higher rating, then more ratings
    const ea = (typeof a.etaMinutes === 'number') ? a.etaMinutes : Number.POSITIVE_INFINITY;
    const eb = (typeof b.etaMinutes === 'number') ? b.etaMinutes : Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    const ra = (typeof a.rating === 'number') ? a.rating : -Infinity;
    const rb = (typeof b.rating === 'number') ? b.rating : -Infinity;
    if (ra !== rb) return rb - ra;
    return ratingCountNum(b.ratingCount) - ratingCountNum(a.ratingCount);
  };

  const byEta = (a, b) => {
    const ea = (typeof a.etaMinutes === 'number') ? a.etaMinutes : Number.POSITIVE_INFINITY;
    const eb = (typeof b.etaMinutes === 'number') ? b.etaMinutes : Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    const fa = (typeof a.deliveryFee === 'number') ? a.deliveryFee : Number.POSITIVE_INFINITY;
    const fb = (typeof b.deliveryFee === 'number') ? b.deliveryFee : Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    const ra = (typeof a.rating === 'number') ? a.rating : -Infinity;
    const rb = (typeof b.rating === 'number') ? b.rating : -Infinity;
    if (ra !== rb) return rb - ra;
    return ratingCountNum(b.ratingCount) - ratingCountNum(a.ratingCount);
  };

  const byRating = (a, b) => {
    const ra = (typeof a.rating === 'number') ? a.rating : -Infinity;
    const rb = (typeof b.rating === 'number') ? b.rating : -Infinity;
    if (ra !== rb) return rb - ra;
    // tie-breakers: more ratings, then lower fee, then faster ETA
    const ca = ratingCountNum(a.ratingCount);
    const cb = ratingCountNum(b.ratingCount);
    if (ca !== cb) return cb - ca;
    const fa = (typeof a.deliveryFee === 'number') ? a.deliveryFee : Number.POSITIVE_INFINITY;
    const fb = (typeof b.deliveryFee === 'number') ? b.deliveryFee : Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    const ea = (typeof a.etaMinutes === 'number') ? a.etaMinutes : Number.POSITIVE_INFINITY;
    const eb = (typeof b.etaMinutes === 'number') ? b.etaMinutes : Number.POSITIVE_INFINITY;
    return ea - eb;
  };

  switch (mode) {
    case 'eta': return list.sort(byEta);
    case 'rating': return list.sort(byRating);
    case 'fee':
    default: return list.sort(byFee);
  }
}

function refresh(){
  render(sortRows(rawRows, sortMode));
}

async function injectContentIfNeeded(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'DD_PING' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
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
    await injectContentIfNeeded(tab.id);
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'DD_SCAN', debug: true });
    if (!resp?.ok) throw new Error(resp?.error || 'Unknown content-script error.');
    rawRows = resp.rows || [];
    refresh();
  } catch (e) {
    setAlert(`Scan failed: ${String(e.message || e)}`);
    countPill.textContent = '0 found';
  }
}

scanBtn.addEventListener('click', scan);

// segmented control
sortGroup.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sortMode = btn.dataset.mode;
    // toggle active states & aria
    sortGroup.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    if (rawRows.length) refresh();
  });
});
