import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ModelCard } from './ModelCard';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AnimationEditor } from './AnimationEditor';
import { useDatabase } from '../../hooks/useDatabase';
import { getThumbnailService } from '../../core/database/services/ThumbnailService';

export interface ModelData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
}

export interface ModelLibraryProps {
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: { type: string; message: string; } | undefined }>;
  onUpdate: (id: string, name: string, description: string) => void;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({
  onLoad,
  onDelete,
  onUpdate,
}) => {
  const { isInitialized, models } = useDatabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingModel, setEditingModel] = useState<ModelData | undefined>();
  const [modelList, setModelList] = useState<ModelData[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Multi-select / bulk-delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: 'bulkDelete'; count: number }
    | { kind: 'clearAll'; count: number }
    | null
  >(null);
  // Latch while a destructive operation is in flight so a double-click on the
  // confirm button doesn't fire two concurrent bulk-delete calls.
  const [isDeleting, setIsDeleting] = useState(false);

  // Thumbnail service
  const thumbnailService = getThumbnailService();

  // Fetch models from database. Resolves setState in async continuations
  // (legitimate data-fetching pattern; the new react-hooks/set-state-in-effect
  // rule still flags it because the call originates inside an effect).
  const fetchModels = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await models.getAll();

      // Handle DatabaseOperationResult type - check if result has data property
      const records = 'data' in result && result.data ? result.data : null;

      if (records) {
        const transformedData: ModelData[] = records.map((record) => ({
          id: record.uuid,
          name: record.name,
          description: record.description,
          thumbnail: record.thumbnail,
          createdAt: record.createdAt.toISOString(),
        }));
        setModelList(transformedData);

        for (const record of records) {
          const thumbnailResult = await thumbnailService.getThumbnailByTarget(record.uuid);
          if (thumbnailResult.success && thumbnailResult.data) {
            const dataUrl = `data:image/${thumbnailResult.data.format};base64,${thumbnailResult.data.data}`;
            setThumbnails((prev) => ({ ...prev, [record.uuid]: dataUrl }));
          }
        }
      } else {
        setError('Failed to load models');
      }
    } catch (err) {
      setError('Failed to load models');
      console.error('Error fetching models:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, models, thumbnailService]);

  useEffect(() => {
    // Canonical data-fetching effect: setState calls happen after async work,
    // not synchronously, so the cascading-render concern of this rule does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchModels();
  }, [fetchModels]);

  // Merge thumbnails into the displayed list at render time so we don't have to
  // re-sync separate state via an effect when thumbnails resolve.
  const filteredModels = useMemo(
    () =>
      modelList
        .filter(
          (model) =>
            model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            model.description?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .map((model) => ({
          ...model,
          thumbnail: thumbnails[model.id] || model.thumbnail,
        })),
    [modelList, thumbnails, searchQuery],
  );

  const handleEdit = (id: string) => {
    const model = modelList.find((m) => m.id === id);
    if (model) {
      setEditingModel(model);
    }
  };

  const handleSave = (id: string, name: string, description: string) => {
    onUpdate(id, name, description);
    setEditingModel(undefined);
  };

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

  const selectAll = () => {
    setSelectedIds(new Set(filteredModels.map((m) => m.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const performBulkDelete = async () => {
    if (isDeleting) return;
    const ids = Array.from(selectedIds);
    setIsDeleting(true);
    setConfirmDialog(null);
    if (ids.length === 0) {
      setIsDeleting(false);
      return;
    }
    try {
      const result = await models.bulkDelete(ids);
      if (result.success) {
        setDeleteMessage({ type: 'success', text: `Deleted ${ids.length} model${ids.length === 1 ? '' : 's'}` });
        setSelectedIds(new Set());
        setSelectMode(false);
        await fetchModels();
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Bulk delete failed';
        setDeleteMessage({ type: 'error', text: errorMessage });
      }
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteMessage(null), 4000);
    }
  };

  const performClearAll = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setConfirmDialog(null);
    try {
      const result = await models.clearAll();
      if (result.success) {
        setDeleteMessage({ type: 'success', text: 'All models cleared' });
        setSelectedIds(new Set());
        setSelectMode(false);
        await fetchModels();
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Clear all failed';
        setDeleteMessage({ type: 'error', text: errorMessage });
      }
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteMessage(null), 4000);
    }
  };

  const handleDelete = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const result = await onDelete(id);
    if (result.success) {
      // Refresh model list after successful deletion
      await fetchModels();
      // Show success message
      setDeleteMessage({ type: 'success', text: 'Model deleted successfully' });
      // Clear message after 3 seconds
      setTimeout(() => setDeleteMessage(null), 3000);
      return { success: true };
    } else {
      // Show error message
      const errorMessage = typeof result.error === 'string'
        ? result.error
        : result.error?.message || 'Failed to delete model';
      setDeleteMessage({ type: 'error', text: errorMessage });
      // Clear message after 5 seconds
      setTimeout(() => setDeleteMessage(null), 5000);
      return { success: false, error: errorMessage };
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Delete notification */}
      {deleteMessage && (
        <div className={`px-4 py-3 border-b ${
          deleteMessage.type === 'success' 
            ? 'bg-green-900/50 border-green-700' 
            : 'bg-red-900/50 border-red-700'
        }`}>
          <div className="flex items-center">
            {deleteMessage.type === 'success' ? (
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className={`text-sm ${
              deleteMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>
              {deleteMessage.text}
            </p>
          </div>
        </div>
      )}
      
      {/* Search + bulk-action toolbar */}
      <div className="p-4 border-b border-gray-700 space-y-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search models..."
        />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-400">
            {selectMode
              ? `${selectedIds.size} selected${modelList.length ? ` of ${modelList.length}` : ''}`
              : `${modelList.length} model${modelList.length === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={selectedIds.size === filteredModels.length ? clearSelection : selectAll}
                  disabled={filteredModels.length === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedIds.size === filteredModels.length && filteredModels.length > 0 ? 'Clear' : 'All'}
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
                  disabled={modelList.length === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select
                </button>
                <button
                  onClick={() => setConfirmDialog({ kind: 'clearAll', count: modelList.length })}
                  disabled={modelList.length === 0}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Model Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-gray-400">Loading models...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400">Error loading models</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            <p className="text-gray-400">
              {searchQuery ? 'No models found' : 'No models yet'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Drag and drop model files to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredModels.map((model) => (
              <div key={model.id} className="relative">
                {selectMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelected(model.id)}
                    aria-label={selectedIds.has(model.id) ? 'Deselect' : 'Select'}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(model.id)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-gray-900/70 border-gray-500 hover:border-blue-400'
                    }`}
                  >
                    {selectedIds.has(model.id) && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <ModelCard
                  model={model}
                  onLoad={selectMode ? () => toggleSelected(model.id) : onLoad}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <AnimationEditor
        isOpen={!!editingModel}
        onClose={() => setEditingModel(undefined)}
        onSave={handleSave}
        animation={editingModel ? { id: editingModel.id, name: editingModel.name, description: editingModel.description } : undefined}
      />

      {/* Destructive-action confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.kind === 'clearAll' ? 'Clear entire library?' : 'Delete selected models?'}
        message={
          confirmDialog?.kind === 'clearAll'
            ? `This will remove all ${confirmDialog.count} models and their thumbnails from the database. This cannot be undone.`
            : confirmDialog
              ? `This will delete ${confirmDialog.count} model${confirmDialog.count === 1 ? '' : 's'} and their thumbnails. This cannot be undone.`
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
