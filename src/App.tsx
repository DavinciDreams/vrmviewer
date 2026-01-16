import React, { useState, useCallback, useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { VRMViewer } from './components/viewer/VRMViewer';
import { ThumbnailCapture } from './components/viewer/ThumbnailCapture';
import { DropZone } from './components/dragdrop/DropZone';
import { FilePreview } from './components/dragdrop/FilePreview';
import { AnimationControls } from './components/controls/AnimationControls';
import { PlaybackControls } from './components/controls/PlaybackControls';
import { ModelControls } from './components/controls/ModelControls';
import { ExportDialog, ExportOptionsData } from './components/export/ExportDialog';
import { AnimationEditor } from './components/database/AnimationEditor';
import { useVRM } from './hooks/useVRM';
import { usePlayback } from './hooks/usePlayback';
import { useAnimation } from './hooks/useAnimation';
import { useIdleAnimation } from './hooks/useIdleAnimation';
import { useBlendShapes } from './hooks/useBlendShapes';
import { getFileExtension, getFileTypeFromExtension } from './constants/formats';
import { generateDescriptiveName, generateUniqueName } from './utils/namingUtils';
import { bvhLoader } from './core/three/loaders/BVHLoader';
import { vrmaLoader } from './core/three/loaders/VRMALoader';

function App() {
  // VRM
  const { currentModel, isLoading, error, metadata, loadModelFromFile, clearCurrentModel } = useVRM();  
  // Playback
  const { play, pause, stop, seek, setSpeed, toggleLoop } = usePlayback();  
  // Animation
  const { currentAnimation, loadFromFile: loadAnimationFromFile, play: playAnimation, pause: pauseAnimation, stop: stopAnimation, setSpeed: setAnimationSpeed } = useAnimation();  
  // Idle Animation
  const { start: startIdleAnimation, stop: stopIdleAnimation } = useIdleAnimation();  
  // Blend Shapes
  const { clearExpression } = useBlendShapes();  
  // UI State
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isAnimationEditorOpen, setIsAnimationEditorOpen] = useState(false);
  const [pendingAnimationFile, setPendingAnimationFile] = useState<File | null>(null);
  const [pendingAnimationClip, setPendingAnimationClip] = useState<import('three').AnimationClip | null>(null);
  
  // Animation library data (mock for now - will be connected to database later)
  const [animationLibraryData, setAnimationLibraryData] = useState<Array<{ id: string; name: string; description: string; thumbnail: string; duration: number; createdAt: string }>>([]);
  const [modelLibraryData, setModelLibraryData] = useState<Array<{ id: string; name: string; description: string; thumbnail: string; createdAt: string }>>([]);

  /**
   * Initialize idle animations when model is loaded
   */
  useEffect(() => {
    if (currentModel && !currentAnimation) {
      startIdleAnimation();
    } else if (currentAnimation) {
      stopIdleAnimation();
    }
  }, [currentModel, currentAnimation, startIdleAnimation, stopIdleAnimation]);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(async (files: File[]) => {
    setDroppedFiles((prev) => [...prev, ...files]);
    
    for (const file of files) {
      await handleFileLoad(file);
    }
  }, []);

  /**
   * Handle file load
   */
  const handleFileLoad = useCallback(async (file: File) => {
    const extension = getFileExtension(file.name);
    const fileType = getFileTypeFromExtension(extension);
    
    if (fileType === 'model') {
      // Load model
      const model = await loadModelFromFile(file);
      if (model) {
        // Save to library
        const modelName = generateUniqueName(
          metadata?.name || 'model',
          modelLibraryData.map(m => m.name)
        );
        
        const modelData = {
          id: Date.now().toString(),
          name: modelName,
          description: '',
          thumbnail: '',
          createdAt: new Date().toISOString(),
        };
        
        setModelLibraryData(prev => [...prev, modelData]);
      }
    } else if (fileType === 'animation') {
      // Load animation
      if (extension === 'bvh') {
        const result = await bvhLoader.loadFromFile(file);
        if (result.success && result.data) {
          setPendingAnimationFile(file);
          setPendingAnimationClip(result.data.animation);
          setIsAnimationEditorOpen(true);
        }
      } else if (extension === 'vrma') {
        const result = await vrmaLoader.loadFromFile(file);
        if (result.success && result.data) {
          setPendingAnimationFile(file);
          setPendingAnimationClip(result.data.animation);
          setIsAnimationEditorOpen(true);
        }
      }
    }
  }, [loadModelFromFile, metadata, modelLibraryData]);

  /**
   * Handle animation save
   */
  const handleAnimationSave = useCallback(async (id: string, name: string, description: string) => {
    if (!pendingAnimationClip || !pendingAnimationFile) return;
    
    // Generate descriptive name if not provided
    const descriptiveName = name || generateDescriptiveName(description);
    
    // Check for conflicts and add number if needed
    const existingNames = animationLibraryData.map(a => a.name);
    const uniqueName = generateUniqueName(descriptiveName, existingNames);
    
    // Save animation to library
    const animationData = {
      id: Date.now().toString(),
      name: uniqueName,
      description: description || '',
      thumbnail: '',
      duration: pendingAnimationClip.duration,
      createdAt: new Date().toISOString(),
    };
    
    setAnimationLibraryData(prev => [...prev, animationData]);
    
    // Load and play animation
    await loadAnimationFromFile(pendingAnimationFile);
    playAnimation();
    play();
    
    // Clear pending state
    setPendingAnimationFile(null);
    setPendingAnimationClip(null);
    setIsAnimationEditorOpen(false);
  }, [pendingAnimationClip, pendingAnimationFile, animationLibraryData, loadAnimationFromFile, playAnimation, play]);

  /**
   * Handle animation play from library
   */
  const handleAnimationPlay = useCallback(async (animationId: string) => {
    const animation = animationLibraryData.find(a => a.id === animationId);
    if (animation) {
      // TODO: Load animation from database
      console.log('Playing animation:', animation);
    }
  }, [animationLibraryData]);

  /**
   * Handle model load from library
   */
  const handleModelLoad = useCallback(async (modelId: string) => {
    const model = modelLibraryData.find(m => m.id === modelId);
    if (model) {
      // TODO: Load model from database
      console.log('Loading model:', model);
    }
  }, [modelLibraryData]);

  /**
   * Handle export
   */
  const handleExport = useCallback(async (options: ExportOptionsData) => {
    if (!currentModel) return;
    
    try {
      if (options.format === 'vrm') {
        // TODO: Implement VRM export
        console.log('Exporting VRM:', options);
      } else if (options.format === 'vrma' && currentAnimation) {
        // TODO: Implement VRMA export
        console.log('Exporting VRMA:', options);
      }
      
      setIsExportDialogOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [currentModel, currentAnimation]);

  /**
   * Handle thumbnail capture
   */
  const handleThumbnailCapture = useCallback(() => {
    console.log('Capture thumbnail');
    // TODO: Implement thumbnail capture
  }, []);

  /**
   * Handle play
   */
  const handlePlay = useCallback(() => {
    if (currentAnimation) {
      playAnimation();
    }
    play();
  }, [currentAnimation, playAnimation, play]);

  /**
   * Handle pause
   */
  const handlePause = useCallback(() => {
    pauseAnimation();
    pause();
  }, [pauseAnimation, pause]);

  /**
   * Handle stop
   */
  const handleStop = useCallback(() => {
    stopAnimation();
    stop();
  }, [stopAnimation, stop]);

  /**
   * Handle remove file
   */
  const handleRemoveFile = useCallback((index: number) => {
    setDroppedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Handle reset pose
   */
  const handleResetPose = useCallback(() => {
    if (currentModel) {
      // Reset all blend shapes
      clearExpression();
    }
  }, [currentModel, clearExpression]);

  /**
   * Handle reset camera
   */
  const handleResetCamera = useCallback(() => {
    // TODO: Implement camera reset
    console.log('Reset camera');
  }, []);

  const hasModel = !!currentModel;
  const hasAnimation = !!currentAnimation;

  return (
    <MainLayout>
      <div className="relative flex flex-col h-full">
        {/* Viewer */}
        <div className="flex-1 relative">
          <VRMViewer />
          
          {hasModel && (
            <>
              <ThumbnailCapture
                onCapture={handleThumbnailCapture}
                disabled={!hasModel}
              />
              
              {/* Controls Overlay */}
              <div className="absolute bottom-4 left-4 right-4 space-y-3">
                <AnimationControls
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStop}
                  onSpeedChange={(speed) => {
                    setSpeed(speed);
                    setAnimationSpeed(speed);
                  }}
                  onLoopToggle={toggleLoop}
                />
                
                {hasAnimation && (
                  <PlaybackControls
                    onSeek={seek}
                  />
                )}
                
                <ModelControls
                  isVisible={true}
                  onVisibilityToggle={() => console.log('Toggle visibility')}
                  isWireframe={false}
                  onWireframeToggle={() => console.log('Toggle wireframe')}
                  onResetPose={handleResetPose}
                  onResetCamera={handleResetCamera}
                />
              </div>
            </>
          )}
        </div>

        {/* Drop Zone Overlay (when no model is loaded) */}
        {!hasModel && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <DropZone onDrop={handleDrop} />
              
              {/* File Previews */}
              {droppedFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-lg font-medium text-white mb-4">
                    Dropped Files ({droppedFiles.length})
                  </h3>
                  {droppedFiles.map((file, index) => (
                    <FilePreview
                      key={index}
                      file={file}
                      onRemove={() => handleRemoveFile(index)}
                      onLoad={() => handleFileLoad(file)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gray-900/80">
            <div className="text-center">
              <svg className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-300 text-sm">Loading model...</p>
            </div>
          </div>
        )}

        {/* Error indicator */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gray-900/80">
            <div className="text-center">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm mb-2">Error loading model</p>
              <p className="text-gray-400 text-xs">{error}</p>
              <button
                onClick={() => clearCurrentModel()}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Clear Error
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExport}
        defaultName={metadata?.name || 'model_export'}
        isExporting={false}
      />

      {/* Animation Editor Dialog */}
      <AnimationEditor
        isOpen={isAnimationEditorOpen}
        onClose={() => setIsAnimationEditorOpen(false)}
        onSave={handleAnimationSave}
        animation={pendingAnimationClip ? {
          id: 'new',
          name: pendingAnimationFile?.name || 'Animation',
          description: '',
        } : undefined}
      />
    </MainLayout>
  );
}

export default App;
