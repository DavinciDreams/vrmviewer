import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BackfillProgressToast } from './BackfillProgressToast';
import type { BackfillProgress } from '../../core/metadata/backfill';

function makeProgress(overrides: Partial<BackfillProgress> = {}): BackfillProgress {
  return { processed: 0, total: 0, updated: 0, failed: 0, ...overrides };
}

describe('BackfillProgressToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when progress is null', () => {
    const { container } = render(<BackfillProgressToast progress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when total is 0 (nothing to backfill)', () => {
    const { container } = render(
      <BackfillProgressToast progress={makeProgress({ total: 0 })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows in-progress message + percentage when running', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 3, total: 10 })}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByText(/Refreshing metadata · 3 of 10 processed/i),
    ).toBeInTheDocument();
    // Progress bar is the inner div with explicit width style.
    const bar = screen.getByRole('status').querySelector('[aria-hidden]');
    expect(bar).toHaveAttribute('style', expect.stringContaining('width: 30%'));
  });

  it('shows completion message when processed === total', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({
          processed: 10,
          total: 10,
          updated: 8,
          failed: 0,
        })}
      />,
    );

    expect(
      screen.getByText(/Metadata backfill complete · 8 updated of 10/i),
    ).toBeInTheDocument();
  });

  it('mentions failed count in the completion message when > 0', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({
          processed: 10,
          total: 10,
          updated: 7,
          failed: 3,
        })}
      />,
    );

    expect(
      screen.getByText(/7 updated, 3 failed of 10/i),
    ).toBeInTheDocument();
  });

  it('uses an amber progress bar when completion includes failures', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({
          processed: 10,
          total: 10,
          updated: 7,
          failed: 3,
        })}
      />,
    );
    const bar = screen.getByRole('status').querySelector('[aria-hidden]');
    expect(bar?.className).toContain('bg-amber-500');
  });

  it('uses a blue progress bar when no failures', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({
          processed: 10,
          total: 10,
          updated: 10,
          failed: 0,
        })}
      />,
    );
    const bar = screen.getByRole('status').querySelector('[aria-hidden]');
    expect(bar?.className).toContain('bg-blue-500');
  });

  it('clamps percentage to 100 even when processed > total', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 15, total: 10 })}
      />,
    );
    const bar = screen.getByRole('status').querySelector('[aria-hidden]');
    expect(bar).toHaveAttribute('style', expect.stringContaining('width: 100%'));
  });

  it('auto-dismisses 5 seconds after completion', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 5, total: 5, updated: 5 })}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(screen.queryByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does NOT auto-dismiss while still in-progress', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 3, total: 10 })}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('dismisses immediately when the close button is clicked', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 3, total: 10 })}
      />,
    );
    const close = screen.getByLabelText(/dismiss metadata backfill progress/i);
    fireEvent.click(close);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('re-appears when a new backfill run begins after the previous was dismissed', () => {
    const { rerender } = render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 1, total: 5 })}
      />,
    );
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // New run with a different total → user-dismissed flag resets.
    rerender(
      <BackfillProgressToast
        progress={makeProgress({ processed: 0, total: 8 })}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses aria-live=polite for screen-reader updates', () => {
    render(
      <BackfillProgressToast
        progress={makeProgress({ processed: 1, total: 5 })}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
