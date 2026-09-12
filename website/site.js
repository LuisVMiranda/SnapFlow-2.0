import { initializeNavigation } from './navigation.js';
import { createCarousel } from './carousel.js';
import { initializeContact } from './contact.js';

initializeNavigation(document);
const contact = initializeContact(document);
const region = document.querySelector('#galleryCarousel');
const feedback = document.querySelector('#galleryFeedback');

async function loadWebsite() {
  if (!region) return;
  try {
    const response = await fetch('/api/website', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Website indisponível');
    const data = await response.json();
    createCarousel(region, data.galleries);
    contact.configure(data.contact);
    feedback.textContent = data.galleries.length ? '' : 'Novas galerias em breve. Entre em contato para encontrar suas fotos.';
  } catch {
    region.querySelector('#carouselStatus').textContent = 'Galerias temporariamente indisponíveis';
    feedback.textContent = 'Não foi possível carregar as galerias. Tente atualizar a página em alguns instantes.';
    contact.configure({ enabled: false });
  }
}
loadWebsite();
