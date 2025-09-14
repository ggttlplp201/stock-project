// service_worker.js
const SUPPORTED = /https:\/\/(.*\.)?(doordash|ubereats|grubhub)\.com\//i;

async function ensureContent(tab) {
  if (!tab?.id) throw new Error('No active tab');
  if (!SUPPORTED.test(tab.url || '')) throw new Error('Open a DoorDash/UberEats/Grubhub listings page');
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    return; // already injected
  } catch {
    // not injected yet → inject the bundled script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/bundle.js'],
    });
    // small delay, then verify
    await new Promise(r => setTimeout(r, 150));
    await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SCAN_PAGE') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await ensureContent(tab);
        const data = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ITEMS' });
        sendResponse({ ok: true, data });
      } catch (e) {
        const err = chrome.runtime.lastError?.message || String(e);
        sendResponse({ ok: false, error: err });
      }
    })();
    return true; // keep channel open
  }
});
