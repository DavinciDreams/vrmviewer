import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

export interface ModelData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
}

export interface ModelCardProps {
  model: ModelData;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onEdit: (id: string) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onLoad,
  onDelete,
  onEdit,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      const result = await onDelete(model.id);
      if (!result.success) {
        setDeleteError(result.error || 'Failed to delete model');
      } else {
        setIsDeleteDialogOpen(false);
      }
    } catch (error) {
      setDeleteError('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-900 flex items-center justify-center relative">
        {model.thumbnail ? (
          <img
            src={model.thumbnail}
            alt={model.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        )}
      </div>
      
      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate" title={model.name}>
          {model.name}
        </h3>
        {model.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
            {model.description}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">{formatDate(model.createdAt)}</p>
        
        {/* Actions */}
        <div className="flex items-center space-x-2 mt-3">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onLoad(model.id)}
          >
            Load
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(model.id)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </Button>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        title="Delete Model"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete <span className="font-semibold text-white">{model.name}</span>?
          </p>
          <p className="text-sm text-gray-400">
            This action cannot be undone.
          </p>
          
          {deleteError && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-300">{deleteError}</p>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-2">
            <Button
              variant="ghost"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
