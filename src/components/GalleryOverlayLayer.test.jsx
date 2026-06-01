import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GalleryOverlayLayer } from './GalleryOverlayLayer';

describe('GalleryOverlayLayer', () => {
  it('renders image layer when overlay metadata is active', () => {
    render(
      <GalleryOverlayLayer
        settings={{
          enabled: true,
          kind: 'image',
          assetUrl: '/api/share-session/token/overlay/asset?access_token=ok',
          x: 0.25,
          y: 0.75,
          widthRatio: 0.4,
          opacity: 0.8,
        }}
      />
    );

    const image = document.querySelector('.gallery-client-overlay img');
    expect(image).toHaveAttribute('src', expect.stringContaining('/overlay/asset'));
    expect(image).toHaveStyle({ left: '25%', top: '75%', width: '40%', opacity: '0.8' });
  });

  it('does not render without active image metadata', () => {
    const { container } = render(<GalleryOverlayLayer settings={{ enabled: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses orientation-specific placement when available', () => {
    render(
      <GalleryOverlayLayer
        orientation="portrait"
        settings={{
          enabled: true,
          kind: 'image',
          assetUrl: '/api/share-session/token/overlay/asset?access_token=ok',
          portrait: { x: 0.1, y: 0.9, widthRatio: 0.5, opacity: 0.7 },
          landscape: { x: 0.9, y: 0.1, widthRatio: 0.2, opacity: 0.4 },
        }}
      />
    );

    const image = document.querySelector('.gallery-client-overlay img');
    expect(image).toHaveStyle({ left: '10%', top: '90%', width: '50%', opacity: '0.7' });
  });
});
