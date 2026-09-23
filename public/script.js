import { PRODUCTS, loadCatalog, invalidateCatalog, SUBSCRIPTION, MAX_QUANTITY, CART_KEY, lineKey, unitPrice, updateCart, restoreCart, replaceCart, summarizeCart, money } from './store.mjs';
let catalogAvailable=true;
try { const response=await fetch('/api/catalog',{cache:'no-store',signal:AbortSignal.timeout(8000)}); if(!response.ok)throw new Error('Catalog unavailable'); const data=await response.json(); loadCatalog(data.products); } catch { catalogAvailable=false; invalidateCatalog(); }
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
  document.querySelectorAll('.purchase-form input[name=quantity]').forEach(input => input.setCustomValidity(''));
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
    const modeLabel = item.purchaseMode === 'subscription' ? 'Subscription · every 30 days' : 'One-time purchase';
    details.append(element('p', 'cart-item-mode', modeLabel));
    if(!item.available)details.append(element('p','cart-item-mode','Currently unavailable · remove or reduce this item'));
    details.append(element('p', 'cart-line-price', item.lineTotalCents === null ? 'Price unavailable' : money(item.lineTotalCents)));
    const controls = element('div', 'cart-item-controls');
    const quantity = element('div', 'quantity-control');
    [-1, 1].forEach((step, index) => {
      const button = element('button', '', step === -1 ? '−' : '+');
      button.type = 'button';
      button.setAttribute('aria-label', `${step < 0 ? 'One fewer' : 'One more'} ${item.name} ${item.purchaseMode} pouch`);
      button.dataset.cartAction = `${item.key}-${step}`;
      button.disabled = step === 1 && (item.quantity === MAX_QUANTITY || !item.available);
      button.addEventListener('click', () => {
        const focusKey = button.dataset.cartAction;
        setQuantity(item.id, item.quantity + step, item.purchaseMode);
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
    remove.dataset.cartAction = `${item.key}-remove`;
    remove.setAttribute('aria-label', `Remove ${item.name} ${item.purchaseMode} pouches from your bag`);
    remove.addEventListener('click', () => {
      setQuantity(item.id, 0, item.purchaseMode);
      (cartItems.querySelector('button') || document.querySelector('#cart-empty button')).focus();
    });
    controls.append(quantity, remove);
    details.append(controls);
    row.append(image, details);
    cartItems.append(row);
  });
  document.querySelector('#cart-subtotal').textContent = summary.subtotalCents === null ? 'Contains unavailable items' : money(summary.subtotalCents);
  document.querySelector('#cart-subtotal-label').textContent = summary.hasSubscription ? 'First order subtotal' : 'Subtotal';
  document.querySelector('#cart-recurring').hidden = !summary.hasSubscription;
  document.querySelector('#cart-renewal-note').hidden = !summary.hasSubscription;
  document.querySelector('#cart-recurring-subtotal').textContent = summary.recurringSubtotalCents === null ? 'Contains unavailable items' : money(summary.recurringSubtotalCents);
  const savings = document.querySelector('#cart-savings');
  savings.hidden = !(summary.savingsCents > 0);
  savings.textContent = summary.savingsCents > 0 ? `You save ${money(summary.savingsCents)} with Subscribe & Save.` : '';
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
function setQuantity(id, quantity, purchaseMode = 'one-time') {
  const summary = commitCart(updateCart(cart, id, quantity, purchaseMode));
  status.textContent = quantity === 0 ? `${PRODUCTS[id].name} ${purchaseMode} removed from your bag.` : `${quantity} ${PRODUCTS[id].name} ${purchaseMode} pouches in your bag. No order or subscription has been created.`;
  return summary;
}
document.querySelectorAll('.purchase-form').forEach(form => {
  const id = form.dataset.product;
  const input = form.querySelector('input[name=quantity]');
  const product = PRODUCTS[id];
  const card=form.closest('.product-card');
  if(product.published===false){card.hidden=true;return;}
  if(catalogAvailable)card.querySelector('h3').textContent=product.name;
  if(catalogAvailable && product.description)card.querySelector('[data-product-description]').textContent=product.description;
  const selectedMode = () => form.querySelector('input[type=radio]:checked').value;
  const showPurchaseMode = () => {
    const mode = selectedMode();
    const price = mode==='subscription'?product.subscriptionPriceCents:product.priceCents;
    document.querySelector(`[data-price="${id}"]`).textContent = money(price);
    document.querySelector(`[data-per-serving="${id}"]`).textContent = `${money(price / 25)} per sachet`;
    form.querySelector('[data-once-price]').textContent = money(product.priceCents);
    form.querySelector('[data-savings]').textContent = money(product.priceCents - product.subscriptionPriceCents);
    form.querySelector('[data-subscription-price]').firstChild.textContent = money(product.subscriptionPriceCents);
    form.querySelector('[data-renewal-price]').textContent = money(product.subscriptionPriceCents);
    form.querySelector('.plan-terms').hidden = mode !== 'subscription';
    input.setCustomValidity('');
  };
  form.querySelectorAll('input[type=radio]').forEach(radio => radio.addEventListener('change', showPurchaseMode));
  if(catalogAvailable)showPurchaseMode();
  else form.querySelectorAll('input[type=radio]').forEach(radio=>{radio.disabled=true;});
  form.querySelector('[type="submit"]').disabled = !catalogAvailable || product.inStock===false;
  if(!catalogAvailable || product.inStock===false){form.querySelector('[type="submit"]').textContent=catalogAvailable?'Out of stock':'Catalog unavailable';card.querySelector('.product-availability').textContent=catalogAvailable?'This flavor is currently out of stock.':'Please refresh to load current product information.';}
  form.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    const current = Number.isInteger(input.valueAsNumber) ? input.valueAsNumber : 1;
    input.value = String(Math.min(MAX_QUANTITY, Math.max(1, current + Number(button.dataset.step))));
    input.setCustomValidity('');
  }));
  input.addEventListener('input', () => input.setCustomValidity(''));
  form.addEventListener('submit', event => {
    event.preventDefault();
    input.setCustomValidity('');
    if (!catalogAvailable || product.inStock===false || product.published===false || !form.reportValidity()) return;
    const mode = selectedMode();
    const quantity = input.valueAsNumber + (cart[lineKey(id, mode)] || 0);
    if (quantity > MAX_QUANTITY) {
      input.setCustomValidity('Your bag can hold up to 99 pouches of each flavor per purchase option.');
      input.reportValidity();
      return;
    }
    setQuantity(id, quantity, mode);
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
  const readBag = () => ({ catalogAvailable, products: Object.values(PRODUCTS).filter(product=>product.published!==false).map(product => ({ id: product.id, name: product.name, priceCents: product.priceCents, subscriptionPriceCents: unitPrice(product, 'subscription'), sachetsPerPouch: 25, gummiesPerSachet: 8, gramsPerSachet: 20, totalSugarsGramsPerSachet: 1, gramsPerPouch: 500 })), subscription: SUBSCRIPTION, ...summarizeCart(cart) });
  const definitions = [
    {
      name: 'read_shopping_bag', title: 'Read Sunnybunch shopping bag',
      description: 'Read flavors, purchase modes, prices, first-order and recurring subtotals, subscription interval, and checkout availability. Does not change the bag or place an order.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('No parameters are accepted.');
        return readBag();
      }
    },
    {
      name: 'replace_shopping_bag', title: 'Set Sunnybunch shopping bag',
      description: 'Replace the entire device-local bag and open it for review. Each flavor can have one one-time line and one subscription line. purchaseMode defaults to one-time; choose subscription only when explicitly requested. Subscriptions repeat every 30 days, with shipping and tax extra each delivery. Omitted lines are removed; an empty list clears the bag. This only stages a purchase: no checkout, payment, order or subscription is created.',
      inputSchema: { type: 'object', properties: { items: { type: 'array', maxItems: 4, items: { type: 'object', properties: { id: { type: 'string', enum: ['raspberry', 'tropical'] }, quantity: { type: 'integer', minimum: 0, maximum: 99 }, purchaseMode: { type: 'string', enum: ['one-time', 'subscription'], default: 'one-time' } }, required: ['id', 'quantity'], additionalProperties: false } } }, required: ['items'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if(!catalogAvailable)throw new Error('The current catalog is unavailable.');
        for(const item of input?.items||[]){if(item.quantity>0&&(PRODUCTS[item.id]?.published===false||PRODUCTS[item.id]?.inStock===false))throw new Error('This flavor is unavailable.');}
        const next = replaceCart(input);
        commitCart(next);
        openCart();
        status.textContent = 'Your shopping bag has been updated. No order or subscription has been created.';
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
