import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoViewer } from './PhotoViewer';

describe('PhotoViewer', () => {
  it('does not render a second client overlay outside server-processed preview image', () => {
    const { container } = render(
      <PhotoViewer
        brokenPhotoIds={[]}
        count={1}
        currentPhoto={{ id: 'photo_1', url: '/preview.jpg' }}
        markBrokenPhoto={vi.fn()}
        overlaySettings={{
          enabled: true,
          kind: 'image',
          assetUrl: '/overlay.png',
          portrait: { x: 0.5, y: 0.5, widthRatio: 0.4, opacity: 1 },
        }}
        photos={[{ id: 'photo_1', url: '/preview.jpg' }]}
        selected={['photo_1']}
        setViewerIndex={vi.fn()}
        shareToken="share_1"
        toggle={vi.fn()}
        total={15}
        watermarkSettings={{ instances: 1, opacity: 0.4, width: 300, height: 120 }}
      />
    );

    expect(container.querySelector('.gallery-client-overlay')).toBeNull();
  });
});
