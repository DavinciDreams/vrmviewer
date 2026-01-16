import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface AnimationData {
  id: string;
  name: string;
  description?: string;
}

export interface AnimationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, name: string, description: string) => void;
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

  useEffect(() => {
    if (animation) {
      setName(animation.name);
      setDescription(animation.description || '');
    }
  }, [animation]);

  const handleSave = () => {
    if (!name.trim()) return;
    if (animation) {
      onSave(animation.id, name.trim(), description.trim());
    }
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
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
