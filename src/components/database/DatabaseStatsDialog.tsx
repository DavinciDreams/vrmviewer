import React, { useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useDatabase } from '../../hooks/useDatabase';
import { DatabaseStatistics } from '../../types/database.types';

export interface DatabaseStatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(date?: Date): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return '—';
  }
}

/**
 * Database statistics overview — surfaces `useDatabase().statistics.get()`
 * as a read-only modal. Re-fetches every time it opens so the numbers
 * reflect the current DB state, not a snapshot from when the parent
 * mounted.
 */
export const DatabaseStatsDialog: React.FC<DatabaseStatsDialogProps> = ({ isOpen, onClose }) => {
  const { statistics } = useDatabase();
  const [stats, setStats] = useState<DatabaseStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await statistics.get();
        if (cancelled) return;
        setStats(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, statistics]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Library statistics" size="md">
      {loading && <p className="text-sm text-gray-300">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {stats && !loading && !error && (
        <div className="space-y-4 text-sm">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400">Models</div>
              <div className="text-2xl font-mono text-white">{stats.totalModels}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400">Animations</div>
              <div className="text-2xl font-mono text-white">{stats.totalAnimations}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400">Total size</div>
              <div className="text-2xl font-mono text-white">{formatBytes(stats.totalSize)}</div>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400">Oldest record:</span>{' '}
              <span className="text-gray-200">{formatDate(stats.oldestRecord)}</span>
            </div>
            <div>
              <span className="text-gray-400">Newest record:</span>{' '}
              <span className="text-gray-200">{formatDate(stats.newestRecord)}</span>
            </div>
          </div>

          {/* Format breakdown */}
          {Object.keys(stats.formats).length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Formats</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.formats)
                  .sort(([, a], [, b]) => b - a)
                  .map(([format, count]) => (
                    <span
                      key={format}
                      className="px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-200"
                    >
                      {format.toUpperCase()}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {Object.keys(stats.categories).length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Categories</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.categories)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <span
                      key={category}
                      className="px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-200"
                    >
                      {category}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
};
