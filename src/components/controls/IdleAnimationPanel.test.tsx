/**
 * IdleAnimationPanel — drives useIdleAnimation. The hook itself is mocked
 * to a stub so tests can assert that UI events trigger the right hook calls
 * and reflect hook state correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hookState = vi.hoisted(() => ({
  breathing: { enabled: true, rate: 12, depth: 0.5 },
  blinking: { enabled: true, frequency: 15 },
  isRunning: true,
  start: vi.fn(),
  stop: vi.fn(),
  setBreathingEnabled: vi.fn(),
  setBreathingRate: vi.fn(),
  setBreathingDepth: vi.fn(),
  setBlinkingEnabled: vi.fn(),
  setBlinkingFrequency: vi.fn(),
}));

vi.mock('../../hooks/useIdleAnimation', () => ({
  useIdleAnimation: () => hookState,
}));

import { IdleAnimationPanel } from './IdleAnimationPanel';

beforeEach(() => {
  hookState.breathing = { enabled: true, rate: 12, depth: 0.5 };
  hookState.blinking = { enabled: true, frequency: 15 };
  hookState.isRunning = true;
  hookState.start.mockReset();
  hookState.stop.mockReset();
  hookState.setBreathingEnabled.mockReset();
  hookState.setBreathingRate.mockReset();
  hookState.setBreathingDepth.mockReset();
  hookState.setBlinkingEnabled.mockReset();
  hookState.setBlinkingFrequency.mockReset();
});

describe('IdleAnimationPanel', () => {
  it('shows "Running" + green button when isRunning=true', () => {
    render(<IdleAnimationPanel />);
    expect(screen.getByRole('button', { name: /running/i })).toBeInTheDocument();
  });

  it('shows "Stopped" + neutral button when isRunning=false', () => {
    hookState.isRunning = false;
    render(<IdleAnimationPanel />);
    expect(screen.getByRole('button', { name: /stopped/i })).toBeInTheDocument();
  });

  it('top-right button toggles between start() and stop() based on state', () => {
    render(<IdleAnimationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /running/i }));
    expect(hookState.stop).toHaveBeenCalledTimes(1);
    expect(hookState.start).not.toHaveBeenCalled();
  });

  it('clicking the top-right button calls start() when stopped', () => {
    hookState.isRunning = false;
    render(<IdleAnimationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /stopped/i }));
    expect(hookState.start).toHaveBeenCalledTimes(1);
    expect(hookState.stop).not.toHaveBeenCalled();
  });

  it('breathing checkbox calls setBreathingEnabled with new value', () => {
    render(<IdleAnimationPanel />);
    const checkbox = screen.getAllByRole('checkbox')[0]; // breathing comes first
    fireEvent.click(checkbox);
    expect(hookState.setBreathingEnabled).toHaveBeenCalledWith(false);
  });

  it('renders breathing rate value from hook state', () => {
    hookState.breathing.rate = 18;
    render(<IdleAnimationPanel />);
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('breathing rate slider calls setBreathingRate', () => {
    render(<IdleAnimationPanel />);
    const sliders = screen.getAllByRole('slider');
    // Order: rate, depth, frequency
    fireEvent.change(sliders[0], { target: { value: '20' } });
    expect(hookState.setBreathingRate).toHaveBeenCalledWith(20);
  });

  it('breathing depth slider calls setBreathingDepth', () => {
    render(<IdleAnimationPanel />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[1], { target: { value: '0.8' } });
    expect(hookState.setBreathingDepth).toHaveBeenCalledWith(0.8);
  });

  it('breathing rate + depth sliders are disabled when breathing.enabled=false', () => {
    hookState.breathing.enabled = false;
    render(<IdleAnimationPanel />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders[0]).toBeDisabled(); // rate
    expect(sliders[1]).toBeDisabled(); // depth
  });

  it('blinking frequency slider calls setBlinkingFrequency', () => {
    render(<IdleAnimationPanel />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[2], { target: { value: '30' } });
    expect(hookState.setBlinkingFrequency).toHaveBeenCalledWith(30);
  });

  it('blinking frequency slider disabled when blinking.enabled=false', () => {
    hookState.blinking.enabled = false;
    render(<IdleAnimationPanel />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders[2]).toBeDisabled();
  });

  it('all controls disabled when the disabled prop is true', () => {
    render(<IdleAnimationPanel disabled />);
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider).toBeDisabled();
    }
    for (const cb of screen.getAllByRole('checkbox')) {
      expect(cb).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /running/i })).toBeDisabled();
  });
});
