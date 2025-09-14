# DoorDash Deal Finder

A Chrome extension to find the best deals and fastest delivery times on DoorDash listing/search pages.

## Features
- Scans visible restaurant cards for: name, price, ETA, delivery fee, rating, image, and link
- Sort by price (toggle)
- Modern, dark-mode friendly UI
- No network/API calls; DOM only
- Handles errors gracefully

## Install & Use
1. Download or clone this folder.
2. In Chrome, go to `chrome://extensions`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the `extension/` folder.
5. Pin the extension for easy access.
6. On a DoorDash listing/search page, click the extension and hit "Scan DoorDash Page".
7. View results, sort, and click cards to open restaurant pages.

## Files
- `manifest.json`: Chrome extension manifest (MV3)
- `popup.html`, `popup.css`, `popup.js`: Popup UI
- `content.js`: Scraper logic
- `background.js`: Service worker (required for MV3)
- `icons/`: Extension icons (use emoji/SVG in UI)

## Notes
- No external network/API calls
- Scraping is resilient to DOM changes
- Only works on DoorDash listing/search results pages
- Handles empty/error states with helpful messages

---
Enjoy finding the best deals and fastest delivery times on DoorDash!
