export function visibleCount(width) {
  if (width <= 760) return 1;
  return width <= 1100 ? 3 : 5;
}

export function carouselSlots(length, active, count) {
  const available = Math.min(length, count);
  const visible = available > 0 && available % 2 === 0 ? available - 1 : available;
  const center = Math.floor(visible / 2);
  return Array.from({ length: visible }, (_, slot) => ({
    index: (active + slot - center + length) % length, offset: slot - center,
  }));
}

function safeLink(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function buildCard(item, offset) {
  const card = document.createElement('a');
  card.className = `gallery-card${offset === 0 ? ' is-active' : ''}`;
  const link = safeLink(item.galleryUrl);
  if (link) card.href = link;
  else card.setAttribute('aria-disabled', 'true');
  card.setAttribute('aria-label', `Abrir galeria ${item.title}`);
  if (offset === 0) card.setAttribute('aria-current', 'true');
  const image = document.createElement('img');
  image.src = safeLink(item.coverUrl);
  image.alt = item.title;
  image.width = 800;
  image.height = 1200;
  image.decoding = 'async';
  image.loading = offset === 0 ? 'eager' : 'lazy';
  image.addEventListener('error', () => card.classList.add('image-unavailable'));
  const label = document.createElement('span');
  label.className = 'gallery-label';
  label.textContent = item.title;
  card.append(image, label);
  return card;
}

function bindGestures(stage, move) {
  let touchX = null;
  let suppressClick = false;
  stage.addEventListener('touchstart', (event) => { touchX = event.changedTouches[0].clientX; suppressClick = false; }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(delta) < 45) return;
    suppressClick = true;
    move(delta < 0 ? 1 : -1);
  }, { passive: true });
  stage.addEventListener('click', (event) => {
    if (suppressClick) { event.preventDefault(); suppressClick = false; }
  }, true);
}

export function createCarousel(region, input) {
  const items = Array.isArray(input) ? input.slice(0, 10) : [];
  const stage = region.querySelector('#portfolioTrack');
  const previous = region.querySelector('#carouselPrev');
  const next = region.querySelector('#carouselNext');
  const status = region.querySelector('#carouselStatus');
  let active = 0;
  function render() {
    const count = visibleCount(window.innerWidth);
    const slots = carouselSlots(items.length, active, count);
    stage.style.setProperty('--visible', Math.max(1, slots.length));
    stage.replaceChildren(...slots.map(({ index, offset }) => buildCard(items[index], offset)));
    previous.disabled = items.length < 2;
    next.disabled = items.length < 2;
    status.textContent = items.length ? `${active + 1} / ${items.length} · ${items[active].title}` : 'Nenhuma galeria disponível';
  }
  function move(delta) {
    if (!items.length) return;
    active = (active + delta + items.length) % items.length;
    render();
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  region.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
    stage.querySelector('.is-active')?.focus();
  });
  bindGestures(stage, move);
  window.addEventListener('resize', render);
  render();
  return { move, render };
}
