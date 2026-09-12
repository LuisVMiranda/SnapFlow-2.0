function initializeTheme(document) {
  const root = document.documentElement;
  const themeKey = 'erick-theme';
  let storedTheme;
  try { storedTheme = localStorage.getItem(themeKey); } catch { storedTheme = ''; }
  if (storedTheme === 'dark' || (!storedTheme && window.matchMedia?.('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  }

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const syncThemeLabel = () => {
      const dark = root.classList.contains('dark');
      button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
      button.textContent = dark ? '☀️' : '🌙';
    };
    syncThemeLabel();
    button.addEventListener('click', () => {
      root.classList.toggle('dark');
      try { localStorage.setItem(themeKey, root.classList.contains('dark') ? 'dark' : 'light'); } catch { /* Storage may be disabled. */ }
      syncThemeLabel();
    });
  });

}

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
