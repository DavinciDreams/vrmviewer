import React from 'react';
import { Button } from '../ui/Button';

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
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onLoad,
  onDelete,
  onEdit,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
            onClick={() => onDelete(model.id)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};
