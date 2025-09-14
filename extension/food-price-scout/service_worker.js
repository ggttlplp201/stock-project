// service_worker.js
// DoorDash Deal Finder background service worker
// No background logic needed for this extension, as popup directly messages content script
chrome.runtime.onInstalled.addListener(() => {
  // Optional: show install notification or onboarding
});
// ...existing code...
