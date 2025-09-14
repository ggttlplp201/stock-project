// doordash.js
import { $$, selectText, toNumber, toMinutes } from '../domUtils.js';

export const id = 'doordash';
export function matches(host) {
  return /doordash\.com$/.test(host);
}
export function extract() {
  // Placeholder selectors
  const items = $$('[data-testid="store-menu-item"]');
  return items.map(el => {
    const name = selectText(el.querySelector('[data-testid="menu-item-name"]'));
    const price = toNumber(selectText(el.querySelector('[data-testid="menu-item-price"]')));
    const etaMin = toMinutes(selectText(document.querySelector('[data-testid="delivery-eta"]')));
    return { name, price, etaMin, raw: el.outerHTML };
  });
}
