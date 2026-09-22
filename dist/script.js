import { PRODUCTS, MAX_QUANTITY, CART_KEY, updateCart, restoreCart, replaceCart, summarizeCart, money } from './store.mjs';
const variants = {
  suns: { src: '/assets/sugar-sun-gummies.jpg', alt: 'Red and golden-yellow sugar-coated sun gummies with rounded rays and raised centers', announcement: 'Showing the sugar-coated gummy suns.' },
  raspberry: { src: PRODUCTS.raspberry.image, alt: 'Sunnybunch Natural Raspberry in matte pink packaging, with red sugar-coated sun gummies', announcement: 'Showing Natural Raspberry.' },
  tropical: { src: PRODUCTS.tropical.image, alt: 'Sunnybunch Pineapple Orange Guava in matte golden-yellow packaging, with yellow sugar-coated sun gummies', announcement: 'Showing Pineapple Orange Guava.' }
};
document.querySelectorAll('[data-flavor].flavor-button').forEach(button => {
  button.addEventListener('click', () => {
    const variant = variants[button.dataset.flavor];
    const image = document.querySelector('#hero-product');
    image.src = variant.src;
    image.alt = variant.alt;
    document.querySelector('.hero-visual').dataset.flavor = button.dataset.flavor;
    document.querySelectorAll('.flavor-button').forEach(control => {
      const selected = control === button;
      control.classList.toggle('active', selected);
      control.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('#flavor-status').textContent = variant.announcement;
  });
});
let cart = {};
let storageAvailable = true;
try { cart = restoreCart(localStorage.getItem(CART_KEY)); }
catch { storageAvailable = false; }
const dialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const status = document.querySelector('#cart-status');
let savedScrollY = 0;
function openCart() {
  if (dialog.open) return;
  savedScrollY = window.scrollY;
  document.body.style.top = `-${savedScrollY}px`;
  document.body.classList.add('cart-is-open');
  dialog.showModal();
}
function closeCart() { dialog.close(); }
dialog.addEventListener('close', () => {
  document.body.classList.remove('cart-is-open');
  document.body.style.top = '';
  window.scrollTo({ top: savedScrollY, behavior: 'instant' });
});
document.querySelectorAll('[data-open-cart]').forEach(button => {
  button.disabled = false;
  button.addEventListener('click', openCart);
});
document.querySelectorAll('[data-close-cart]').forEach(button => button.addEventListener('click', closeCart));
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeCart();
});
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderCart() {
  const focusKey = cartItems.contains(document.activeElement) ? document.activeElement.dataset.cartAction : null;
  document.querySelectorAll('.purchase-form input').forEach(input => input.setCustomValidity(''));
  const summary = summarizeCart(cart);
  document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(summary.pouchCount); });
  document.querySelectorAll('[data-open-cart]').forEach(node => node.setAttribute('aria-label', `Open shopping bag, ${summary.pouchCount} pouches`));
  document.querySelector('#cart-empty').hidden = summary.pouchCount > 0;
  document.querySelector('#cart-content').hidden = summary.pouchCount === 0;
  cartItems.replaceChildren();
  summary.items.forEach(item => {
    const row = element('article', 'cart-item');
    const image = element('img');
    image.src = PRODUCTS[item.id].image;
    image.alt = item.name + ' pouch';
    image.width = 100;
    image.height = 100;
    const details = element('div', 'cart-item-details');
    details.append(element('h3', '', item.name), element('p', 'cart-item-size', '25 × 20 g sachets · 500 g total'));
    details.append(element('p', 'cart-line-price', item.lineTotalCents === null ? 'Price to be confirmed' : money(item.lineTotalCents)));
    const controls = element('div', 'cart-item-controls');
    const quantity = element('div', 'quantity-control');
    [-1, 1].forEach((step, index) => {
      const button = element('button', '', step === -1 ? '−' : '+');
      button.type = 'button';
      button.setAttribute('aria-label', `${step < 0 ? 'One fewer' : 'One more'} ${item.name} pouch`);
      button.dataset.cartAction = `${item.id}-${step}`;
      button.disabled = step === 1 && item.quantity === MAX_QUANTITY;
      button.addEventListener('click', () => {
        const focusKey = button.dataset.cartAction;
        setQuantity(item.id, item.quantity + step);
        const target = [...cartItems.querySelectorAll('[data-cart-action]')].find(control => control.dataset.cartAction === focusKey && !control.disabled);
        (target || cartItems.querySelector('button') || document.querySelector('#cart-empty button')).focus();
      });
      if (index === 1) {
        const count = element('span', '', String(item.quantity));
        count.setAttribute('aria-label', `${item.quantity} pouches`);
        quantity.append(count);
      }
      quantity.append(button);
    });
    const remove = element('button', 'remove-item', 'Remove');
    remove.type = 'button';
    remove.dataset.cartAction = `${item.id}-remove`;
    remove.setAttribute('aria-label', `Remove ${item.name} from your bag`);
    remove.addEventListener('click', () => {
      setQuantity(item.id, 0);
      (cartItems.querySelector('button') || document.querySelector('#cart-empty button')).focus();
    });
    controls.append(quantity, remove);
    details.append(controls);
    row.append(image, details);
    cartItems.append(row);
  });
  document.querySelector('#cart-subtotal').textContent = summary.subtotalCents === null ? 'Awaiting prices' : money(summary.subtotalCents);
  document.querySelector('.cart-storage-note').textContent = storageAvailable ? 'Your bag is saved in this browser only.' : 'Your bag is kept for this visit only.';
  if (focusKey && dialog.open) {
    const target = [...cartItems.querySelectorAll('[data-cart-action]')].find(control => control.dataset.cartAction === focusKey && !control.disabled);
    (target || cartItems.querySelector('button') || document.querySelector('#cart-empty button')).focus();
  }
}
function commitCart(next) {
  cart = next;
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  catch { storageAvailable = false; }
  renderCart();
  return summarizeCart(cart);
}
function setQuantity(id, quantity) {
  const summary = commitCart(updateCart(cart, id, quantity));
  status.textContent = quantity === 0 ? `${PRODUCTS[id].name} removed from your bag.` : `${quantity} ${PRODUCTS[id].name} pouches in your bag.`;
  return summary;
}
document.querySelectorAll('.purchase-form').forEach(form => {
  const id = form.dataset.product;
  const input = form.querySelector('input');
  const product = PRODUCTS[id];
  if (product.priceCents !== null) {
    document.querySelector(`[data-price="${id}"]`).textContent = money(product.priceCents);
    document.querySelector(`[data-per-serving="${id}"]`).textContent = `${money(product.priceCents / 25)} per sachet`;
  }
  form.querySelector('[type="submit"]').disabled = false;
  form.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    const current = Number.isInteger(input.valueAsNumber) ? input.valueAsNumber : 1;
    input.value = String(Math.min(MAX_QUANTITY, Math.max(1, current + Number(button.dataset.step))));
    input.setCustomValidity('');
  }));
  input.addEventListener('input', () => input.setCustomValidity(''));
  form.addEventListener('submit', event => {
    event.preventDefault();
    input.setCustomValidity('');
    if (!form.reportValidity()) return;
    const quantity = input.valueAsNumber + (cart[id] || 0);
    if (quantity > MAX_QUANTITY) {
      input.setCustomValidity('Your bag can hold up to 99 pouches of each flavor.');
      input.reportValidity();
      return;
    }
    setQuantity(id, quantity);
    openCart();
  });
});
window.addEventListener('storage', event => {
  if (event.key === CART_KEY || event.key === null) { cart = restoreCart(event.key === null ? null : event.newValue); renderCart(); }
});
renderCart();

