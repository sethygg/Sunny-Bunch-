export const PRODUCTS = Object.freeze({
  raspberry: Object.freeze({ id: 'raspberry', name: 'Natural Raspberry', priceCents: 2499, image: '/assets/sunnybunch-raspberry-brand-first.jpg' }),
  tropical: Object.freeze({ id: 'tropical', name: 'Pineapple Orange Guava', priceCents: 2499, image: '/assets/sunnybunch-tropical-brand-first.jpg' })
});
export const SUBSCRIPTION = Object.freeze({ discountPercent: 10, intervalDays: 30 });
export const PURCHASE_MODES = Object.freeze(['one-time', 'subscription']);
export const MAX_QUANTITY = 99;
// Keep existing bags: legacy flavor keys are always one-time purchases.
export const CART_KEY = 'mias-place-bag-v1';
export function lineKey(id, purchaseMode = 'one-time') {
  if (!Object.hasOwn(PRODUCTS, id)) throw new Error('Choose one of our two flavors.');
  if (!PURCHASE_MODES.includes(purchaseMode)) throw new Error('Choose one-time purchase or subscription.');
  return purchaseMode === 'one-time' ? id : `${id}:subscription`;
}
export function unitPrice(product, purchaseMode = 'one-time') {
  if (!PURCHASE_MODES.includes(purchaseMode)) throw new Error('Choose one-time purchase or subscription.');
  if (!Number.isInteger(product.priceCents) || product.priceCents < 0) return null;
  return purchaseMode === 'subscription' ? Math.round(product.priceCents * (100 - SUBSCRIPTION.discountPercent) / 100) : product.priceCents;
}
export function updateCart(cart, id, quantity, purchaseMode = 'one-time') {
  const key = lineKey(id, purchaseMode);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) throw new Error('Choose a whole number of pouches from 0 to 99.');
  const next = { ...cart };
  if (quantity === 0) delete next[key];
  else next[key] = quantity;
  return next;
}
export function restoreCart(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    let cart = {};
    for (const id of Object.keys(PRODUCTS)) {
      for (const mode of PURCHASE_MODES) {
        const key = lineKey(id, mode);
        const quantity = Object.hasOwn(parsed, key) ? parsed[key] : null;
        if (Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY) cart = updateCart(cart, id, quantity, mode);
      }
    }
    return cart;
  } catch { return {}; }
}
export function replaceCart(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'items') || !Array.isArray(input.items) || input.items.length > 4) throw new Error('Supply up to four flavor and purchase-option combinations.');
  const seen = new Set();
  return input.items.reduce((next, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['id', 'quantity', 'purchaseMode'].includes(key))) throw new Error('Supply each item with an id, quantity, and optional purchaseMode.');
    const mode = item.purchaseMode === undefined ? 'one-time' : item.purchaseMode;
    const key = lineKey(item.id, mode);
    if (seen.has(key)) throw new Error('Include each flavor and purchase option only once.');
    seen.add(key);
    return updateCart(next, item.id, item.quantity, mode);
  }, {});
}
export function summarizeCart(cart, products = PRODUCTS) {
  const items = [];
  for (const id of Object.keys(PRODUCTS)) {
    for (const purchaseMode of PURCHASE_MODES) {
      const key = lineKey(id, purchaseMode);
      const quantity = cart[key];
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) continue;
      const product = products[id];
      const unitPriceCents = unitPrice(product, purchaseMode);
      items.push({ key, id, name: product.name, purchaseMode, intervalDays: purchaseMode === 'subscription' ? SUBSCRIPTION.intervalDays : null, quantity, unitPriceCents, lineTotalCents: unitPriceCents === null ? null : unitPriceCents * quantity, savingsCents: unitPriceCents === null ? null : (product.priceCents - unitPriceCents) * quantity });
    }
  }
  const recurring = items.filter(item => item.purchaseMode === 'subscription');
  const total = (lines, field) => lines.some(item => item[field] === null) ? null : lines.reduce((sum, item) => sum + item[field], 0);
  return {
    items,
    pouchCount: items.reduce((sum, item) => sum + item.quantity, 0),
    sachetCount: items.reduce((sum, item) => sum + item.quantity * 25, 0),
    subtotalCents: total(items, 'lineTotalCents'),
    recurringSubtotalCents: total(recurring, 'lineTotalCents'),
    savingsCents: total(items, 'savingsCents'),
    hasSubscription: recurring.length > 0,
    recurringIntervalDays: recurring.length ? SUBSCRIPTION.intervalDays : null,
    currency: 'USD',
    shippingIncluded: false,
    taxIncluded: false,
    checkoutAvailable: false,
    subscriptionBillingAvailable: false
  };
}
export function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
