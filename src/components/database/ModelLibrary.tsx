import React, { useState } from 'react';
import { ModelCard } from './ModelCard';
import { Input } from '../ui/Input';
import { AnimationEditor } from './AnimationEditor';

export interface ModelData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
}

export interface ModelLibraryProps {
  models: ModelData[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string, description: string) => void;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({
  models,
  onLoad,
  onDelete,
  onUpdate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingModel, setEditingModel] = useState<ModelData | undefined>();
  
  const filteredModels = models.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (id: string) => {
    const model = models.find((m) => m.id === id);
    if (model) {
      setEditingModel(model);
    }
  };

  const handleSave = (id: string, name: string, description: string) => {
    onUpdate(id, name, description);
    setEditingModel(undefined);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-700">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search models..."
        />
      </div>
      
      {/* Model Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredModels.length === 0 ? (
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
              <ModelCard
                key={model.id}
                model={model}
                onLoad={onLoad}
                onDelete={onDelete}
                onEdit={handleEdit}
              />
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
    </div>
  );
};
