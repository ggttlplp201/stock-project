// content.js
// helpers inlined
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const selectText = (el, sel) => (sel ? el.querySelector(sel) : el)?.textContent?.trim() ?? '';
const toNumber = (txt) => { if(!txt) return NaN; const n = txt.replace(/[^0-9.,]/g,'').replace(',', '.'); return parseFloat(n); };
const toMinutes = (txt) => { if(!txt) return NaN; const h=/([0-9]+)\s*hr/.exec(txt)?.[1]; const m=/([0-9]+)\s*min/.exec(txt)?.[1]; if(h||m) return (parseInt(h||'0',10)*60)+parseInt(m||'0',10); const first=/([0-9]+)/.exec(txt)?.[1]; return first?parseInt(first,10):NaN; };
// adapters inlined
const adapters = [doordash, ubereats, grubhub];

function getAdapter() {
  const host = window.location.hostname;
  return adapters.find(a => a.matches(host));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT_ITEMS') {
    const adapter = getAdapter();
    if (!adapter) {
      sendResponse({ error: 'Site not supported' });
      return;
    }
    try {
      const items = adapter.extract();
      sendResponse({ items, site: adapter.id });
    } catch (e) {
      sendResponse({ error: e.message });
    }
  }

  // content/content.js (source before bundling)

// avoid double-registering if injected twice
if (!window.__PRICE_SCOUT_READY__) {
  window.__PRICE_SCOUT_READY__ = true;

  // … your extraction code + MutationObserver …

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PING') {
      sendResponse({ ok: true, at: Date.now() });
      return; // no async
    }
    if (msg?.type === 'EXTRACT_ITEMS') {
      // return whatever you have now (don’t block)
      const result = { platform: adapter?.id ?? null, items: extractNow() };
      sendResponse(result);
      return; // no async
    }
  });
}

});
