import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface AnimationData {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface AnimationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, name: string, description: string, category?: string, tags?: string[]) => void;
  animation?: AnimationData;
}

export const AnimationEditor: React.FC<AnimationEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  animation,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (animation) {
      setName(animation.name);
      setDescription(animation.description || '');
      setCategory(animation.category || '');
      setTags(animation.tags || []);
    }
  }, [animation]);

  const handleSave = () => {
    if (!name.trim()) return;
    if (animation) {
      onSave(animation.id, name.trim(), description.trim(), category || undefined, tags);
    }
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCategory('');
    setTagInput('');
    setTags([]);
    onClose();
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Edit Animation" size="md">
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter animation name"
          error={!name.trim() ? 'Name is required' : undefined}
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter animation description (optional)"
            rows={4}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a category (optional)</option>
            <option value="Idle">Idle</option>
            <option value="Walk">Walk</option>
            <option value="Run">Run</option>
            <option value="Jump">Jump</option>
            <option value="Dance">Dance</option>
            <option value="Action">Action</option>
            <option value="Emote">Emote</option>
            <option value="Other">Other</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tags
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Add tags (press Enter)"
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              variant="ghost"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
            >
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-gray-600 text-white"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-gray-400 hover:text-white focus:outline-none"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end space-x-3 pt-4">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
