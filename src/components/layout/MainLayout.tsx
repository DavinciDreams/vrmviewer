import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface MainLayoutProps {
  children?: React.ReactNode;
  onAnimationPlay?: (id: string) => Promise<void>;
  onAnimationDelete?: (id: string) => Promise<void>;
  onAnimationUpdate?: (id: string, name: string, description: string) => Promise<void>;
  onModelLoad?: (id: string) => Promise<void>;
  onModelDelete?: (id: string) => Promise<{ success: boolean; error?: { type: string; message: string; } | undefined }>;
  onModelUpdate?: (id: string, name: string, description: string) => Promise<void>;
  onExport?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  onAnimationPlay,
  onAnimationDelete,
  onAnimationUpdate,
  onModelLoad,
  onModelDelete,
  onModelUpdate,
  onExport,
}) => {
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onAnimationPlay={onAnimationPlay}
          onAnimationDelete={onAnimationDelete}
          onAnimationUpdate={onAnimationUpdate}
          onModelLoad={onModelLoad}
          onModelDelete={onModelDelete}
          onModelUpdate={onModelUpdate}
          onExport={onExport}
        />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
