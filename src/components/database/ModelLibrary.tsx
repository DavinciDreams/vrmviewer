import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { getThumbnailService } from '../../core/database/services/ThumbnailService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface ModelData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
}

export interface ModelLibraryProps {
  // No longer need onLoad, onDelete, onUpdate for single model mode
}

export const ModelLibrary: React.FC<ModelLibraryProps> = () => {
  const { isInitialized, models } = useDatabase();
  const [model, setModel] = useState<ModelData | null>(null);
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const thumbnailService = getThumbnailService();

  // Autosave state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [pendingSave, setPendingSave] = useState(false);

  // Fetch the single model from database
  useEffect(() => {
    const fetchModel = async () => {
      if (!isInitialized) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await models.getAll();
        const records = 'data' in result && result.data ? result.data : null;
        if (records && records.length > 0) {
          const record = records[0];
          setModel({
            id: record.uuid,
            name: record.name,
            description: record.description,
            thumbnail: record.thumbnail,
            createdAt: record.createdAt.toISOString(),
          });
          // Fetch thumbnail
          const thumbnailResult = await thumbnailService.getThumbnailByTarget(record.uuid);
          if (thumbnailResult.success && thumbnailResult.data) {
            const dataUrl = `data:image/${thumbnailResult.data.format};base64,${thumbnailResult.data.data}`;
            setThumbnail(dataUrl);
          } else if (record.thumbnail) {
            setThumbnail(record.thumbnail);
          } else {
            setThumbnail(undefined);
          }
        } else {
          setModel(null);
          setThumbnail(undefined);
        }
      } catch (err) {
        setError('Failed to load model');
        setModel(null);
        setThumbnail(undefined);
      } finally {
        setIsLoading(false);
      }
    };
    fetchModel();
  }, [isInitialized, models, isEditing]);

  // Edit handlers
  const handleEdit = () => {
    if (model) {
      setEditName(model.name);
      setEditDescription(model.description || '');
      setIsEditing(true);
      setSaveError(null);
      setPendingSave(false);
      setIsSaving(false);
    }
  };

  // Debounced autosave effect
  useEffect(() => {
    if (!isEditing) return;
    if (!model) return;
    if (editName === model.name && (editDescription || '') === (model.description || '')) return;
    setPendingSave(true);
    setSaveError(null);
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await models.update(model.id, {
          name: editName,
          displayName: editName,
          description: editDescription,
        });
        setPendingSave(false);
      } catch (err) {
        setSaveError('Failed to autosave changes');
        setPendingSave(true);
      } finally {
        setIsSaving(false);
      }
    }, 500);
    setSaveTimeout(timeout);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editName, editDescription, isEditing]);

  // Close dialog only after successful save
  useEffect(() => {
    if (!isEditing) return;
    if (!pendingSave && !isSaving && !saveError) {
      // Only close if edits differ from model
      if ((editName !== model?.name || (editDescription || '') !== (model?.description || '')) && model) {
        setIsEditing(false);
      }
    }
  }, [pendingSave, isSaving, saveError, isEditing, editName, editDescription, model]);

  const handleEditCancel = () => {
    setIsEditing(false);
    setSaveError(null);
    setPendingSave(false);
    setIsSaving(false);
    if (saveTimeout) clearTimeout(saveTimeout);
  };

  // Delete handler (clear single model)
  const handleDelete = async () => {
    if (!model) return;
    setIsLoading(true);
    try {
      await models.delete(model.id);
      setModel(null);
      setThumbnail(undefined);
    } catch (err) {
      setError('Failed to delete model');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center p-6">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <svg className="w-16 h-16 text-gray-600 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-gray-400">Loading model...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-400">{error}</p>
        </div>
      ) : !model ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          <p className="text-gray-400">No model saved</p>
          <p className="text-sm text-gray-500 mt-1">Drag and drop a model file to get started</p>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-gray-800 rounded-lg shadow p-6 flex flex-col items-center">
          {thumbnail && (
            <img src={thumbnail} alt="Model thumbnail" className="w-32 h-32 object-cover rounded mb-4 border border-gray-700" />
          )}
          <div className="w-full flex flex-col items-center">
            <h2 className="text-lg font-semibold text-white mb-1 truncate w-full text-center">{model.name}</h2>
            <p className="text-gray-400 text-sm mb-2 w-full text-center break-words min-h-[32px]">{model.description || <span className="italic text-gray-500">No description</span>}</p>
            <div className="flex gap-2 mt-2">
              <Button onClick={handleEdit} size="sm" variant="secondary">Edit</Button>
              <Button onClick={handleDelete} size="sm" variant="danger">Delete</Button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Dialog */}
      {isEditing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
          <div className="bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col">
            <label className="text-xs text-gray-400 mb-1">Model Name</label>
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Enter model name"
              className="mb-3"
              maxLength={64}
            />
            <label className="text-xs text-gray-400 mb-1">Description</label>
            <textarea
              className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-blue-400 mb-4"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Enter model description"
              rows={2}
              maxLength={256}
            />
            <div className="flex flex-col gap-2 mt-2">
              {isSaving && (
                <span className="text-blue-400 text-xs flex items-center gap-1">
                  <svg className="w-4 h-4 animate-spin inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving...
                </span>
              )}
              {saveError && (
                <span className="text-red-400 text-xs">{saveError}</span>
              )}
              <Button onClick={handleEditCancel} size="sm" variant="secondary">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
