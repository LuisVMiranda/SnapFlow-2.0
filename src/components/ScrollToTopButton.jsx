import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

function activeScrollContainer() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.dash-main') || document.querySelector('.screen') || window;
}

function scrollTopFor(target) {
  if (!target) return 0;
  if (target === window) return window.scrollY || document.documentElement.scrollTop || 0;
  return target.scrollTop || 0;
}

export function ScrollToTopButton({ threshold = 240 }) {
  const [container, setContainer] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = activeScrollContainer();
    setContainer(target);
    if (!target) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(scrollTopFor(target) > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [threshold]);

  const scrollToTop = () => {
    const target = container || activeScrollContainer();
    if (!target) return;
    target.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      className={`scroll-top-button ${visible ? 'visible' : ''}`}
      type="button"
      aria-label="Voltar ao topo"
      onClick={scrollToTop}
    >
      <ArrowUp size={18} />
    </button>
  );
}
