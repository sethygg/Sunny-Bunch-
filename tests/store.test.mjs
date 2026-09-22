import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, updateCart, restoreCart, replaceCart, summarizeCart, money } from '../dist/store.mjs';

test('both flavors can be ordered separately, edited and removed without changing the previous bag', () => {
  const original = { raspberry: 1 };
  const next = updateCart(original, 'tropical', 2);
  assert.deepEqual(original, { raspberry: 1 });
  assert.deepEqual(next, { raspberry: 1, tropical: 2 });
  assert.equal(summarizeCart(next).sachetCount, 75);
  assert.deepEqual(updateCart(next, 'raspberry', 0), { tropical: 2 });
});
test('invalid quantities and unknown products cannot enter the bag', () => {
  for (const quantity of [-1, 100, 1.5, NaN, Infinity, '2', null]) assert.throws(() => updateCart({}, 'raspberry', quantity));
  for (const id of ['mixed', '__proto__', 'constructor', undefined]) assert.throws(() => updateCart({}, id, 1));
  assert.deepEqual(updateCart({}, 'raspberry', 99), { raspberry: 99 });
});
test('damaged or modified browser storage cannot inject invalid products or quantities', () => {
  for (const raw of [null, 'null', '[]', 'bad JSON', '5', '"x"']) assert.deepEqual(restoreCart(raw), {});
  assert.deepEqual(restoreCart('{"raspberry":2,"tropical":100,"mixed":1,"__proto__":{"test":1}}'), { raspberry: 2 });
  assert.deepEqual(restoreCart('{"raspberry":"2","tropical":1.5}'), {});
});
test('unconfirmed prices remain unknown, while an empty bag is zero', () => {
  const summary = summarizeCart({ raspberry: 1, tropical: 1 });
  assert.equal(summary.subtotalCents, null);
  assert.equal(summary.items[0].lineTotalCents, null);
  assert.equal(summary.checkoutAvailable, false);
  assert.equal(summarizeCart({}).subtotalCents, 0);
});
test('money uses integer cents and quantity-dependent totals', () => {
  const testPrices = { raspberry: { ...PRODUCTS.raspberry, priceCents: 1234 }, tropical: { ...PRODUCTS.tropical, priceCents: 2345 } };
  const summary = summarizeCart({ raspberry: 3, tropical: 2 }, testPrices);
  assert.equal(summary.subtotalCents, 8392);
  assert.equal(summary.pouchCount, 5);
  assert.equal(summary.sachetCount, 125);
  assert.equal(money(summary.subtotalCents), '$83.92');
});
test('batch bag replacement validates every item and does not mutate an existing bag on failure', () => {
  const before = { raspberry: 3 };
  let current = before;
  assert.throws(() => { current = replaceCart({ items: [{ id: 'raspberry', quantity: 1 }, { id: 'tropical', quantity: -1 }] }); });
  assert.deepEqual(current, before);
  assert.deepEqual(replaceCart({ items: [{ id: 'tropical', quantity: 2 }] }), { tropical: 2 });
  assert.deepEqual(replaceCart({ items: [] }), {});
  for (const input of [null, {}, [], { items: [], extra: true }, { items: [null] }, { items: [{ id: 'raspberry', quantity: 1 }, { id: 'raspberry', quantity: 2 }] }]) assert.throws(() => replaceCart(input));
});
