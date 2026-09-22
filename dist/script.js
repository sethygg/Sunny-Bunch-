const variants = {
  sweet: { src: '/assets/sweet-format-v2.png', alt: 'Concept packaging: a pink Little Good sweet gummy outer pouch with compact individual sachets and colorful gummies' },
  sour: { src: '/assets/sour-format-v2.png', alt: 'Concept packaging: a yellow Little Good sour gummy outer pouch with compact individual sachets and sour gummies' }
};
const buttons = document.querySelectorAll('.flavor-button');
const product = document.querySelector('#hero-product');
const visual = document.querySelector('.hero-visual');
const status = document.querySelector('#flavor-status');
buttons.forEach(button => button.addEventListener('click', () => {
  const flavor = button.dataset.flavor;
  const variant = variants[flavor];
  if (!variant) return;
  product.src = variant.src;
  product.alt = variant.alt;
  visual.dataset.flavor = flavor;
  buttons.forEach(item => {
    const selected = item === button;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  status.textContent = 'Showing ' + flavor + ' gummy concept.';
}));
