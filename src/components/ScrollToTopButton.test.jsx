import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScrollToTopButton } from './ScrollToTopButton';

describe('ScrollToTopButton', () => {
  it('appears after threshold and smooth scrolls the active container', async () => {
    const scrollTo = vi.fn();
    const container = document.createElement('main');
    container.className = 'dash-main';
    Object.defineProperty(container, 'scrollTop', { value: 320, writable: true });
    container.scrollTo = scrollTo;
    document.body.appendChild(container);

    render(<ScrollToTopButton threshold={100} />);
    container.dispatchEvent(new Event('scroll'));

    const button = await screen.findByRole('button', { name: 'Voltar ao topo' });
    await userEvent.click(button);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    container.remove();
  });
});
