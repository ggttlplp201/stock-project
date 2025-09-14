chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SCAN_PAGE') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab?.id) return sendResponse({ok:false, error:'No active tab'});
        const data = await chrome.tabs.sendMessage(tab.id, {type:'EXTRACT_ITEMS'});
        sendResponse({ok:true, data});
      } catch (e) {
        const err = chrome.runtime.lastError?.message || String(e);
        sendResponse({ok:false, error: err});
      }
    })();
    return true; // keep channel open for async sendResponse
  }
});
