import React, { useState } from 'react';
import { AnimationCard } from './AnimationCard';

export interface AnimationData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  createdAt: string;
}
import { Input } from '../ui/Input';
import { AnimationEditor } from './AnimationEditor';

export interface AnimationLibraryProps {
  animations: AnimationData[];
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string, description: string) => void;
}

export const AnimationLibrary: React.FC<AnimationLibraryProps> = ({
  animations,
  onPlay,
  onDelete,
  onUpdate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAnimation, setEditingAnimation] = useState<AnimationData | undefined>();
  
  const filteredAnimations = animations.filter((animation) =>
    animation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    animation.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (id: string) => {
    const animation = animations.find((a) => a.id === id);
    if (animation) {
      setEditingAnimation(animation);
    }
  };

  const handleSave = (id: string, name: string, description: string) => {
    onUpdate(id, name, description);
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
        {filteredAnimations.length === 0 ? (
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
