import React, { useCallback, useState, useEffect } from 'react';
import { AnimationCard } from './AnimationCard';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AnimationEditor } from './AnimationEditor';
import { useDatabase } from '../../hooks/useDatabase';
import type { AnimationRecord } from '../../types/database.types';

export interface AnimationData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  createdAt: string;
}

export interface AnimationLibraryProps {
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string, description: string) => void;
}

export const AnimationLibrary: React.FC<AnimationLibraryProps> = ({
  onPlay,
  onDelete,
  onUpdate,
}) => {
  const { isInitialized, animations } = useDatabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAnimation, setEditingAnimation] = useState<AnimationData | undefined>();
  const [animationList, setAnimationList] = useState<AnimationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Multi-select / bulk-delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: 'bulkDelete'; count: number }
    | { kind: 'clearAll'; count: number }
    | null
  >(null);

  const fetchAnimations = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await animations.getAll();

      const records =
        'data' in result && Array.isArray(result.data)
          ? (result.data as AnimationRecord[])
          : null;

      if (records) {
        const transformedData: AnimationData[] = records.map((record) => ({
          id: record.uuid,
          name: record.name,
          description: record.description,
          thumbnail: record.thumbnail,
          duration: record.duration,
          createdAt: record.createdAt.toISOString(),
        }));
        setAnimationList(transformedData);
      } else {
        setError('Failed to load animations');
      }
    } catch (err) {
      setError('Failed to load animations');
      console.error('Error fetching animations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, animations]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnimations();
  }, [fetchAnimations]);
  
  const filteredAnimations = animationList.filter((animation) =>
    animation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    animation.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredAnimations.map((a) => a.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const performBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setConfirmDialog(null);
    if (ids.length === 0) return;
    const result = await animations.bulkDelete(ids);
    if (result.success) {
      setStatusMessage({ type: 'success', text: `Deleted ${ids.length} animation${ids.length === 1 ? '' : 's'}` });
      setSelectedIds(new Set());
      setSelectMode(false);
      await fetchAnimations();
    } else {
      const errorMessage = typeof result.error === 'string'
        ? result.error
        : result.error?.message || 'Bulk delete failed';
      setStatusMessage({ type: 'error', text: errorMessage });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const performClearAll = async () => {
    setConfirmDialog(null);
    const result = await animations.clearAll();
    if (result.success) {
      setStatusMessage({ type: 'success', text: 'All animations cleared' });
      setSelectedIds(new Set());
      setSelectMode(false);
      await fetchAnimations();
    } else {
      const errorMessage = typeof result.error === 'string'
        ? result.error
        : result.error?.message || 'Clear all failed';
      setStatusMessage({ type: 'error', text: errorMessage });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleEdit = (id: string) => {
    const animation = animationList.find((a) => a.id === id);
    if (animation) {
      setEditingAnimation(animation);
    }
  };

  const handleSave = (id: string, name: string, description: string) => {
    onUpdate(id, name, description);
    setEditingAnimation(undefined);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status notification */}
      {statusMessage && (
        <div className={`px-4 py-3 border-b ${
          statusMessage.type === 'success'
            ? 'bg-green-900/50 border-green-700'
            : 'bg-red-900/50 border-red-700'
        }`}>
          <p className={`text-sm ${
            statusMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
          }`}>
            {statusMessage.text}
          </p>
        </div>
      )}

      {/* Search + bulk-action toolbar */}
      <div className="p-4 border-b border-gray-700 space-y-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search animations..."
        />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-400">
            {selectMode
              ? `${selectedIds.size} selected${animationList.length ? ` of ${animationList.length}` : ''}`
              : `${animationList.length} animation${animationList.length === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={selectedIds.size === filteredAnimations.length ? clearSelection : selectAll}
                  disabled={filteredAnimations.length === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedIds.size === filteredAnimations.length && filteredAnimations.length > 0 ? 'Clear' : 'All'}
                </button>
                <button
                  onClick={() =>
                    selectedIds.size > 0 &&
                    setConfirmDialog({ kind: 'bulkDelete', count: selectedIds.size })
                  }
                  disabled={selectedIds.size === 0}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete ({selectedIds.size})
                </button>
                <button onClick={toggleSelectMode} className="text-gray-300 hover:text-white">
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleSelectMode}
                  disabled={animationList.length === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select
                </button>
                <button
                  onClick={() => setConfirmDialog({ kind: 'clearAll', count: animationList.length })}
                  disabled={animationList.length === 0}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Animation Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357 2m15.357 2H15" />
            </svg>
            <p className="text-gray-400">Loading animations...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400">Error loading animations</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        ) : filteredAnimations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <p className="text-gray-400">
              {searchQuery ? 'No animations found' : 'No animations yet'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Drag and drop animation files to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredAnimations.map((animation) => (
              <div key={animation.id} className="relative">
                {selectMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelected(animation.id)}
                    aria-label={selectedIds.has(animation.id) ? 'Deselect' : 'Select'}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(animation.id)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-gray-900/70 border-gray-500 hover:border-blue-400'
                    }`}
                  >
                    {selectedIds.has(animation.id) && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <AnimationCard
                  animation={animation}
                  onPlay={selectMode ? () => toggleSelected(animation.id) : onPlay}
                  onDelete={onDelete}
                  onEdit={handleEdit}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <AnimationEditor
        isOpen={!!editingAnimation}
        onClose={() => setEditingAnimation(undefined)}
        onSave={handleSave}
        animation={editingAnimation}
      />

      {/* Destructive-action confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.kind === 'clearAll' ? 'Clear entire animation library?' : 'Delete selected animations?'}
        message={
          confirmDialog?.kind === 'clearAll'
            ? `This will remove all ${confirmDialog.count} animations from the database. This cannot be undone.`
            : confirmDialog
              ? `This will delete ${confirmDialog.count} animation${confirmDialog.count === 1 ? '' : 's'}. This cannot be undone.`
              : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDialog?.kind === 'clearAll') performClearAll();
          else if (confirmDialog?.kind === 'bulkDelete') performBulkDelete();
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};
