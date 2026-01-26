import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { AnimationCard } from './AnimationCard';
import { Input } from '../ui/Input';
import { AnimationEditor } from './AnimationEditor';
import { useDatabase } from '../../hooks/useDatabase';
import { getThumbnailService } from '../../core/database/services/ThumbnailService';

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

export interface AnimationLibraryProps {
  onPlay: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (id: string, name: string, description: string, category?: string, tags?: string[]) => void;
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
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Thumbnail service
  const thumbnailService = getThumbnailService();

  // Fetch animations from database
  const fetchAnimations = async () => {
    if (!isInitialized) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const result = await animations.getAll();
      
      // Handle DatabaseOperationResult type - check if result has data property
      const records = 'data' in result && result.data ? result.data : null;
      
      if (records) {
        // Transform AnimationRecord to AnimationData
        const transformedData: AnimationData[] = records.map((record) => ({
          id: record.uuid,
          name: record.name,
          description: record.description,
          thumbnail: thumbnails[record.uuid] || record.thumbnail,
          duration: record.duration,
          createdAt: record.createdAt.toISOString(),
          category: record.category,
          tags: record.tags,
        }));
        setAnimationList(transformedData);
        
        // Fetch thumbnails for each animation
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
        setError('Failed to load animations');
      }
    } catch (err) {
      setError('Failed to load animations');
      console.error('Error fetching animations:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAnimations();
  }, [isInitialized, animations]);
  
  // Update animationList when thumbnails change
  useEffect(() => {
    if (animationList.length > 0) {
      setAnimationList(prev => prev.map(animation => ({
        ...animation,
        thumbnail: thumbnails[animation.id] || animation.thumbnail,
      })));
    }
  }, [thumbnails]);
  
  // Fuse.js instance for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(animationList, {
      keys: ['name', 'description', 'tags'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [animationList]);
  
  const filteredAnimations = useMemo(() => {
    if (!searchQuery.trim()) {
      return animationList;
    }
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [searchQuery, fuse]);

  const handleEdit = (id: string) => {
    const animation = animationList.find((a) => a.id === id);
    if (animation) {
      setEditingAnimation(animation);
    }
  };

  const handleSave = (id: string, name: string, description: string, category?: string, tags?: string[]) => {
    onUpdate(id, name, description, category, tags);
    setEditingAnimation(undefined);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-700">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search animations..."
        />
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
              <AnimationCard
                key={animation.id}
                animation={animation}
                onPlay={onPlay}
                onDelete={onDelete}
                onEdit={handleEdit}
              />
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
    </div>
  );
};
