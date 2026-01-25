import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

export interface AnimationData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  createdAt: string;
  category?: string;
  tags?: string[];
}

export interface AnimationCardProps {
  animation: AnimationData;
  onPlay: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onEdit: (id: string) => void;
}

export const AnimationCard: React.FC<AnimationCardProps> = ({
  animation,
  onPlay,
  onDelete,
  onEdit,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      const result = await onDelete(animation.id);
      if (!result.success) {
        setDeleteError(result.error || 'Failed to delete animation');
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
      <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
        {animation.thumbnail ? (
          <img
            src={animation.thumbnail}
            alt={animation.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        )}
        
        {/* Play button overlay */}
        <button
          onClick={() => onPlay(animation.id)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      </div>
      
      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate" title={animation.name}>
          {animation.name}
        </h3>
        {animation.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
            {animation.description}
          </p>
        )}
        
        {/* Category and Tags */}
        {animation.category && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-300">
              {animation.category}
            </span>
          </div>
        )}
        
        {animation.tags && animation.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {animation.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300"
              >
                {tag}
              </span>
            ))}
            {animation.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-400">
                +{animation.tags.length - 3}
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{formatDuration(animation.duration)}</span>
          <span>{formatDate(animation.createdAt)}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-2 mt-3">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onPlay(animation.id)}
          >
            Play
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(animation.id)}
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
        title="Delete Animation"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete <span className="font-semibold text-white">{animation.name}</span>?
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
