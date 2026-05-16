import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface MainLayoutProps {
  children?: React.ReactNode;
  controlsPanel?: React.ReactNode;
  onAnimationPlay?: (id: string) => Promise<void>;
  onAnimationDelete?: (id: string) => Promise<void>;
  onAnimationUpdate?: (id: string, name: string, description: string) => Promise<void>;
  onModelLoad?: (id: string) => Promise<void>;
  onModelDelete?: (id: string) => Promise<{ success: boolean; error?: { type: string; message: string; } | undefined }>;
  onModelUpdate?: (id: string, name: string, description: string) => Promise<void>;
  onExport?: () => void;
  isModelViewerOpen?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  controlsPanel,
  onAnimationPlay,
  onAnimationDelete,
  onAnimationUpdate,
  onModelLoad,
  onModelDelete,
  onModelUpdate,
  onExport,
  isModelViewerOpen = false,
}) => {
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <Header />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          isAssetSurface={!isModelViewerOpen}
          controlsPanel={controlsPanel}
          onAnimationPlay={onAnimationPlay}
          onAnimationDelete={onAnimationDelete}
          onAnimationUpdate={onAnimationUpdate}
          onModelLoad={onModelLoad}
          onModelDelete={onModelDelete}
          onModelUpdate={onModelUpdate}
          onExport={onExport}
        />
        <main className={isModelViewerOpen
          ? 'absolute inset-0 z-30 overflow-hidden bg-gray-950'
          : 'hidden'
        }>
          {children}
        </main>
      </div>
    </div>
  );
};
