// content.js
import * as doordash from './adapters/doordash.js';
import * as ubereats from './adapters/ubereats.js';
import * as grubhub from './adapters/grubhub.js';

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
});
