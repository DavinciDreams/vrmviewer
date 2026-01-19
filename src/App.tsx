import { useState, useCallback, useEffect, useRef } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { VRMViewer, VRMViewerHandle } from './components/viewer/VRMViewer';
import { ThumbnailCapture } from './components/viewer/ThumbnailCapture';
import { DropZone } from './components/dragdrop/DropZone';
import { FilePreview } from './components/dragdrop/FilePreview';
import { AnimationControls } from './components/controls/AnimationControls';
import { PlaybackControls } from './components/controls/PlaybackControls';
import { ModelControls } from './components/controls/ModelControls';
import { ExportDialog, ExportOptionsData } from './components/export/ExportDialog';
import { AnimationEditor } from './components/database/AnimationEditor';
import { Button } from './components/ui/Button';
import { useVRM } from './hooks/useVRM';
import { usePlayback } from './hooks/usePlayback';
import { useAnimation } from './hooks/useAnimation';
import { useIdleAnimation } from './hooks/useIdleAnimation';
import { useBlendShapes } from './hooks/useBlendShapes';
import { useExport } from './hooks/useExport';
import { useDatabase } from './hooks/useDatabase';
import { getFileExtension, getFileTypeFromExtension } from './constants/formats';
import { generateDescriptiveName, generateUniqueName } from './utils/namingUtils';
import { bvhLoader } from './core/three/loaders/BVHLoader';
import { vrmaLoader } from './core/three/loaders/VRMALoader';
import { cameraManager } from './core/three/scene/CameraManager';
import { getThumbnailService } from './core/database/services/ThumbnailService';
import { parseDataUrl } from './utils/thumbnailUtils';
import type { AnimationRecord, ModelRecord } from './types/database.types';

/**
 * Type guard to check if result has data property
 */
function hasData<T>(result: unknown): result is { data: T } {
  return typeof result === 'object' && result !== null && 'data' in result && 'success' in result;
}

/**
 * Type guard to check if result has success and data properties
 */
