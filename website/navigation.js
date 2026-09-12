const THEME_KEY = 'erick-theme';

function readStoredTheme() {
  try {
    const value = window.localStorage?.getItem(THEME_KEY);
    return value === 'dark' || value === 'light' ? value : '';
  } catch { return ''; }
}

function saveTheme(theme) {
  try { window.localStorage?.setItem(THEME_KEY, theme); } catch { /* Storage may be disabled. */ }
}

function initializeTheme(document) {
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  let storedTheme = readStoredTheme();
  const applyTheme = (theme) => {
    const dark = theme === 'dark';
    root.classList.toggle('dark', dark);
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
      button.setAttribute('aria-pressed', String(dark));
      button.textContent = dark ? '☀️' : '🌙';
    });
  };
  const systemTheme = () => media?.matches ? 'dark' : 'light';
  applyTheme(storedTheme || systemTheme());

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      storedTheme = root.classList.contains('dark') ? 'light' : 'dark';
      saveTheme(storedTheme);
      applyTheme(storedTheme);
    });
  });

  media?.addEventListener?.('change', (event) => {
    if (!storedTheme) applyTheme(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_KEY) return;
    storedTheme = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : '';
    applyTheme(storedTheme || systemTheme());
  });

}

export { initializeTheme };

function initializeMenus(document) {
  const menuToggle = document.querySelector('#menuToggle');
  const mobileMenu = document.querySelector('#mobileMenu');
  const closeMobile = () => {
    if (!menuToggle || !mobileMenu) return;
    mobileMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  };
  menuToggle?.addEventListener('click', () => {
    const open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('#mobileMenu a').forEach((link) => link.addEventListener('click', closeMobile));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobile();
  });

}

export function initializeNavigation(document) {
  initializeTheme(document);
  initializeMenus(document);
  const scrollTop = document.querySelector('#scrollTop');
  const syncScrollTop = () => {
    if (!scrollTop) return;
    const visible = window.scrollY > 520;
    scrollTop.classList.toggle('is-visible', visible);
    scrollTop.tabIndex = visible ? 0 : -1;
  };
  window.addEventListener('scroll', syncScrollTop, { passive: true });
  syncScrollTop();
  scrollTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  document.querySelectorAll('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });
}
