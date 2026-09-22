export const PRODUCTS = Object.freeze({
  raspberry: Object.freeze({ id: 'raspberry', name: 'Natural Raspberry', priceCents: null, image: '/assets/sunnybunch-raspberry.jpg' }),
  tropical: Object.freeze({ id: 'tropical', name: 'Pineapple Orange Guava', priceCents: null, image: '/assets/sunnybunch-tropical.jpg' })
});
export const MAX_QUANTITY = 99;
export const CART_KEY = 'mias-place-bag-v1';
export function updateCart(cart, id, quantity) {
  if (!Object.hasOwn(PRODUCTS, id)) throw new Error('Choose one of our two flavors.');
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) throw new Error('Choose a whole number of pouches from 0 to 99.');
  const next = { ...cart };
  if (quantity === 0) delete next[id];
  else next[id] = quantity;
  return next;
}
export function restoreCart(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.keys(PRODUCTS).reduce((cart, id) => {
      const quantity = parsed[id];
      return Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY ? updateCart(cart, id, quantity) : cart;
    }, {});
  } catch { return {}; }
}
export function replaceCart(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'items') || !Array.isArray(input.items) || input.items.length > 2) throw new Error('Supply an items array with at most two flavors.');
  const seen = new Set();
  return input.items.reduce((next, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['id', 'quantity'].includes(key)) || seen.has(item.id)) throw new Error('Include each flavor once, with an id and quantity.');
    seen.add(item.id);
    return updateCart(next, item.id, item.quantity);
  }, {});
}
export function summarizeCart(cart, products = PRODUCTS) {
  const items = Object.keys(PRODUCTS).filter(id => cart[id]).map(id => {
    const product = products[id];
    const unitPriceCents = Number.isInteger(product.priceCents) && product.priceCents >= 0 ? product.priceCents : null;
    return { id, name: product.name, quantity: cart[id], unitPriceCents, lineTotalCents: unitPriceCents === null ? null : unitPriceCents * cart[id] };
  });
  return {
    items,
    pouchCount: items.reduce((sum, item) => sum + item.quantity, 0),
    sachetCount: items.reduce((sum, item) => sum + item.quantity * 25, 0),
    subtotalCents: items.some(item => item.lineTotalCents === null) ? null : items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    currency: 'USD',
    checkoutAvailable: false
  };
}
export function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
