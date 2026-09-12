import fs from 'node:fs';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { carouselSlots, createCarousel, visibleCount } from './carousel';
import { contactUrl, initializeContact, CONTACT_REASONS } from './contact';

const home = fs.readFileSync('website/index.html', 'utf8');
const about = fs.readFileSync('website/sobre.html', 'utf8');
const items = Array.from({ length: 10 }, (_, i) => ({ title: `Evento ${i}`, galleryUrl: `https://gallery.test/s/g${i}`, coverUrl: `/cover${i}.webp` }));
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('public website', () => {
  it('preserves centering, uniqueness and valid indices across randomized carousel states', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 10 }), fc.nat(1000), fc.constantFrom(1, 3, 5), (length, turn, count) => {
      const active = turn % length;
      const slots = carouselSlots(length, active, count);
      expect(new Set(slots.map((slot) => slot.index)).size).toBe(slots.length);
      expect(slots[Math.floor(slots.length / 2)].index).toBe(active);
      expect(slots.every((slot) => slot.index >= 0 && slot.index < length)).toBe(true);
    }), { seed: 7351023 });
  });
  it('uses 5/3/1 unique cards with the initial gallery centered and circular navigation', () => {
    expect([1400, 900, 390].map(visibleCount)).toEqual([5, 3, 1]);
    for (let length = 1; length <= 10; length++) {
      const slots = carouselSlots(length, 0, 5);
      expect(new Set(slots.map((slot) => slot.index)).size).toBe(slots.length);
      expect(slots.find((slot) => slot.offset === 0).index).toBe(0);
    }
    document.body.innerHTML = home;
    vi.stubGlobal('innerWidth', 1400);
    const region = document.querySelector('#galleryCarousel');
    const carousel = createCarousel(region, items);
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(5);
    expect(region.querySelectorAll('.gallery-card')[2]).toHaveAttribute('aria-current', 'true');
    region.querySelector('#carouselPrev').click();
    expect(region.querySelector('.is-active')).toHaveAttribute('href', 'https://gallery.test/s/g9');
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toHaveAttribute('aria-label', 'Abrir galeria Evento 0');
    vi.stubGlobal('innerWidth', 900); carousel.render();
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(3);
    vi.stubGlobal('innerWidth', 390); carousel.render();
    expect(region.querySelectorAll('.gallery-card')).toHaveLength(1);
  });

  it('renders titles as text, supports swipes, and handles broken covers and empty data', () => {
    document.body.innerHTML = home;
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
