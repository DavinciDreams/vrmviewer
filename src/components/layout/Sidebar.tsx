import React, { useState } from 'react';
import { AnimationLibrary } from '../database/AnimationLibrary';
import { ModelLibrary } from '../database/ModelLibrary';

export interface SidebarProps {
  children?: React.ReactNode;
  controlsPanel?: React.ReactNode;
  onAnimationPlay?: (id: string) => void;
  onAnimationDelete?: (id: string) => void;
  onAnimationUpdate?: (id: string, name: string, description: string) => void;
  onModelLoad?: (id: string) => void;
  onModelDelete?: (id: string) => Promise<{ success: boolean; error?: { type: string; message: string; } | undefined }>;
  onModelUpdate?: (id: string, name: string, description: string) => void;
  onExport?: () => void;
  isAssetSurface?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  controlsPanel,
  onAnimationPlay,
  onAnimationDelete,
  onAnimationUpdate,
  onModelLoad,
  onModelDelete,
  onModelUpdate,
  onExport,
  isAssetSurface = false,
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'animations' | 'controls'>('models');

  if (isAssetSurface) {
    return (
      <aside className="flex w-full flex-col bg-gray-900">
        <ModelLibrary
          isAssetSurface
          onLoad={onModelLoad || (() => {})}
          onDelete={onModelDelete || (async () => ({ success: true }))}
          onUpdate={onModelUpdate || (() => {})}
        />
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('models')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'models'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
          }`}
        >
          Models
        </button>
        <button
          onClick={() => setActiveTab('animations')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'animations'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
          }`}
        >
          Animations
        </button>
        <button
          onClick={() => setActiveTab('controls')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'controls'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
          }`}
        >
          Controls
        </button>
        <button
          onClick={() => onExport?.()}
          className="flex-1 px-4 py-3 text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-750"
        >
          Export
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'models' && (
          <ModelLibrary
            onLoad={onModelLoad || (() => {})}
            onDelete={onModelDelete || (async () => ({ success: true }))}
            onUpdate={onModelUpdate || (() => {})}
          />
        )}

        {activeTab === 'animations' && (
          <AnimationLibrary
            onPlay={onAnimationPlay || (() => {})}
            onDelete={onAnimationDelete || (() => {})}
            onUpdate={onAnimationUpdate || (() => {})}
          />
        )}

        {activeTab === 'controls' && (
          <div className="p-4 space-y-3">
            {controlsPanel ?? (
              <p className="text-sm text-gray-400">Load a model to use viewer controls.</p>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          <p>Supported formats:</p>
          <p className="mt-1">VRM, GLB, GLTF, FBX, BVH, VRMA</p>
        </div>
      </div>
    </aside>
  );
};
