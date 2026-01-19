/**
 * ModelList Component
 * Horizontal list of loaded models with controls
 */

import React from 'react';
import { VRMModelEntry } from '../../store/vrmStore';
import { ModelCard } from './ModelCard';

export interface ModelListProps {
  models: VRMModelEntry[];
  activeModelId: string | null;
  onModelSelect: (id: string) => void;
  onModelRemove: (id: string) => void;
  onModelToggleVisibility: (id: string) => void;
}

export const ModelList: React.FC<ModelListProps> = ({
  models,
  activeModelId,
  onModelSelect,
  onModelRemove,
  onModelToggleVisibility,
}) => {
  if (models.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg shadow-lg">
      <span className="text-xs text-gray-400 mr-2 flex-shrink-0">
        Models ({models.length})
      </span>
      {models.map((entry) => (
        <ModelCard
          key={entry.id}
          entry={entry}
          isActive={entry.id === activeModelId}
          onSelect={() => onModelSelect(entry.id)}
          onRemove={() => onModelRemove(entry.id)}
          onToggleVisibility={() => onModelToggleVisibility(entry.id)}
        />
      ))}
    </div>
  );
};
