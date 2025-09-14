// popup.js — show only Delivery Fee, ETA, Rating, Rating Count

const scanBtn = document.getElementById('scanBtn');
const countPill = document.getElementById('countPill');
const resultsEl = document.getElementById('results');
const alertEl = document.getElementById('alert');

let rawRows = [];

const fmtFee = (n) => (typeof n === 'number')
  ? (n === 0 ? 'Free' : `$${n.toFixed(2)}`)
  : null;
const fmtEta = (m) => (typeof m === 'number') ? `${m}m` : null;

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

    // Title only (clean)
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = r.displayName || r.name || 'Restaurant';

    // Chips: Delivery fee, ETA, Rating, Rating Count
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

    // Use rows as-is (no sorting). Rendering will use displayName when present.
    rawRows = resp.rows || [];
    render(rawRows);
  } catch (e) {
    setAlert(`Scan failed: ${String(e.message || e)}`);
    countPill.textContent = '0 found';
  }
}

scanBtn.addEventListener('click', scan);
