const variants = {
  suns: { src: '/assets/sugar-sun-gummies.jpg', alt: 'Two sugar-coated sun gummies with rounded rays and raised centers, one bright red and one bright yellow', announcement: 'Showing bright red and yellow sugar-coated sun gummies.' },
  raspberry: { src: '/assets/raspberry-suns.jpg', alt: 'Mia’s Place Natural Raspberry sour gummy concept: pink pouch and two sachets with the brand name and flavor, alongside red sugar-coated sun gummies', announcement: 'Showing the Natural Raspberry sour gummy packaging concept.' },
  tropical: { src: '/assets/tropical-suns.jpg', alt: 'Mia’s Place Pineapple Orange Guava sour gummy concept: warm golden-yellow pouch and two sachets with the brand name and flavor, alongside yellow sugar-coated sun gummies', announcement: 'Showing the Pineapple Orange Guava sour gummy packaging concept.' }
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
  status.textContent = variant.announcement;
}));

document.querySelectorAll('[data-launch-flavor]').forEach(link => {
  link.addEventListener('click', () => {
    const flavor = link.dataset.launchFlavor;
    const names = { raspberry: 'Natural Raspberry', tropical: 'Pineapple Orange Guava' };
    if (names[flavor]) document.querySelector('#launch-choice').textContent =
      'Your pick: ' + names[flavor] + ' sour gummies.';
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
