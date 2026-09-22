const variants = {
  sweet: { src: '/assets/sweet-mias-place.jpg', alt: 'Mia’s Place sweet gummy packaging concept: a pink outer pouch with compact individual sachets and colorful gummies' },
  sour: { src: '/assets/sour-mias-place.jpg', alt: 'Mia’s Place sour gummy packaging concept: a yellow outer pouch with compact individual sachets and sour gummies' }
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

document.querySelectorAll('[data-launch-flavor]').forEach(link => {
  link.addEventListener('click', () => {
    const flavor = link.dataset.launchFlavor;
    document.querySelector('#launch-choice').textContent =
      flavor === 'sour' ? 'Your pick: Sour Gummies.' : 'Your pick: Sweet Gummies.';
  });
});

const form = document.querySelector('#launch-form');
const email = document.querySelector('#launch-email');
const submit = form.querySelector('button[type="submit"]');
const feedback = document.querySelector('#signup-status');
submit.disabled = false;
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  feedback.textContent = 'Preview complete. A live signup would confirm your launch updates here. Your email was not sent, saved, or subscribed.';
  feedback.hidden = false;
  email.value = '';
});
email.addEventListener('input', () => {
  feedback.hidden = true;
  feedback.textContent = '';
});

const mobileCta = document.querySelector('.mobile-cta');
const launchSection = document.querySelector('#launch');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    mobileCta.classList.toggle('is-hidden', entries[0].isIntersecting);
  }, { threshold: 0.08 });
  observer.observe(launchSection);
}
