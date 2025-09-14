// domUtils.js
export function $$(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }
export function selectText(el) { return el?.textContent?.trim() || ''; }
export function toNumber(str) {
  if (!str) return NaN;
  return Number(str.replace(/[^\d.\-]+/g, ''));
}
export function toMinutes(str) {
  if (!str) return NaN;
  const m = /([\d.]+)\s*min/.exec(str);
  if (m) return Number(m[1]);
  const h = /([\d.]+)\s*h/.exec(str);
  if (h) return Number(h[1]) * 60;
  return NaN;
}
