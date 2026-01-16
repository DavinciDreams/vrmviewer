import React from 'react';
import { Button } from '../ui/Button';

export interface ModelControlsProps {
  isVisible: boolean;
  onVisibilityToggle: () => void;
  isWireframe: boolean;
  onWireframeToggle: () => void;
  onResetPose: () => void;
  onResetCamera: () => void;
}

export const ModelControls: React.FC<ModelControlsProps> = ({
  isVisible,
  onVisibilityToggle,
  isWireframe,
  onWireframeToggle,
  onResetPose,
  onResetCamera,
}) => {
  return (
    <div className="flex items-center space-x-2 bg-gray-800 rounded-lg p-3 border border-gray-700">
      <Button
        variant={isVisible ? 'primary' : 'ghost'}
        size="sm"
        onClick={onVisibilityToggle}
        title={isVisible ? 'Hide model' : 'Show model'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </Button>
      
      <Button
        variant={isWireframe ? 'primary' : 'ghost'}
        size="sm"
        onClick={onWireframeToggle}
        title={isWireframe ? 'Disable wireframe' : 'Enable wireframe'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      </Button>
      
      <div className="w-px h-6 bg-gray-600" />
      
      <Button
        variant="secondary"
        size="sm"
        onClick={onResetPose}
        title="Reset pose"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </Button>
      
      <Button
        variant="secondary"
        size="sm"
        onClick={onResetCamera}
        title="Reset camera"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Button>
    </div>
  );
};
