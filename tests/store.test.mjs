import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, unitPrice, lineKey, updateCart, restoreCart, replaceCart, summarizeCart, money } from '../dist/store.mjs';

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
test('unknown prices fail closed, while an empty bag is zero', () => {
  const summary = summarizeCart({ raspberry: 1, tropical: 1 }, { raspberry: { ...PRODUCTS.raspberry, priceCents: null }, tropical: PRODUCTS.tropical });
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


test('subscription discount rounds once per pouch, never on the extended line total', () => {
  assert.equal(unitPrice(PRODUCTS.raspberry, 'one-time'), 2499);
  assert.equal(unitPrice(PRODUCTS.raspberry, 'subscription'), 2249);
  const summary = summarizeCart(updateCart({}, 'raspberry', 2, 'subscription'));
  assert.equal(summary.items[0].unitPriceCents, 2249);
  assert.equal(summary.subtotalCents, 4498);
  assert.equal(summary.recurringSubtotalCents, 4498);
  assert.equal(summary.savingsCents, 500);
  assert.equal(summary.recurringIntervalDays, 30);
  assert.equal(summary.shippingIncluded, false);
  assert.equal(summary.taxIncluded, false);
  assert.equal(summary.checkoutAvailable, false);
  assert.equal(summary.subscriptionBillingAvailable, false);
});
test('one-time and subscription pouches of the same flavor coexist with distinct totals', () => {
  const original = updateCart({}, 'raspberry', 1);
  const mixed = updateCart(original, 'raspberry', 2, 'subscription');
  const summary = summarizeCart(mixed);
  assert.deepEqual(original, { raspberry: 1 });
  assert.equal(summary.items.length, 2);
  assert.equal(summary.subtotalCents, 6997);
  assert.equal(summary.recurringSubtotalCents, 4498);
  assert.equal(summary.pouchCount, 3);
  assert.equal(summary.sachetCount, 75);
  assert.equal(summary.items[0].intervalDays, null);
  assert.equal(summary.items[1].intervalDays, 30);
  const onceOnly = updateCart(mixed, 'raspberry', 0, 'subscription');
  assert.deepEqual(onceOnly, original);
  assert.equal(summarizeCart(onceOnly).recurringSubtotalCents, 0);
  assert.equal(summarizeCart(onceOnly).hasSubscription, false);
  const subscriptionOnly = updateCart(mixed, 'raspberry', 0);
  assert.equal(summarizeCart(subscriptionOnly).subtotalCents, 4498);
});
test('saved legacy bags remain one-time and subscription storage uses only known options', () => {
  const old = restoreCart('{"raspberry":2,"tropical":1}');
  assert.equal(summarizeCart(old).hasSubscription, false);
  assert.equal(summarizeCart(old).subtotalCents, 7497);
  const saved = updateCart(old, 'tropical', 3, 'subscription');
  assert.deepEqual(restoreCart(JSON.stringify(saved)), saved);
  const sanitized = restoreCart('{"raspberry:subscription":2,"tropical:subscription":100,"raspberry:weekly":1,"subscription":true,"priceCents":1}');
  assert.deepEqual(sanitized, { 'raspberry:subscription': 2 });
  assert.equal(summarizeCart(sanitized).subtotalCents, 4498);
});
test('batch edits require valid purchase modes and reject duplicates atomically', () => {
  const input = { items: [
    { id: 'raspberry', quantity: 1 },
    { id: 'raspberry', quantity: 2, purchaseMode: 'subscription' },
    { id: 'tropical', quantity: 3, purchaseMode: 'one-time' },
    { id: 'tropical', quantity: 4, purchaseMode: 'subscription' }
  ] };
  const bag = replaceCart(input);
  assert.equal(summarizeCart(bag).items.length, 4);
  assert.equal(summarizeCart(bag).subtotalCents, 23490);
  assert.equal(summarizeCart(bag).recurringSubtotalCents, 13494);
  assert.throws(() => replaceCart({ items: [...input.items, input.items[0]] }));
  assert.throws(() => replaceCart({ items: [input.items[1], input.items[1]] }));
  for (const mode of ['weekly', '', null, true, '__proto__']) {
    assert.throws(() => updateCart(bag, 'raspberry', 2, mode));
    assert.throws(() => replaceCart({ items: [{ id: 'raspberry', quantity: 2, purchaseMode: mode }] }));
  }
  assert.throws(() => replaceCart({ items: [{ id: 'raspberry', quantity: 1, priceCents: 1 }] }));
  assert.equal(lineKey('raspberry'), 'raspberry');
});
