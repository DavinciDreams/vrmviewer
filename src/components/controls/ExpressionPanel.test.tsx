/**
 * ExpressionPanel — facial/blend-shape UI. useBlendShapes is mocked so we
 * can drive specific hook states and assert UI behaviour.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hookState = vi.hoisted(() => ({
  availableBlendShapes: ['happy', 'sad', 'surprised'] as string[],
  currentBlendShapes: {} as Record<string, number>,
  currentExpression: null as string | null,
  expressionWeight: 1,
  currentLipSync: null as string | null,
  lipSyncWeight: 1,
  eyeBlink: { left: 0, right: 0 } as { left: number; right: number },
  setBlendShape: vi.fn(),
  setExpression: vi.fn(),
  clearExpression: vi.fn(),
  setLipSync: vi.fn(),
  clearLipSync: vi.fn(),
  setEyeBlink: vi.fn(),
  resetBlendShapes: vi.fn(),
}));

vi.mock('../../hooks/useBlendShapes', () => ({
  useBlendShapes: () => hookState,
}));

import { ExpressionPanel } from './ExpressionPanel';

beforeEach(() => {
  hookState.availableBlendShapes = ['happy', 'sad', 'surprised'];
  hookState.currentBlendShapes = {};
  hookState.currentExpression = null;
  hookState.expressionWeight = 1;
  hookState.currentLipSync = null;
  hookState.lipSyncWeight = 1;
  hookState.eyeBlink = { left: 0, right: 0 };
  hookState.setBlendShape.mockReset();
  hookState.setExpression.mockReset();
  hookState.clearExpression.mockReset();
  hookState.setLipSync.mockReset();
  hookState.clearLipSync.mockReset();
  hookState.setEyeBlink.mockReset();
  hookState.resetBlendShapes.mockReset();
});

describe('ExpressionPanel — expression presets', () => {
  it('renders all preset buttons from ExpressionPresets', () => {
    render(<ExpressionPanel />);
    // Documented names from src/constants/blendShapes.ts: Neutral, Joy,
    // Angry, Sad, Surprised, Blink, Smile.
    for (const name of ['Neutral', 'Joy', 'Angry', 'Sad', 'Surprised']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('clicking a non-active preset calls setExpression(preset, weight||1)', () => {
    render(<ExpressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Joy' }));
    expect(hookState.setExpression).toHaveBeenCalledWith('joy', 1);
  });

  it('clicking the active preset clears it', () => {
    hookState.currentExpression = 'joy';
    render(<ExpressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Joy' }));
    expect(hookState.clearExpression).toHaveBeenCalled();
    expect(hookState.setExpression).not.toHaveBeenCalled();
  });

  it('weight slider only renders when an expression is active', () => {
    const { rerender } = render(<ExpressionPanel />);
    // No active expression → no Weight label.
    expect(screen.queryByText(/^Weight$/)).not.toBeInTheDocument();

    hookState.currentExpression = 'joy';
    hookState.expressionWeight = 0.6;
    rerender(<ExpressionPanel />);
    expect(screen.getByText(/^Weight$/)).toBeInTheDocument();
    expect(screen.getByText('0.60')).toBeInTheDocument();
  });

  it('weight slider calls setExpression(currentExpression, newValue)', () => {
    hookState.currentExpression = 'joy';
    hookState.expressionWeight = 0.6;
    render(<ExpressionPanel />);
    // Weight is the first slider (no other sliders shown unless lip-sync /
    // eye-blink / shapes — those render unconditionally).
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '0.8' } });
    expect(hookState.setExpression).toHaveBeenCalledWith('joy', 0.8);
  });

  it('Reset button calls resetBlendShapes', () => {
    render(<ExpressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(hookState.resetBlendShapes).toHaveBeenCalled();
  });
});

describe('ExpressionPanel — lip-sync', () => {
  it('clicking a non-active viseme calls setLipSync', () => {
    render(<ExpressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Ah' }));
    expect(hookState.setLipSync).toHaveBeenCalledWith('aa', 1);
  });

  it('clicking the active viseme clears it', () => {
    hookState.currentLipSync = 'aa';
    render(<ExpressionPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Ah' }));
    expect(hookState.clearLipSync).toHaveBeenCalled();
    expect(hookState.setLipSync).not.toHaveBeenCalled();
  });

  it('viseme weight slider only renders when a viseme is active', () => {
    const { rerender } = render(<ExpressionPanel />);
    expect(screen.queryByText(/Viseme weight/i)).not.toBeInTheDocument();

    hookState.currentLipSync = 'aa';
    rerender(<ExpressionPanel />);
    expect(screen.getByText(/Viseme weight/i)).toBeInTheDocument();
  });
});

describe('ExpressionPanel — eye blink', () => {
  it('left eye slider calls setEyeBlink(left, right=current)', () => {
    hookState.eyeBlink = { left: 0, right: 0.3 };
    render(<ExpressionPanel />);
    const sliders = screen.getAllByRole('slider');
    // Locate the left-eye slider — it's the one whose value is "0" and
    // appears immediately under "Left eye".
    // The "0.00" / "0.30" labels disambiguate which sliders are which.
    const leftSlider = sliders.find((s) => (s as HTMLInputElement).value === '0');
    fireEvent.change(leftSlider!, { target: { value: '0.5' } });
    expect(hookState.setEyeBlink).toHaveBeenCalledWith(0.5, 0.3);
  });

  it('right eye slider calls setEyeBlink(left=current, right)', () => {
    hookState.eyeBlink = { left: 0.4, right: 0 };
    render(<ExpressionPanel />);
    const sliders = screen.getAllByRole('slider');
    // Right slider has value "0" while left has "0.4".
    const rightSlider = sliders.filter(
      (s) => (s as HTMLInputElement).value === '0',
    )[0];
    fireEvent.change(rightSlider, { target: { value: '0.8' } });
    expect(hookState.setEyeBlink).toHaveBeenCalledWith(0.4, 0.8);
  });
});

describe('ExpressionPanel — per-shape sliders', () => {
  it('renders one slider per available blend shape', () => {
    render(<ExpressionPanel />);
    // Lookup by capitalized labels (panel uses `capitalize` class but the
    // raw text content is the lowercase shape name).
    expect(screen.getByText('happy')).toBeInTheDocument();
    expect(screen.getByText('sad')).toBeInTheDocument();
    expect(screen.getByText('surprised')).toBeInTheDocument();
  });

  it('per-shape slider calls setBlendShape(name, value)', () => {
    hookState.currentBlendShapes = { happy: 0.4 };
    render(<ExpressionPanel />);
    const sliders = screen.getAllByRole('slider');
    // happy is the first shape after the eye-blink sliders. Find by value.
    const happySlider = sliders.find(
      (s) => (s as HTMLInputElement).value === '0.4',
    );
    fireEvent.change(happySlider!, { target: { value: '0.7' } });
    expect(hookState.setBlendShape).toHaveBeenCalledWith('happy', 0.7);
  });

  it('per-shape section is hidden when availableBlendShapes is empty', () => {
    hookState.availableBlendShapes = [];
    render(<ExpressionPanel />);
    expect(screen.queryByText(/Individual shapes/i)).not.toBeInTheDocument();
  });
});

describe('ExpressionPanel — disabled state', () => {
  it('disables all buttons and sliders when disabled prop is true', () => {
    hookState.currentExpression = 'joy';
    hookState.currentLipSync = 'aa';
    render(<ExpressionPanel disabled />);

    for (const slider of screen.getAllByRole('slider')) {
      expect(slider).toBeDisabled();
    }
    // Reset button + preset buttons + viseme buttons all share the same
    // disabled prop path.
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Joy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ah' })).toBeDisabled();
  });
});