function hasSuccessAndData<T>(result: unknown): result is { success: boolean; data: T } {
  return typeof result === 'object' && result !== null && 'success' in result && 'data' in result && (result as { success: boolean }).success === true;
}

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
  // Export
  const { exportVRM, exportVRMA } = useExport();
  // Database
  const { isInitialized, animations, models } = useDatabase();
  // UI State
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isAnimationEditorOpen, setIsAnimationEditorOpen] = useState(false);
  const [pendingAnimationFile, setPendingAnimationFile] = useState<File | null>(null);
  const [pendingAnimationClip, setPendingAnimationClip] = useState<import('three').AnimationClip | null>(null);
  
  // VRM Viewer ref
  const vrmViewerRef = useRef<VRMViewerHandle>(null);
  
  // Model control state
  const [isModelVisible, setIsModelVisible] = useState(true);
  const [isModelWireframe, setIsModelWireframe] = useState(false);
  
  // Track current model UUID for thumbnail generation
  const [currentModelUuid, setCurrentModelUuid] = useState<string | null>(null);
  
  // Track thumbnail capture state for visual feedback
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Track unsaved model state
  const [unsavedModelFile, setUnsavedModelFile] = useState<File | null>(null);
  const [unsavedModelData, setUnsavedModelData] = useState<ArrayBuffer | null>(null);
  const [unsavedThumbnailData, setUnsavedThumbnailData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Thumbnail service
  const thumbnailService = getThumbnailService();

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
    if (!isInitialized) {
      console.warn('Database not initialized yet. Please wait...');
      return;
    }
    setDroppedFiles((prev) => [...prev, ...files]);
    
    for (const file of files) {
      await handleFileLoad(file);
    }
  }, [isInitialized]);
  
  /**
   * Handle file load
   */
  const handleFileLoad = useCallback(async (file: File) => {
    const extension = getFileExtension(file.name);
    const fileType = getFileTypeFromExtension(extension);
    
    if (fileType === 'model') {
      // Clear current model and unsaved state before loading new model
      clearCurrentModel();
      setCurrentModelUuid(null);
      setUnsavedModelFile(null);
      setUnsavedModelData(null);
      setUnsavedThumbnailData(null);
      
      // Load model
      const model = await loadModelFromFile(file);
      if (model) {
        // Store unsaved model data
        const fileData = await file.arrayBuffer();
        setUnsavedModelFile(file);
        setUnsavedModelData(fileData);
      }
    } else if (fileType === 'animation') {
      // Load animation
      if (extension === 'bvh') {
        const result = await bvhLoader.loadFromFile(file);
          if (hasSuccessAndData<{ animation: import('three').AnimationClip }>(result)) {
          setPendingAnimationFile(file);
          setPendingAnimationClip(result.data.animation);
          setIsAnimationEditorOpen(true);
        }
      } else if (extension === 'vrma') {
        const result = await vrmaLoader.loadFromFile(file);
          if (hasSuccessAndData<{ animation: import('three').AnimationClip }>(result)) {
          setPendingAnimationFile(file);
          setPendingAnimationClip(result.data.animation);
          setIsAnimationEditorOpen(true);
        }
      }
    }
  }, [loadModelFromFile, metadata, models]);

  /**
   * Handle save model (manual save from unsaved state)
   */
  const handleSaveModel = useCallback(async () => {
    if (!unsavedModelFile || !unsavedModelData) {
      console.warn('No unsaved model to save');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Generate unique name
      const getAllResult = await models.getAll();
      const existingNames = hasData(getAllResult) ? getAllResult.data.map((m: { name: string }) => m.name) : [];
      const modelName = generateUniqueName(
        metadata?.name || 'model',
        existingNames
      );
      
      // Save model to database
      const result = await models.save({
        name: modelName,
        displayName: modelName,
        description: '',
        category: '',
        tags: [],
        format: getFileExtension(unsavedModelFile.name) as 'vrm' | 'gltf' | 'glb' | 'fbx',
        version: '1.0',
        author: '',
        license: '',
        thumbnail: '',
        data: unsavedModelData,
        size: unsavedModelData.byteLength,
      });
      
      if (!hasSuccessAndData<{ uuid: string }>(result)) {
        console.error('Failed to save model:', result.error);
        return;
      }
      
      const modelUuid = result.data.uuid;
      setCurrentModelUuid(modelUuid);
      
      // Capture and save thumbnail if not already captured
      if (!unsavedThumbnailData && vrmViewerRef.current) {
        const thumbnailDataUrl = await vrmViewerRef.current!.captureThumbnail();
        const { format, data } = parseDataUrl(thumbnailDataUrl);
        
        const thumbnailResult = await thumbnailService.saveThumbnail({
          uuid: crypto.randomUUID(),
          name: `${modelUuid}_thumbnail`,
          type: 'model',
          targetUuid: modelUuid,
          data,
          format,
          width: 256,
          height: 256,
          size: data.length,
          createdAt: new Date(),
        });
        
        if (thumbnailResult.success && thumbnailResult.data) {
          await models.update(modelUuid, {
            thumbnail: thumbnailResult.data.uuid,
          });
          console.log('Thumbnail saved:', thumbnailResult.data.uuid);
        }
      } else if (unsavedThumbnailData) {
        // Use pre-captured thumbnail
        const { format, data } = parseDataUrl(unsavedThumbnailData);
        
        const thumbnailResult = await thumbnailService.saveThumbnail({
          uuid: crypto.randomUUID(),
          name: `${modelUuid}_thumbnail`,
          type: 'model',
          targetUuid: modelUuid,
          data,
          format,
          width: 256,
          height: 256,
          size: data.length,
          createdAt: new Date(),
        });
        
        if (thumbnailResult.success && thumbnailResult.data) {
          await models.update(modelUuid, {
            thumbnail: thumbnailResult.data.uuid,
          });
          console.log('Thumbnail saved:', thumbnailResult.data.uuid);
        }
      }
      
      // Clear unsaved state
      setUnsavedModelFile(null);
      setUnsavedModelData(null);
      setUnsavedThumbnailData(null);
      
      console.log('Model saved:', modelName);
    } catch (error) {
      console.error('Failed to save model:', error);
    } finally {
      setIsSaving(false);
    }
  }, [unsavedModelFile, unsavedModelData, unsavedThumbnailData, metadata, models]);
  
  /**
   * Handle animation save
   */
  const handleAnimationSave = useCallback(async (_id: string, name: string, description: string) => {
    if (!pendingAnimationClip || !pendingAnimationFile) return;
    
    // Generate descriptive name if not provided
    const descriptiveName = name || generateDescriptiveName(description);
    
    // Check for conflicts and add number if needed
    const getAllResult = await animations.getAll();
    const existingNames = hasData<AnimationRecord[]>(getAllResult) && getAllResult.data ? getAllResult.data.map((a: AnimationRecord) => a.name) : [];
    const uniqueName = generateUniqueName(descriptiveName, existingNames);
    
    // Save animation to database
    const fileData = await pendingAnimationFile.arrayBuffer();
    const result = await animations.save({
      name: uniqueName,
      displayName: uniqueName,
      description: description || '',
      category: '',
      tags: [],
      format: getFileExtension(pendingAnimationFile.name) as 'bvh' | 'vrma' | 'gltf' | 'fbx',
      duration: pendingAnimationClip.duration,
      fps: 30,
      frameCount: Math.floor(pendingAnimationClip.duration * 30),
      author: '',
      license: '',
      thumbnail: '',
      data: fileData,
      size: fileData.byteLength,
    });
    
    if (!result.success) {
      console.error('Failed to save animation:', result.error);
      return;
    }
    
    // Load and play animation
    await loadAnimationFromFile(pendingAnimationFile);
    playAnimation();
    play();
    
    // Clear pending state
    setPendingAnimationFile(null);
    setPendingAnimationClip(null);
    setIsAnimationEditorOpen(false);
  }, [pendingAnimationClip, pendingAnimationFile, animations, loadAnimationFromFile, playAnimation, play]);

  /**
   * Handle animation play from library
   */
  const handleAnimationPlay = useCallback(async (animationId: string) => {
    const result = await animations.getByUuid(animationId);
    if (result.success && result.data) {
      const animationRecord = result.data;
      // Create a File from ArrayBuffer data
      const file = new File([animationRecord.data], `${animationRecord.name}.${animationRecord.format}`, {
        type: animationRecord.format === 'bvh' ? 'text/plain' : 'application/octet-stream',
      });
      // Load and play animation
      await loadAnimationFromFile(file);
      playAnimation();
      play();
    }
  }, [animations, loadAnimationFromFile, playAnimation, play]);

  /**
   * Handle animation delete from library
   */
  const handleAnimationDelete = useCallback(async (animationId: string) => {
    const result = await animations.delete(animationId);
    if (result.success) {
      console.log('Animation deleted:', animationId);
    } else {
      console.error('Failed to delete animation:', result.error);
    }
  }, [animations]);

  /**
   * Handle animation update from library
   */
  const handleAnimationUpdate = useCallback(async (animationId: string, name: string, description: string) => {
    const result = await animations.getByUuid(animationId);
    if (result.success && result.data) {
      const updateResult = await animations.update(animationId, {
        name,
        displayName: name,
        description,
      });
      if (!updateResult.success) {
        console.error('Failed to update animation:', updateResult.error);
      }
    }
  }, [animations]);

  /**
   * Handle model load from library
   */
  const handleModelLoad = useCallback(async (modelId: string) => {
    // Clear unsaved state when loading from library
    setUnsavedModelFile(null);
    setUnsavedModelData(null);
    setUnsavedThumbnailData(null);
    
    // Set current model UUID to enable thumbnail re-capture
    setCurrentModelUuid(modelId);
    
    const result = await models.getByUuid(modelId);
    if (hasSuccessAndData<ModelRecord>(result)) {
      const modelRecord = result.data;
      // Create a File from ArrayBuffer data
      const file = new File([modelRecord.data], `${modelRecord.name}.${modelRecord.format}`, {
        type: modelRecord.format === 'vrm' ? 'application/octet-stream' : 'model/gltf-binary',
      });
      // Load model
      await loadModelFromFile(file);
    }
  }, [models, loadModelFromFile]);

  /**
   * Handle model delete from library
   */
  const handleModelDelete = useCallback(async (modelId: string) => {
    const result = await models.delete(modelId);
    if (result.success) {
      console.log('Model deleted:', modelId);
      
      // Clear the current model from viewer if the deleted model is currently loaded
      if (currentModelUuid === modelId) {
        clearCurrentModel();
        setCurrentModelUuid(null);
      }
      
      return { success: true };
    } else {
      console.error('Failed to delete model:', result.error);
      return { success: false, error: result.error };
    }
  }, [models, currentModelUuid, clearCurrentModel]);

  /**
   * Handle model update from library
   */
  const handleModelUpdate = useCallback(async (modelId: string, name: string, description: string) => {
    const result = await models.getByUuid(modelId);
    if (hasSuccessAndData<ModelRecord>(result)) {
      const updateResult = await models.update(modelId, {
        name,
        displayName: name,
        description,
      });
      if (!updateResult.success) {
        console.error('Failed to update model:', updateResult.error);
      }
    }
  }, [models]);

  /**
   * Handle export
   */
  const handleExport = useCallback(async (options: ExportOptionsData) => {
    if (!currentModel) return;
    
    try {
      if (options.format === 'vrm') {
        // Export VRM
        const result = await exportVRM(currentModel.scene);

        if (!result.success) {
          console.error('VRM export failed:', result.error);
          return;
        }

        console.log('VRM export successful:', result.data);
      } else if (options.format === 'vrma' && currentAnimation) {
        // Export VRMA
        const result = await exportVRMA(currentAnimation, {
          format: 'vrma',
          animationName: options.name,
          animationDuration: currentAnimation.duration,
          animationFPS: 30,
          metadata: {
            title: options.name,
            version: options.version || '1.0',
            author: options.author || 'Unknown',
          },
          quality: options.quality,
        });

        if (!result.success) {
          console.error('VRMA export failed:', result.error);
          return;
        }

        console.log('VRMA export successful:', result.data);
      }
      
      setIsExportDialogOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [currentModel, currentAnimation, exportVRM, exportVRMA]);

  /**
   * Handle thumbnail capture (manual re-capture)
   */
  const handleThumbnailCapture = useCallback(async () => {
    if (!vrmViewerRef.current) {
      console.warn('No model loaded to capture thumbnail');
      return;
    }
    
    try {
      setIsCapturing(true);
      
      const thumbnailDataUrl = await vrmViewerRef.current!.captureThumbnail();
      
      // If model is saved, update thumbnail in database
      if (currentModelUuid) {
        const { format, data } = parseDataUrl(thumbnailDataUrl);
        
        // Delete old thumbnail if exists
        await thumbnailService.deleteThumbnailByTarget(currentModelUuid);
        
        // Save new thumbnail
        const result = await thumbnailService.saveThumbnail({
          uuid: crypto.randomUUID(),
          name: `${currentModelUuid}_thumbnail`,
          type: 'model',
          targetUuid: currentModelUuid,
          data,
          format,
          width: 256,
          height: 256,
          size: data.length,
          createdAt: new Date(),
        });
        
        if (result.success && result.data) {
          // Update model record with new thumbnail UUID
          await models.update(currentModelUuid, {
            thumbnail: result.data.uuid,
          });
          console.log('Thumbnail updated:', result.data.uuid);
        }
      } else if (unsavedModelFile) {
        // If model is unsaved, store thumbnail data for later saving
        setUnsavedThumbnailData(thumbnailDataUrl);
        console.log('Thumbnail captured (will be saved when model is saved)');
      }
    } catch (error) {
      console.error('Failed to capture thumbnail:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [currentModelUuid, unsavedModelFile, models]);

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
    if (cameraManager) {
      cameraManager.resetCamera();
    }
  }, []);

  /**
   * Handle visibility toggle
   */
  const handleVisibilityToggle = useCallback(() => {
    if (vrmViewerRef.current) {
      vrmViewerRef.current.toggleVisibility();
      setIsModelVisible(vrmViewerRef.current.isVisible());
    }
  }, []);

  /**
   * Handle wireframe toggle
   */
  const handleWireframeToggle = useCallback(() => {
    if (vrmViewerRef.current) {
      vrmViewerRef.current.toggleWireframe();
      setIsModelWireframe(vrmViewerRef.current.isWireframe());
    }
  }, []);

  const hasModel = !!currentModel;
  const hasAnimation = !!currentAnimation;

  return (
    <MainLayout
      onAnimationPlay={handleAnimationPlay}
      onAnimationDelete={handleAnimationDelete}
      onAnimationUpdate={handleAnimationUpdate}
      onModelLoad={handleModelLoad}
      onModelDelete={handleModelDelete}
      onModelUpdate={handleModelUpdate}
      onExport={() => setIsExportDialogOpen(true)}
    >
      <div className="relative flex flex-col h-full">
        {/* Viewer */}
        <div className="flex-1 relative">
          <VRMViewer ref={vrmViewerRef} />
          
          {hasModel && (
            <>
              {/* Save Model Button (only for unsaved models) */}
              {unsavedModelFile && (
                <div className="absolute top-4 left-4 z-10">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveModel}
                    disabled={isSaving}
                    loading={isSaving}
                    title="Save model to library"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Model
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <ThumbnailCapture
                onCapture={handleThumbnailCapture}
                isCapturing={isCapturing}
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
                  isVisible={isModelVisible}
                  onVisibilityToggle={handleVisibilityToggle}
                  isWireframe={isModelWireframe}
                  onWireframeToggle={handleWireframeToggle}
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
              <DropZone
                onDrop={handleDrop}
                disabled={!isInitialized}
              />
              
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

