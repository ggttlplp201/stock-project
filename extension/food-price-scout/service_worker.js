// service_worker.js
// DoorDash Deal Finder background service worker
// Forwards popup requests to content script

chrome.runtime.onInstalled.addListener(() => {
  // Optional: show install notification or onboarding
});

// No background logic needed for this extension, as popup directly messages content script
// This file is required by manifest.json for MV3
