import React, { useEffect, useState } from 'react';
import type { BackfillProgress } from '../../core/metadata/backfill';

/**
 * Auto-dismiss delay after the backfill reaches `processed === total`.
 * Long enough to read the final counts, short enough to not linger.
 */
const AUTO_DISMISS_MS = 5_000;

export interface BackfillProgressToastProps {
  /**
   * Live backfill progress, or `null` when no backfill is running.
   * Passing `null` after a completed run will dismiss the toast
   * immediately (use the auto-dismiss path instead if you want the
   * post-completion summary to linger).
   */
  progress: BackfillProgress | null;
}

/**
 * Bottom-right toast that surfaces metadata-backfill progress so users
 * understand the brief delay between app open and the library settling
 * (especially after an upgrade that bumps EXTRACTOR_VERSION). Hidden
 * entirely when no backfill is running. Replaces the previous silent
 * `console.info` so the work is visible.
 */
export const BackfillProgressToast: React.FC<BackfillProgressToastProps> = ({
  progress,
}) => {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed flag when a new run begins (total changes to a fresh
  // in-flight value). Using the "adjust state during render" pattern from
  // React docs — matches the lastManager pattern in useBlendShapes.ts —
  // to avoid the set-state-in-effect lint rule.
  const [lastTotal, setLastTotal] = useState<number | null>(progress?.total ?? null);
  if ((progress?.total ?? null) !== lastTotal) {
    setLastTotal(progress?.total ?? null);
    if (progress && progress.processed < progress.total) {
      setDismissed(false);
    }
  }

  // Auto-dismiss N seconds after completion.
  const isDone =
    progress !== null && progress.total > 0 && progress.processed >= progress.total;

  useEffect(() => {
    if (!isDone || dismissed) return;
    const handle = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [isDone, dismissed]);

  if (!progress || progress.total === 0 || dismissed) {
    return null;
  }

  const pct = Math.min(
    100,
    Math.round((progress.processed / progress.total) * 100),
  );
  const message = isDone
    ? `Metadata backfill complete · ${progress.updated} updated${
        progress.failed > 0 ? `, ${progress.failed} failed` : ''
      } of ${progress.total}`
    : `Refreshing metadata · ${progress.processed} of ${progress.total} processed`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-gray-700 bg-gray-800 shadow-lg"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-100">{message}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className={`h-full transition-[width] duration-200 ease-out ${
                isDone && progress.failed > 0 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss metadata backfill progress"
          className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
