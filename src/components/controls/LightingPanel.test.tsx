/**
 * LightingPanel — reads from + writes to the lightingManager singleton.
 *
 * Manager mocked at the module level. Tests assert that:
 *   - Initial slider state mirrors the manager's current values.
 *   - Slider changes call through to the right manager method.
 *   - Rim-light toggle adds/removes the rim light.
 *   - Rim intensity slider updates the rim light when enabled.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mgrMock = vi.hoisted(() => {
  const ambientLight = { intensity: 0.6 };
  const directionalLight = { intensity: 0.8 };
  return {
    ambientLight,
    directionalLight,
    rimLight: null as { intensity: number } | null,
    previewMode: 'standard' as 'standard' | 'studio',
    whiteBackgroundEnabled: false,
    getAmbientLight: vi.fn(() => ambientLight),
    getDirectionalLight: vi.fn(() => directionalLight),
    getRimLight: vi.fn(() => mgrMock.rimLight),
    getPreviewMode: vi.fn(() => mgrMock.previewMode),
    getWhiteBackgroundEnabled: vi.fn(() => mgrMock.whiteBackgroundEnabled),
    setAmbientIntensity: vi.fn((v: number) => {
      ambientLight.intensity = v;
    }),
    setDirectionalIntensity: vi.fn((v: number) => {
      directionalLight.intensity = v;
    }),
    setPreviewMode: vi.fn((mode: 'standard' | 'studio') => {
      mgrMock.previewMode = mode;
    }),
    setWhiteBackgroundEnabled: vi.fn((enabled: boolean) => {
      mgrMock.whiteBackgroundEnabled = enabled;
    }),
    addRimLight: vi.fn((_color: number, intensity: number) => {
      mgrMock.rimLight = { intensity };
    }),
    removeRimLight: vi.fn(() => {
      mgrMock.rimLight = null;
    }),
  };
});

vi.mock('../../core/three/scene/LightingManager', () => ({
  lightingManager: mgrMock,
}));

import { LightingPanel } from './LightingPanel';

beforeEach(() => {
  mgrMock.ambientLight.intensity = 0.6;
  mgrMock.directionalLight.intensity = 0.8;
  mgrMock.rimLight = null;
  mgrMock.previewMode = 'standard';
  mgrMock.whiteBackgroundEnabled = false;
  mgrMock.getAmbientLight.mockClear();
  mgrMock.getDirectionalLight.mockClear();
  mgrMock.getRimLight.mockClear();
  mgrMock.getPreviewMode.mockClear();
  mgrMock.getWhiteBackgroundEnabled.mockClear();
  mgrMock.setAmbientIntensity.mockClear();
  mgrMock.setDirectionalIntensity.mockClear();
  mgrMock.setPreviewMode.mockClear();
  mgrMock.setWhiteBackgroundEnabled.mockClear();
  mgrMock.addRimLight.mockClear();
  mgrMock.removeRimLight.mockClear();
});

describe('LightingPanel', () => {
  it('initial sliders mirror the manager state', () => {
    mgrMock.ambientLight.intensity = 1.2;
    mgrMock.directionalLight.intensity = 0.4;

    render(<LightingPanel />);

    expect(screen.getByText('1.20')).toBeInTheDocument();
    expect(screen.getByText('0.40')).toBeInTheDocument();
  });

  it('ambient slider calls setAmbientIntensity with the new value', () => {
    render(<LightingPanel />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '1.5' } });
    expect(mgrMock.setAmbientIntensity).toHaveBeenCalledWith(1.5);
  });

  it('directional slider calls setDirectionalIntensity', () => {
    render(<LightingPanel />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[1], { target: { value: '2.0' } });
    expect(mgrMock.setDirectionalIntensity).toHaveBeenCalledWith(2.0);
  });

  it('rim-light checkbox starts unchecked when manager has no rim light', () => {
    render(<LightingPanel />);
    // Rim light is the third checkbox after Studio preview + White background.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[2]).not.toBeChecked();
  });

  it('rim-light checkbox starts checked when manager already has a rim light', () => {
    mgrMock.rimLight = { intensity: 0.7 };
    render(<LightingPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[2]).toBeChecked();
  });

  it('enabling rim light calls addRimLight with the current intensity', () => {
    render(<LightingPanel />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    expect(mgrMock.addRimLight).toHaveBeenCalledWith(0xffffff, 0.5);
  });

  it('disabling rim light calls removeRimLight', () => {
    mgrMock.rimLight = { intensity: 0.5 };
    render(<LightingPanel />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    expect(mgrMock.removeRimLight).toHaveBeenCalled();
  });

  it('rim intensity slider is disabled when rim light is off', () => {
    render(<LightingPanel />);
    const sliders = screen.getAllByRole('slider');
    const rimSlider = sliders[sliders.length - 1];
    expect(rimSlider).toBeDisabled();
  });

  it('rim intensity slider re-applies via addRimLight (replaces) when rim is on', () => {
    mgrMock.rimLight = { intensity: 0.5 };
    render(<LightingPanel />);
    const sliders = screen.getAllByRole('slider');
    const rimSlider = sliders[sliders.length - 1];

    fireEvent.change(rimSlider, { target: { value: '1.2' } });
    expect(mgrMock.addRimLight).toHaveBeenCalledWith(0xffffff, 1.2);
  });

  it('rim intensity slider does NOT call addRimLight when rim is off', () => {
    render(<LightingPanel />);
    const sliders = screen.getAllByRole('slider');
    const rimSlider = sliders[sliders.length - 1];
    // Despite the slider being disabled, force-fire the change to confirm
    // the handler short-circuits on rimEnabled=false.
    fireEvent.change(rimSlider, { target: { value: '1.2' } });
    expect(mgrMock.addRimLight).not.toHaveBeenCalled();
  });

  it('all sliders + checkboxes disabled when disabled prop is true', () => {
    render(<LightingPanel disabled />);
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider).toBeDisabled();
    }
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
  });
});
