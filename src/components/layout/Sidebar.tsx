import React, { useState } from 'react';
import { AnimationLibrary } from '../database/AnimationLibrary';
import { ModelLibrary } from '../database/ModelLibrary';

export interface SidebarProps {
  children?: React.ReactNode;
  onAnimationPlay?: (id: string) => void;
  onAnimationDelete?: (id: string) => void;
  onAnimationUpdate?: (id: string, name: string, description: string) => void;
  onModelLoad?: (id: string) => void;
  onModelDelete?: (id: string) => Promise<{ success: boolean; error?: { type: string; message: string; } | undefined }>;
  onModelUpdate?: (id: string, name: string, description: string) => void;
  onExport?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onAnimationPlay,
  onAnimationDelete,
  onAnimationUpdate,
  onModelLoad,
  onModelDelete,
  onModelUpdate,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<'animations' | 'models' | 'export'>('animations');
  
  return (
    <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
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
          onClick={() => {
            setActiveTab('export');
            onExport?.();
          }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-750'
              : 'text-gray-400 hover:text-white hover:bg-gray-750'
          }`}
        >
          Export
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'animations' && (
          <AnimationLibrary
            onPlay={onAnimationPlay || (() => {})}
            onDelete={onAnimationDelete || (() => {})}
            onUpdate={onAnimationUpdate || (() => {})}
          />
        )}
        
        {activeTab === 'models' && (
          <ModelLibrary
            onLoad={onModelLoad || (() => {})}
            onDelete={onModelDelete || (async () => ({ success: true }))}
            onUpdate={onModelUpdate || (() => {})}
          />
        )}
        
        {activeTab === 'export' && (
          <div className="p-4">
            <div className="text-center text-gray-400 py-8">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm">Export Options</p>
              <p className="text-xs mt-1">Configure export settings</p>
            </div>
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
