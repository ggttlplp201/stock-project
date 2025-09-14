// service_worker.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCAN_PAGE') {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content/content.js']
        }, () => {
          chrome.tabs.sendMessage(tabs[0].id, {type: 'EXTRACT_ITEMS'}, sendResponse);
        });
      }
    });
    return true; // async response
  }
});