// Optional browser-native agent interface. Cart edits never place an order.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const readBag = () => ({ products: Object.values(PRODUCTS).map(({ id, name, priceCents }) => ({ id, name, priceCents, sachetsPerPouch: 25, gummiesPerSachet: 8, gramsPerSachet: 20, gramsPerPouch: 500 })), ...summarizeCart(cart) });
  const definitions = [
    {
      name: 'read_shopping_bag', title: 'Read Sunnybunch shopping bag',
      description: 'Read the two available flavors, current bag quantities, known prices and checkout availability. Does not change the bag or place an order.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('No parameters are accepted.');
        return readBag();
      }
    },
    {
      name: 'replace_shopping_bag', title: 'Set Sunnybunch shopping bag',
      description: 'Replace the entire device-local shopping bag with these flavor quantities and open it for review. Omitted flavors are removed; an empty list clears the bag. This only stages a purchase: no checkout, payment or order is created.',
      inputSchema: { type: 'object', properties: { items: { type: 'array', maxItems: 2, items: { type: 'object', properties: { id: { type: 'string', enum: ['raspberry', 'tropical'] }, quantity: { type: 'integer', minimum: 0, maximum: 99 } }, required: ['id', 'quantity'], additionalProperties: false } } }, required: ['items'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const next = replaceCart(input);
        commitCart(next);
        openCart();
        status.textContent = 'Your shopping bag has been updated. No order has been placed.';
        return readBag();
      }
    }
  ];
  for (const definition of definitions) {
    try {
      Promise.resolve(document.modelContext.registerTool(definition, { signal: lifecycle.signal })).catch(() => lifecycle.abort());
    } catch { lifecycle.abort(); }
  }
  window.addEventListener('pagehide', event => { if (!event.persisted) lifecycle.abort(); });
}
