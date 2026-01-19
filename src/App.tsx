import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MainLayout } from './components/layout/MainLayout';
import { VRMViewer, VRMViewerHandle } from './components/viewer/VRMViewer';
import { DropZone } from './components/dragdrop/DropZone';
import { FilePreview } from './components/dragdrop/FilePreview';
import { AnimationControls } from './components/controls/AnimationControls';
import { PlaybackControls } from './components/controls/PlaybackControls';
import { ModelControls } from './components/controls/ModelControls';
import { ExportDialog, ExportOptionsData } from './components/export/ExportDialog';
import { AnimationEditor } from './components/database/AnimationEditor';
import { getModelService } from './core/database/services/ModelService';
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
import { useVRMStore } from './store/vrmStore';
import { loaderManager } from './core/three/loaders/LoaderManager';
import { vrmLoader } from './core/three/loaders/VRMLoader';
import { validateModelFile } from './utils/fileUtils';
import { ModelRecord } from './types/database.types';

function App() {
  // VRM
  const {
    currentModel,
    isLoading,
    error,
    loadModelFromFile,
  } = useVRM();
  
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
  const { isInitialized, animations, models: dbModels } = useDatabase();
  
  // VRM Store state
  const {
    setModel,
    clearModel: clearVRMModel,
    name: modelName,
    description: modelDescription,
    setName,
    setDescription,
    modelId,
    setModelId,
    model: vrmStoreModel,
  } = useVRMStore();
  
  // Autosave state
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // ModelService
  const modelService = getModelService();
  
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
  
  // Autosave effect
  useEffect(() => {
    if (!vrmStoreModel) return;
 
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
 
    autosaveTimeout.current = setTimeout(async () => {
      setIsAutosaving(true);
      setAutosaveError(null);
      try {
        // Use stored buffer from model entry
        const modelBuffer = vrmStoreModel.buffer;
        if (!modelBuffer) {
          setAutosaveError('Model binary data missing');
          setIsAutosaving(false);
          return;
        }
        // Capture thumbnail if needed
        let thumbnailData = undefined;
        if (vrmViewerRef.current) {
          const dataUrl = await vrmViewerRef.current.captureThumbnail();
          thumbnailData = dataUrl.split(',')[1]; // base64
        }
        // Save or update
        if (!modelId) {
          // Create new
          const result = await modelService.saveModel({
            name: modelName,
            displayName: modelName,
            description: modelDescription,
            category: '',
            tags: [],
            format: 'vrm',
            version: '1.0',
            author: '',
            license: '',
            thumbnail: '',
            data: modelBuffer,
            size: modelBuffer.byteLength,
          }, thumbnailData);
          if (result.success && result.data && result.data.uuid) {
            setModelId(result.data.uuid);
          } else {
            setAutosaveError(result.error?.message || 'Autosave failed');
          }
        } else {
          // Update existing
          const result = await modelService.updateModel(modelId, {
            name: modelName,
            displayName: modelName,
            description: modelDescription,
          });
          if (!result.success) {
            setAutosaveError(result.error?.message || 'Autosave failed');
          }
        }
      } catch (err: unknown) {
        setAutosaveError(err instanceof Error ? err.message : 'Autosave failed');
      } finally {
        setIsAutosaving(false);
      }
    }, 500);
    // Cleanup
    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
  }, [vrmStoreModel, modelName, modelDescription]);
  
  // Track current model UUID for thumbnail generation
  const [currentModelUuid, setCurrentModelUuid] = useState<string | null>(null);
  
  // Track thumbnail capture state for visual feedback
  const [_isCapturing, _setIsCapturing] = useState(false);
  
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
  const handleDrop = useCallback(async (file: File) => {
    if (!isInitialized) {
      console.warn('Database not initialized yet. Please wait...');
      return;
    }
    setDroppedFiles([file]);
    await handleFileLoad(file);
  }, [isInitialized]);
  
  /**
   * Handle file load
    */
  const handleFileLoad = useCallback(async (file: File) => {
    const extension = getFileExtension(file.name);
    const fileType = getFileTypeFromExtension(extension);
    
    if (fileType === 'model') {
      // Clear existing model before loading new one
      clearVRMModel();
      
      // Load model using new VRMStore API
      const validation = validateModelFile(file);
      
      if (!validation.valid) {
        console.error('Invalid file:', validation.error);
        return;
      }
      
      // Read file as ArrayBuffer to store original buffer
      const fileBuffer = await file.arrayBuffer();
      
      const result = await loaderManager.loadFromFile(file);
      
      if (result.success && result.data) {
        // For VRM files, use vrmLoader directly to get full VRM structure
        if (result.data.metadata?.format === 'vrm') {
          const vrmResult = await vrmLoader.loadFromFile(file);
          if (vrmResult.success && vrmResult.data) {
            // Create VRMModelEntry and set it in store
            const THREE = await import('three');
            const modelEntry = {
              id: crypto.randomUUID(),
              model: vrmResult.data,
              position: new THREE.Vector3(0, 0, 0),
              isVisible: true,
              isWireframe: false,
              scale: 1,
              loadedAt: Date.now(),
              buffer: fileBuffer,
            };
            setModel(modelEntry);
            setName(file.name.replace(/\.[^/.]+$/, ''));
          } else {
            console.error('Failed to load VRM model:', vrmResult.error);
          }
        } else {
          // For other formats (GLB, GLTF, FBX), create a VRM-like structure
          const THREE = await import('three');
          const vrmLikeModel = {
            vrm: undefined as never,
            metadata: {
              title: result.data.metadata?.name || file.name,
              version: '1.0',
              author: 'Unknown',
            },
            expressions: new Map(),
            humanoid: {
              humanBones: [],
            },
            firstPerson: undefined,
            scene: result.data.model as THREE.Group,
            skeleton: undefined as never,
          };
          
          // Create VRMModelEntry and set it in store
          const modelEntry = {
            id: crypto.randomUUID(),
            model: vrmLikeModel,
            position: new THREE.Vector3(0, 0, 0),
            isVisible: true,
            isWireframe: false,
            scale: 1,
            loadedAt: Date.now(),
            buffer: fileBuffer,
          };
          setModel(modelEntry);
          setName(file.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        console.error('Failed to load model:', result.error);
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
  }, [clearVRMModel, setModel, setName]);
  
  /**
   * Handle animation save
    */
  const handleAnimationSave = useCallback(async (_id: string, name: string, description: string) => {
    if (!pendingAnimationClip || !pendingAnimationFile) return;
    
    // Generate descriptive name if not provided
    const descriptiveName = name || generateDescriptiveName(description);
    
    // Check for conflicts and add number if needed
    const allAnimationsResult = await animations.getAll();
    const existingNames = allAnimationsResult.data
      ? allAnimationsResult.data.map((a: { name: string }) => a.name)
      : [];
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModelLoad = useCallback(async (modelId: string) => {
    // Clear existing model before loading new one
    clearVRMModel();
    
    // Set current model UUID to enable thumbnail re-capture
    setCurrentModelUuid(modelId);
    
    const result = await dbModels.getByUuid(modelId);
    if (result.success && result.data !== undefined) {
      const modelData = (result as any).data;
      // Create a File from ArrayBuffer data
      const file = new File([modelData.data], `${modelData.name}.${modelData.format}`, {
        type: modelData.format === 'vrm' ? 'application/octet-stream' : 'model/gltf-binary',
      });
      // Load model
      await loadModelFromFile(file);
    }
  }, [dbModels, loadModelFromFile, clearVRMModel, setModelId]);
  
  /**
   * Handle model delete from library
    */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModelDelete = useCallback(async (modelId: string) => {
    const result = await dbModels.delete(modelId);
    if (result.success) {
      console.log('Model deleted:', modelId);
    } else {
      console.error('Failed to delete model:', result.error);
    }
  }, [dbModels]);
  
  /**
   * Handle model update from library
    */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModelUpdate = useCallback(async (modelId: string, name: string, description: string) => {
    const result = await dbModels.getByUuid(modelId);
    if (result.success && result.data !== undefined) {
      const updateResult = await dbModels.update(modelId, {
        name,
        displayName: name,
        description,
      });
      if (!updateResult.success) {
        console.error('Failed to update model:', updateResult.error);
      }
    }
  }, [dbModels]);
  
  /**
   * Handle export
    */
  const handleExport = useCallback(async (options: ExportOptionsData) => {
    if (!currentModel) return;
    
    try {
      if (options.format === 'vrm') {
        // Export VRM
        const result = await exportVRM(currentModel);
        
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleThumbnailCapture = useCallback(async () => {
    if (!vrmViewerRef.current) {
      console.warn('No model loaded to capture thumbnail');
      return;
    }
    
    try {
      _setIsCapturing(true);
      
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
          await dbModels.update(currentModelUuid, {
            thumbnail: result.data.uuid,
          });
          console.log('Thumbnail updated:', result.data.uuid);
        }
      }
    } catch (error) {
      console.error('Failed to capture thumbnail:', error);
    } finally {
      _setIsCapturing(false);
    }
  }, [currentModelUuid, dbModels]);
  
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
    <MainLayout>
      <div className="relative flex flex-col h-full">
        {/* Viewer */}
        <div className="flex-1 relative">
          <VRMViewer ref={vrmViewerRef} />
          
          {hasModel && (
            <>
              {/* Name/Description Inputs and Autosave Indicator */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center gap-2 w-[340px] bg-black/70 rounded-lg p-4 shadow-lg">
                <input
                  className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  type="text"
                  placeholder="Model Name"
                  value={modelName}
                  onChange={e => setName(e.target.value)}
                  maxLength={64}
                  disabled={isAutosaving}
                  aria-label="Model Name"
                />
                <textarea
                  className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description (optional)"
                  value={modelDescription}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={256}
                  rows={2}
                  disabled={isAutosaving}
                  aria-label="Model Description"
                />
                <div className="flex items-center gap-2 mt-1 min-h-[24px]">
                  {isAutosaving && (
                    <span className="flex items-center text-blue-400 text-xs">
                      <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Autosaving...
                    </span>
                  )}
                  {autosaveError && (
                    <span className="flex items-center text-red-400 text-xs">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {autosaveError}
                    </span>
                  )}
                </div>
              </div>
              
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357 2m15.357 2H15" />
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
                onClick={() => window.location.reload()}
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
        defaultName={modelName || 'model_export'}
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
