/**
 * ModelCard Component
 * Individual model card in the model list
 */

import React from 'react';
import { VRMModelEntry } from '../../store/vrmStore';

export interface ModelCardProps {
  entry: VRMModelEntry;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onToggleVisibility: () => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  entry,
  isActive,
  onSelect,
  onRemove,
  onToggleVisibility,
}) => {
  return (
    <div
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer
        transition-colors
        ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}
      `}
      onClick={onSelect}
    >
      {/* Thumbnail or placeholder */}
      <div className="w-10 h-10 bg-gray-600 rounded overflow-hidden flex-shrink-0">
        {entry.model.metadata.thumbnail ? (
          <img 
            src={entry.model.metadata.thumbnail} 
            alt="" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">
            {entry.model.metadata.title.charAt(0)}
          </div>
        )}
      </div>
      
      {/* Model name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {entry.model.metadata.title}
        </p>
        <p className="text-xs opacity-70">
          {entry.isVisible ? 'Visible' : 'Hidden'}
        </p>
      </div>
      
      {/* Visibility toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className="p-1 hover:bg-black/20 rounded flex-shrink-0"
        title={entry.isVisible ? 'Hide model' : 'Show model'}
      >
        {entry.isVisible ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        )}
      </button>
      
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 flex-shrink-0"
        title="Remove model"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
