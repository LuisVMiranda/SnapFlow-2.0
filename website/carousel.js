export function visibleCount(width) {
  if (width <= 760) return 1;
  return width <= 1100 ? 3 : 4;
}

export function carouselSlots(length, active, count) {
  const visible = Math.min(length, count);
  return Array.from({ length: visible }, (_, slot) => ({
    index: (active + slot) % length, offset: slot,
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
  image.loading = 'eager';
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
  let moving = false;
  function draw(start, requestedCount) {
    const slots = carouselSlots(items.length, start, requestedCount);
    stage.replaceChildren(...slots.map(({ index, offset }) => buildCard(items[index], offset)));
    return slots;
  }
  function render() {
    const count = visibleCount(window.innerWidth);
    region.style.setProperty('--visible', count);
    stage.classList.toggle('is-static', items.length <= count);
    if (items.length <= count) active = 0;
    draw(active, count);
    previous.disabled = items.length <= count;
    next.disabled = items.length <= count;
    status.textContent = items.length ? `${active + 1} / ${items.length} · ${items[active].title}` : 'Nenhuma galeria disponível';
  }
  function finishMove(nextActive, focusAfter) {
    active = nextActive;
    moving = false;
    render();
    if (focusAfter) stage.querySelector('.is-active')?.focus();
  }
  function prefersStaticMovement() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || typeof stage.animate !== 'function';
  }
  function move(delta, focusAfter = false) {
    const count = visibleCount(window.innerWidth);
    if (items.length <= count || moving) return;
    const nextActive = (active + delta + items.length) % items.length;
    if (prefersStaticMovement()) {
      finishMove(nextActive, focusAfter);
      return;
    }
    moving = true;
    const distance = 100 / count;
    const forward = delta > 0;
    draw(forward ? active : nextActive, count + 1);
    const frames = forward
      ? [{ transform: 'translateX(0)' }, { transform: `translateX(-${distance}%)` }]
      : [{ transform: `translateX(-${distance}%)` }, { transform: 'translateX(0)' }];
    stage.animate(frames, { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' }).finished
      .catch(() => undefined)
      .then(() => finishMove(nextActive, focusAfter));
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  region.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1, true);
  });
  bindGestures(stage, move);
  window.addEventListener('resize', render);
  render();
  return { move, render };
}
