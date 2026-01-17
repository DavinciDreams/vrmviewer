import React, { useState, useEffect } from 'react';
import { ModelCard } from './ModelCard';
import { Input } from '../ui/Input';
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
  onDelete: (id: string) => void;
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
  
  // Thumbnail service
  const thumbnailService = getThumbnailService();

  // Fetch models from database
  useEffect(() => {
    const fetchModels = async () => {
      if (!isInitialized) return;
      
      try {
        setIsLoading(true);
        setError(null);
        const result = await models.getAll();
        
        // Handle DatabaseOperationResult type - check if result has data property
        const records = 'data' in result && result.data ? result.data : null;
        
        if (records) {
          // Transform ModelRecord to ModelData
          const transformedData: ModelData[] = records.map((record) => ({
            id: record.uuid,
            name: record.name,
            description: record.description,
            thumbnail: thumbnails[record.uuid] || record.thumbnail,
            createdAt: record.createdAt.toISOString(),
          }));
          setModelList(transformedData);
          
          // Fetch thumbnails for each model
          for (const record of records) {
            const thumbnailResult = await thumbnailService.getThumbnailByTarget(record.uuid);
            if (thumbnailResult.success && thumbnailResult.data) {
              // Convert base64 data to data URL format
              const dataUrl = `data:image/${thumbnailResult.data.format};base64,${thumbnailResult.data.data}`;
              setThumbnails(prev => ({
                ...prev,
                [record.uuid]: dataUrl,
              }));
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
    };
    
    fetchModels();
  }, [isInitialized, models]);
  
  // Update modelList when thumbnails change
  useEffect(() => {
    if (modelList.length > 0) {
      setModelList(prev => prev.map(model => ({
        ...model,
        thumbnail: thumbnails[model.id] || model.thumbnail,
      })));
    }
  }, [thumbnails]);
  
  const filteredModels = modelList.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
