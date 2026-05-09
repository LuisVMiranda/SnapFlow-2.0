import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WatermarkSettingsPanel } from './WatermarkSettingsPanel';

describe('WatermarkSettingsPanel', () => {
  it('renders watermark controls and a repeated SnapFlow preview', () => {
    render(
      <WatermarkSettingsPanel
        onSave={vi.fn()}
        settings={{ width: 360, height: 120, opacity: 0.4, instances: 3 }}
        status="idle"
      />
    );

    expect(screen.getByText("Marca d'água das prévias")).toBeInTheDocument();
    expect(screen.getByLabelText("Prévia da marca d'água")).toBeInTheDocument();
    expect(screen.getAllByText('SnapFlow')).toHaveLength(3);
    expect(screen.getByDisplayValue('360')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('saves normalized watermark settings once', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);

    render(
      <WatermarkSettingsPanel
        onSave={onSave}
        settings={{ width: 420, height: 140, opacity: 0.55, instances: 1 }}
        status="idle"
      />
    );

    fireEvent.change(screen.getByDisplayValue('420'), { target: { value: '500' } });
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '6' } });
    await user.click(screen.getByRole('button', { name: "Salvar marca d'água" }));

    expect(onSave).toHaveBeenCalledWith({
      width: 500,
      height: 140,
      opacity: 0.55,
      instances: 6,
    });
  });
});
