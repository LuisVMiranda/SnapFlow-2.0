import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoPresetPreview } from './PhotoPresetPreview';
import { PhotoPresetSettingsPanel } from './PhotoPresetSettingsPanel';

const baseProps = {
  createPhotoPreset: vi.fn(),
  deletePhotoPreset: vi.fn(),
  photoPresets: [],
  status: 'idle',
  updatePhotoPreset: vi.fn(),
};

describe('PhotoPresetSettingsPanel', () => {
  it('keeps manual number inputs and sliders synchronized', () => {
    render(<PhotoPresetSettingsPanel {...baseProps} />);

    const exposureNumber = screen.getByRole('spinbutton', { name: 'Valor de Exposição' });
    const exposureSlider = screen.getByRole('slider', { name: 'Slider de Exposição' });

    fireEvent.change(exposureNumber, { target: { value: '1.4' } });
    expect(exposureSlider).toHaveValue('1.4');

    fireEvent.change(exposureSlider, { target: { value: '-0.8' } });
    expect(exposureNumber).toHaveValue(-0.8);
  });

  it('uses a compact icon button to hold the before preview', () => {
    render(<PhotoPresetPreview />);

    const button = screen.getByRole('button', { name: 'Segurar para ver a foto original' });
    const preview = screen.getByLabelText('Prévia do preset');
    const mock = preview.querySelector('.photo-preset-mock');

    expect(button).not.toHaveTextContent('Segurar para ver antes');
    expect(mock).toHaveAttribute('data-before', 'false');

    fireEvent.pointerDown(button);
    expect(mock).toHaveAttribute('data-before', 'true');

    fireEvent.pointerUp(button);
    expect(mock).toHaveAttribute('data-before', 'false');
  });

  it('uses a provided gallery image in the preset preview', () => {
    render(<PhotoPresetPreview imageUrl="/api/media/photo_1/preview" />);

    expect(screen.getByAltText('Prévia da primeira foto da galeria')).toHaveAttribute(
      'src',
      '/api/media/photo_1/preview'
    );
  });
});
