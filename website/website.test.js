import fs from 'node:fs';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { carouselSlots, createCarousel, visibleCount } from './carousel';
import { contactUrl, initializeContact, CONTACT_REASONS } from './contact';
import { initializeTheme } from './navigation';

const home = fs.readFileSync('website/index.html', 'utf8');
const about = fs.readFileSync('website/sobre.html', 'utf8');
const items = Array.from({ length: 10 }, (_, i) => ({ title: `Evento ${i}`, galleryUrl: `https://gallery.test/s/g${i}`, coverUrl: `/cover${i}.webp` }));
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

function linksIn(html, className) {
  const match = html.match(new RegExp(`<div class="${className}"[^>]*>([\\s\\S]*?)</div>`));
  return [...(match?.[1] || '').matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([, href, label]) => ({ href, label: label.trim() }));
}

describe('public website', () => {
  it('preserves leading position, uniqueness and valid indices across randomized carousel states', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 10 }), fc.nat(1000), fc.constantFrom(1, 3, 5), (length, turn, count) => {
      const active = turn % length;
      const slots = carouselSlots(length, active, count);
      expect(new Set(slots.map((slot) => slot.index)).size).toBe(slots.length);
      expect(slots[0].index).toBe(active);
      expect(slots[0].offset).toBe(0);
      expect(slots.every((slot) => slot.index >= 0 && slot.index < length)).toBe(true);
    }), { seed: 7351023 });
  });
  it('uses up to 5/3/1 contiguous cards in gallery order with circular navigation', () => {
    expect([1400, 900, 390].map(visibleCount)).toEqual([5, 3, 1]);
    for (let length = 1; length <= 10; length++) {
      const slots = carouselSlots(length, 0, 5);
      expect(slots).toHaveLength(Math.min(length, 5));
      expect(new Set(slots.map((slot) => slot.index)).size).toBe(slots.length);
      expect(slots.map((slot) => slot.index)).toEqual(Array.from({ length: Math.min(length, 5) }, (_, index) => index));
    }
    document.body.innerHTML = home;
    vi.stubGlobal('innerWidth', 1400);
    const region = document.querySelector('#galleryCarousel');
    const carousel = createCarousel(region, items);
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(5);
    expect([...region.querySelectorAll('.gallery-card img')].every((image) => image.loading === 'eager')).toBe(true);
    expect(region.querySelectorAll('.gallery-card')[0]).toHaveAttribute('aria-current', 'true');
    region.querySelector('#carouselPrev').click();
    expect(region.querySelector('.is-active')).toHaveAttribute('href', 'https://gallery.test/s/g9');
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toHaveAttribute('aria-label', 'Abrir galeria Evento 0');
    vi.stubGlobal('innerWidth', 900); carousel.render();
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(3);
    vi.stubGlobal('innerWidth', 390); carousel.render();
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(1);
  });

  it('keeps every available cover visible up to the responsive limit without card gaps or borders', () => {
    document.body.innerHTML = home;
    vi.stubGlobal('innerWidth', 1400);
    const region = document.querySelector('#galleryCarousel');
    createCarousel(region, items.slice(0, 4));
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(4);
    expect(region.querySelector('#carouselPrev')).toBeDisabled();
    const styles = fs.readFileSync('website/site.css', 'utf8');
    expect(styles).toMatch(/\.gallery-stage\s*\{[^}]*gap:\s*0[;}]/s);
    expect(styles).toMatch(/\.gallery-stage\s*\{[^}]*width:\s*100%[;}]/s);
    expect(styles).toMatch(/\.gallery-hero\s*\{[^}]*padding:\s*calc\(5rem \+ 50px\)/s);
    expect(styles).toMatch(/\.carousel-controls\s*\{[^}]*position:\s*absolute[;}]/s);
    expect(styles).toMatch(/\.carousel-arrow\s*\{[^}]*background:\s*rgb\([^)]*\/\s*\.\d+\)[;}]/s);
    expect(styles).toMatch(/\.gallery-card::after\s*\{[^}]*inset:\s*4px[;}][^}]*border:\s*1px solid rgb\(255 255 255 \/ \.68\)[^}]*opacity:\s*0[;}]/s);
    expect(styles).toMatch(/\.gallery-card:hover::after[^}]*\{\s*opacity:\s*1[;}]/s);
    expect(styles).not.toMatch(/\.gallery-card\.is-active\s*\{/);
  });

  it('animates one full card into view when an arrow is used', async () => {
    document.body.innerHTML = home;
    vi.stubGlobal('innerWidth', 1400);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const region = document.querySelector('#galleryCarousel');
    const stage = region.querySelector('#portfolioTrack');
    stage.animate = vi.fn(() => ({ finished: Promise.resolve() }));
    createCarousel(region, items);
    region.querySelector('#carouselNext').click();
    expect(stage.querySelectorAll('.gallery-card')).toHaveLength(6);
    expect(stage.animate).toHaveBeenCalledWith([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-20%)' },
    ], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    await vi.waitFor(() => expect(region.querySelector('.is-active')).toHaveAttribute('href', 'https://gallery.test/s/g1'));
    expect(stage.querySelectorAll('.gallery-card')).toHaveLength(5);
  });

  it.each([1, 2, 4, 5])('preserves five desktop-sized slots with %i available galleries', (length) => {
    document.body.innerHTML = home;
    vi.stubGlobal('innerWidth', 1440);
    const region = document.querySelector('#galleryCarousel');
    const carousel = createCarousel(region, items.slice(0, length));
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(length);
    expect(region.style.getPropertyValue('--visible')).toBe('5');
    expect(region.querySelector('#carouselNext')).toBeDisabled();
    vi.stubGlobal('innerWidth', 390);
    carousel.render();
    expect(region.style.getPropertyValue('--visible')).toBe('1');
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(1);
  });

  it('renders titles as text, supports swipes, and handles broken covers and empty data', () => {
    document.body.innerHTML = home;
    vi.stubGlobal('innerWidth', 390);
    const region = document.querySelector('#galleryCarousel');
    const title = '<img src=x onerror=alert(1)>';
    createCarousel(region, [{ ...items[0], title }, items[1]]);
    expect(region.querySelector('.is-active .gallery-label').textContent).toBe(title);
    expect(region.querySelector('.gallery-label img')).toBeNull();
    const stage = region.querySelector('#portfolioTrack');
    for (const [type, clientX] of [['touchstart', 200], ['touchend', 50]]) {
      const event = new Event(type); Object.defineProperty(event, 'changedTouches', { value: [{ clientX }] }); stage.dispatchEvent(event);
    }
    expect(region.querySelector('.is-active')).toHaveAttribute('aria-label', 'Abrir galeria Evento 1');
    region.querySelector('.is-active img').dispatchEvent(new Event('error'));
    expect(region.querySelector('.is-active')).toHaveClass('image-unavailable');
    createCarousel(region, []);
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(0);
    expect(region.querySelector('#carouselNext')).toBeDisabled();
  });

  it('validates contact and builds the encoded message without sending automatically', () => {
    expect(contactUrl('5582999999999', '  Ana & João  ', CONTACT_REASONS[1])).toContain(encodeURIComponent('Olá! Meu nome é Ana & João. Entro em contato pelo site sobre: Dúvida sobre galeria.'));
    for (const [phone, name, reason] of [['', 'Ana', 'Outro'], ['5582999999999', ' ', 'Outro'], ['5582999999999', 'x'.repeat(81), 'Outro'], ['5582999999999', 'Ana', 'invalid']]) {
      expect(contactUrl(phone, name, reason)).toBe('');
    }
    document.body.innerHTML = home;
    const navigate = vi.fn();
    const contact = initializeContact(document, navigate);
    contact.configure({ enabled: false });
    expect(document.querySelector('#sendContact')).toBeDisabled();
    contact.configure({ enabled: true, phone: '5582999999999', label: 'WhatsApp' });
    const form = document.querySelector('#contactForm');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(navigate).not.toHaveBeenCalled();
    form.elements.nome.value = 'Ana'; form.elements.motivo.value = 'Outro';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(navigate).toHaveBeenCalledWith(contactUrl('5582999999999', 'Ana', 'Outro'));
  });

  it('removes obsolete navigation, sections and hardcoded contact values', () => {
    for (const html of [home, about]) {
      expect(html).not.toMatch(/Comprar fotos|Depoimentos|#comprar|#depoimentos|mailto:/i);
    }
    expect(home).toContain('maxlength="80"');
    expect(home).not.toContain('<div class="hero-heading">');
    expect(home).not.toContain('<h1 id="gallery-title">');
    expect(home).not.toContain('Encontre sua galeria e reviva cada detalhe.');
    expect(home).toContain('<a href="sobre.html#sobre">Sobre</a>');
    expect(about).toContain('<a href="sobre.html#sobre" aria-current="page">Sobre</a>');
    expect(home).not.toContain('>Extra <');
    expect(fs.readFileSync('website/site.css', 'utf8')).toContain('prefers-reduced-motion');
  });

  it('keeps the shared menu order and puts services on the home page', () => {
    const expected = [
      { href: 'index.html#portfolio', label: 'Portfólio' },
      { href: 'index.html#servicos', label: 'Serviços' },
      { href: 'index.html#contato', label: 'Contato' },
      { href: 'sobre.html#sobre', label: 'Sobre' },
    ];
    for (const html of [home, about]) {
      expect(linksIn(html, 'nav-links')).toEqual(expected);
      expect(linksIn(html, 'mobile-menu')).toEqual(expected);
      expect(linksIn(html, 'footer-links')).toEqual(expected);
    }
    expect(home).toMatch(/<section id="portfolio"/);
    expect(home).toMatch(/<section id="servicos"/);
    expect(home).toMatch(/<section id="contato"/);
    expect(about).toMatch(/<section id="sobre"/);
    expect(about).not.toMatch(/<section id="servicos"/);
  });

  it('synchronizes system and cross-tab theme changes until the user chooses a mode', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const listeners = [];
    const media = { matches: false, addEventListener: vi.fn((event, listener) => listeners.push(listener)) };
    const originalStorage = window.localStorage;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => media) });
    document.body.innerHTML = home;
    try {
      initializeTheme(document);
      expect(document.documentElement.dataset.theme).toBe('light');
      media.matches = true; listeners[0]({ matches: true });
      expect(document.documentElement).toHaveClass('dark');
      expect(document.querySelector('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'true');
      document.querySelector('[data-theme-toggle]').click();
      expect(document.documentElement).not.toHaveClass('dark');
      expect(storage.setItem).toHaveBeenCalledWith('erick-theme', 'light');
      listeners[0]({ matches: true });
      expect(document.documentElement).not.toHaveClass('dark');
      window.dispatchEvent(new StorageEvent('storage', { key: 'erick-theme', newValue: 'dark' }));
      expect(document.documentElement).toHaveClass('dark');
      expect(document.querySelector('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'true');
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: originalStorage });
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    }
  });

  it.each([false, true])('shows a helpful empty or API-error state (failure=%s)', async (failure) => {
    vi.resetModules();
    document.body.innerHTML = home;
    vi.stubGlobal('IntersectionObserver', class { observe() {} });
    vi.stubGlobal('fetch', failure ? vi.fn().mockRejectedValue(new Error('offline'))
      : vi.fn().mockResolvedValue({ ok: true, json: async () => ({ galleries: [], contact: { enabled: false } }) }));
    await import('./site.js');
    await vi.waitFor(() => expect(document.querySelector('#galleryFeedback').textContent).toMatch(failure ? /Não foi possível/ : /Novas galerias/));
    expect(document.querySelector('#sendContact')).toBeDisabled();
  });
});
