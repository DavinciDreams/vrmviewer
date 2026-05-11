import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { VRMViewer, VRMViewerHandle } from './components/viewer/VRMViewer';
import { ThumbnailCapture } from './components/viewer/ThumbnailCapture';
import { DropZone } from './components/dragdrop/DropZone';
import { FilePreview } from './components/dragdrop/FilePreview';
import { AnimationControls } from './components/controls/AnimationControls';
import { PlaybackControls } from './components/controls/PlaybackControls';
import { ModelControls } from './components/controls/ModelControls';
import { CameraControls } from './components/controls/CameraControls';
import { ExpressionPanel } from './components/controls/ExpressionPanel';
import { IdleAnimationPanel } from './components/controls/IdleAnimationPanel';
import { LightingPanel } from './components/controls/LightingPanel';
import { PosePanel } from './components/controls/PosePanel';
import { VRMInfoPanel } from './components/controls/VRMInfoPanel';
import { ExportDialog, ExportOptionsData } from './components/export/ExportDialog';
import { AnimationEditor } from './components/database/AnimationEditor';
import { Button } from './components/ui/Button';
import { useModel } from './hooks/useModel';
import { useAnimationStore } from './store/animationStore';
import { usePlayback } from './hooks/usePlayback';
import { useAnimation } from './hooks/useAnimation';
import { useIdleAnimation } from './hooks/useIdleAnimation';
import { useBlendShapes } from './hooks/useBlendShapes';
import { useExport } from './hooks/useExport';
import { useDatabase } from './hooks/useDatabase';
import { useDAMIntegration } from './hooks/useDAMIntegration';
import { getFileExtension, getFileTypeFromExtension } from './constants/formats';
import { generateDescriptiveName, generateUniqueName } from './utils/namingUtils';
import { bvhLoader } from './core/three/loaders/BVHLoader';
import { vrmaLoader } from './core/three/loaders/VRMALoader';
import { cameraManager } from './core/three/scene/CameraManager';
import { VRMHelper } from './core/three/vrm/VRMHelper';
import { extractAllMetadata } from './core/metadata/MetadataPipeline';
import { getThumbnailService } from './core/database/services/ThumbnailService';
import { getPreferencesService } from './core/database/services/PreferencesService';
import { parseDataUrl } from './utils/thumbnailUtils';
import * as THREE from 'three';
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
  // Model (format-agnostic — replaces the deprecated useVRM)
  const { currentModel, isLoading, error, metadata, loadModelFromFile, clearCurrentModel } = useModel();
  // Playback
  const { play, pause, stop, seek, setSpeed, toggleLoop } = usePlayback();
  // Animation
  const { currentAnimation, loadFromFile: loadAnimationFromFile, play: playAnimation, pause: pauseAnimation, stop: stopAnimation, setSpeed: setAnimationSpeed } = useAnimation();
  // Idle Animation
  const { start: startIdleAnimation, stop: stopIdleAnimation } = useIdleAnimation();
  // Blend Shapes
  const {
    clearExpression,
    currentExpression,
    expressionWeight,
    currentLipSync,
    lipSyncWeight,
  } = useBlendShapes();
  // Export
  const { exportVRM, exportVRMA, exportGLTF } = useExport();
  // Database
  const { isInitialized, animations, models } = useDatabase();
  // DAM Integration
  const { config: damConfig, loadingState: damLoadingState, clearDAMState } = useDAMIntegration();
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

  // Camera controls panel collapsed by default (it's a tertiary control)
  const [isCameraPanelOpen, setIsCameraPanelOpen] = useState(false);
  // Expression / idle-motion panels — collapsed by default to keep the
  // viewer uncluttered for first-time users.
  const [isExpressionPanelOpen, setIsExpressionPanelOpen] = useState(false);
  const [isIdlePanelOpen, setIsIdlePanelOpen] = useState(false);
  const [isLightingPanelOpen, setIsLightingPanelOpen] = useState(false);
  const [isPosePanelOpen, setIsPosePanelOpen] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  
  // Track thumbnail capture state for visual feedback
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Track unsaved model state
  const [unsavedModelFile, setUnsavedModelFile] = useState<File | null>(null);
  const [unsavedModelData, setUnsavedModelData] = useState<ArrayBuffer | null>(null);
  const [unsavedThumbnailData, setUnsavedThumbnailData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Thumbnail service (singleton — stable identity for hook deps)
  const thumbnailService = useMemo(() => getThumbnailService(), []);
  const [autoCapturedThumbnail, setAutoCapturedThumbnail] = useState<string | null>(null);
  
  /**
   * Handle auto-captured thumbnail from VRMViewer
   */
  const handleAutoThumbnailCaptured = useCallback((thumbnail: string) => {
    setAutoCapturedThumbnail(thumbnail);
    console.log('Auto-captured thumbnail from viewer');
  }, []);
  
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
   * Initialize the animation/blend-shape/idle managers against the current
   * VRM. Without this, VRMViewer's render-loop calls (`animationManager?.
   * update()` etc.) run on `null` and animations / expressions / idle
   * motion silently no-op. Previously lived inside `useVRM`; now lives
   * here so `useModel` (which is format-agnostic) doesn't need to own it.
   *
   * Cleanup disposes the managers — runs on unmount AND before re-applying
   * for a new VRM, so loading model B after model A gets fresh managers.
   */
  useEffect(() => {
    if (currentModel?.vrm) {
      useAnimationStore.getState().initializeManagers(currentModel.vrm);
    }
    return () => {
      useAnimationStore.getState().disposeManagers();
    };
  }, [currentModel]);

  /**
   * Auto-restore the last loaded model + camera state on app startup.
   *
   * Run once after the database initializes. Pulls the saved 'lastModelUuid'
   * preference and re-opens that model into the viewer so the user picks up
   * exactly where they left off, then applies the saved camera position/target
   * once `cameraManager` is available (it's created lazily by VRMViewer when
   * the canvas first mounts, hence the polling).
   */
  useEffect(() => {
    if (!isInitialized) return;
    let cancelled = false;

    const restoreSession = async () => {
      const prefs = getPreferencesService();

      try {
        const modelUuidResult = await prefs.getPreference<string>('lastModelUuid');
        if (cancelled) return;
        if (modelUuidResult.success && modelUuidResult.data) {
          const modelResult = await models.getByUuid(modelUuidResult.data);
          if (cancelled) return;
          if (hasSuccessAndData<ModelRecord>(modelResult)) {
            const rec = modelResult.data;
            const file = new File([rec.data], `${rec.name}.${rec.format}`, {
              type: rec.format === 'vrm' ? 'application/octet-stream' : 'model/gltf-binary',
            });
            const loaded = await loadModelFromFile(file);
            if (cancelled) return;
            // Only pin the UUID if the load actually produced a model — a
            // corrupt ArrayBuffer here would otherwise leave the app
            // pointing at a UUID with no live model in the viewer, breaking
            // subsequent thumbnail-capture flows.
            if (loaded) {
              setCurrentModelUuid(rec.uuid);
            } else {
              console.warn('[resume] last model loaded as empty — skipping UUID pin');
            }
          }
        }
      } catch (err) {
        console.warn('[resume] failed to restore last model:', err);
      }

      // Restore last animation that was playing.
      try {
        const animUuidResult = await prefs.getPreference<string>('lastAnimationUuid');
        if (cancelled) return;
        if (animUuidResult.success && animUuidResult.data) {
          const animResult = await animations.getByUuid(animUuidResult.data);
          if (cancelled) return;
          if (animResult.success && animResult.data) {
            const animRec = animResult.data;
            const animFile = new File([animRec.data], `${animRec.name}.${animRec.format}`, {
              type: animRec.format === 'bvh' ? 'text/plain' : 'application/octet-stream',
            });
            await loadAnimationFromFile(animFile);
            if (cancelled) return;
            playAnimation();
            play();
          }
        }
      } catch (err) {
        console.warn('[resume] failed to restore last animation:', err);
      }

      // Restore facial state (expression preset + lip-sync viseme).
      // The BlendShapeManager appears once `currentModel?.vrm` triggers
      // `useAnimationStore.initializeManagers(...)` (see the effect on
      // `currentModel`), so we poll for it like cameraManager.
      try {
        const facialResult = await prefs.getPreference<{
          expression?: string | null;
          expressionWeight?: number;
          lipSync?: string | null;
          lipSyncWeight?: number;
        }>('facialState');
        if (cancelled) return;
        if (facialResult.success && facialResult.data) {
          const target = facialResult.data;
          const apply = () => {
            const mgr = useAnimationStore.getState().blendShapeManager;
            if (!mgr || !mgr.isInitialized()) return false;
            if (target.expression) {
              try {
                mgr.setExpression(
                  target.expression as Parameters<typeof mgr.setExpression>[0],
                  target.expressionWeight ?? 1,
                );
              } catch (e) {
                console.warn('[resume] invalid expression preset, skipping:', target.expression, e);
              }
            }
            if (target.lipSync) {
              try {
                mgr.setLipSync(
                  target.lipSync as Parameters<typeof mgr.setLipSync>[0],
                  target.lipSyncWeight ?? 1,
                );
              } catch (e) {
                console.warn('[resume] invalid viseme, skipping:', target.lipSync, e);
              }
            }
            return true;
          };
          if (!apply()) {
            for (let i = 0; i < 20; i++) {
              await new Promise((r) => setTimeout(r, 100));
              if (cancelled) return;
              if (apply()) break;
            }
          }
        }
      } catch (err) {
        console.warn('[resume] failed to restore facial state:', err);
      }

      // Restore wireframe/visibility toggles. VRMViewer's imperative handle
      // appears once the canvas mounts, so poll like we do for cameraManager.
      try {
        const visualResult = await prefs.getPreference<{ wireframe: boolean; visible: boolean }>('viewerToggles');
        if (cancelled) return;
        if (visualResult.success && visualResult.data) {
          const target = visualResult.data;
          const apply = () => {
            const handle = vrmViewerRef.current;
            if (!handle) return false;
            if (target.wireframe !== handle.isWireframe()) handle.toggleWireframe();
            if (target.visible !== handle.isVisible()) handle.toggleVisibility();
            setIsModelWireframe(handle.isWireframe());
            setIsModelVisible(handle.isVisible());
            return true;
          };
          if (!apply()) {
            for (let i = 0; i < 20; i++) {
              await new Promise((r) => setTimeout(r, 100));
              if (cancelled) return;
              if (apply()) break;
            }
          }
        }
      } catch (err) {
        console.warn('[resume] failed to restore viewer toggles:', err);
      }

      // Camera restore — wait briefly for VRMViewer to initialise cameraManager.
      try {
        const cameraResult = await prefs.getPreference<{
          position: { x: number; y: number; z: number };
          target: { x: number; y: number; z: number };
        }>('camera');
        if (cancelled) return;
        if (cameraResult.success && cameraResult.data) {
          const apply = () => {
            if (!cameraManager) return false;
            cameraManager.setCameraPosition(
              new THREE.Vector3(
                cameraResult.data!.position.x,
                cameraResult.data!.position.y,
                cameraResult.data!.position.z
              )
            );
            cameraManager.setCameraTarget(
              new THREE.Vector3(
                cameraResult.data!.target.x,
                cameraResult.data!.target.y,
                cameraResult.data!.target.z
              )
            );
            return true;
          };
          if (!apply()) {
            // Poll up to ~2s for the canvas-driven cameraManager init
            for (let i = 0; i < 20; i++) {
              await new Promise((r) => setTimeout(r, 100));
              if (cancelled) return;
              if (apply()) break;
            }
          }
        }
      } catch (err) {
        console.warn('[resume] failed to restore camera:', err);
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
    // Run once when DB is ready; re-running would re-load the model on every
    // re-render which is not what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  /**
   * Persist facial state (expression preset + lip-sync viseme + weights) on
   * change. Debounced 250ms so dragging the weight slider doesn't hammer
   * IndexedDB. Saving null/null clears so we don't re-apply a long-gone
   * expression next session.
   */
  useEffect(() => {
    if (!isInitialized) return;
    const handle = setTimeout(() => {
      getPreferencesService()
        .setPreference('facialState', {
          expression: currentExpression,
          expressionWeight,
          lipSync: currentLipSync,
          lipSyncWeight,
        })
        .catch((err) => console.warn('[resume] facialState save failed:', err));
    }, 250);
    return () => clearTimeout(handle);
  }, [isInitialized, currentExpression, expressionWeight, currentLipSync, lipSyncWeight]);

  /**
   * Persist camera position/target to preferences on user interaction.
   * Throttled to one save per 500ms so dragging the orbit controls doesn't
   * hammer IndexedDB.
   */
  useEffect(() => {
    if (!isInitialized) return;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let attached = false;
    let controls: ReturnType<NonNullable<typeof cameraManager>['getControls']> | null = null;

    let cancelled = false;
    const handleControlsChange = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        // The effect's cleanup may have already run between schedule and fire
        // (e.g. on hot reload, or if `isInitialized` flips). Bail rather than
        // writing stale coords past the cleanup.
        if (cancelled) return;
        if (!cameraManager) return;
        const cam = cameraManager.getCamera();
        const ctrls = cameraManager.getControls();
        const snapshot = {
          position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          target: { x: ctrls.target.x, y: ctrls.target.y, z: ctrls.target.z },
          zoom: cam.zoom,
        };
        getPreferencesService()
          .setPreference('camera', snapshot)
          .catch((err) => console.warn('[resume] camera save failed:', err));
      }, 500);
    };

    const tryAttach = () => {
      if (attached || !cameraManager) return false;
      controls = cameraManager.getControls();
      controls.addEventListener('end', handleControlsChange);
      attached = true;
      return true;
    };

    // cameraManager is set up by VRMViewer on canvas mount — poll briefly.
    let pollHandle: ReturnType<typeof setTimeout> | null = null;
    const poll = (attemptsLeft: number) => {
      if (tryAttach() || attemptsLeft <= 0) return;
      pollHandle = setTimeout(() => poll(attemptsLeft - 1), 100);
    };
    poll(20);

    return () => {
      cancelled = true;
      if (pollHandle) clearTimeout(pollHandle);
      if (saveTimer) clearTimeout(saveTimer);
      if (attached && controls) {
        controls.removeEventListener('end', handleControlsChange);
      }
    };
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
      setAutoCapturedThumbnail(null);

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
  }, [loadModelFromFile, clearCurrentModel]);

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
  }, [isInitialized, handleFileLoad]);
  
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

      const format = getFileExtension(unsavedModelFile.name) as 'vrm' | 'gltf' | 'glb' | 'fbx';

      // Run the metadata extraction pipeline against the live scene before
      // saving. Each extractor is independently try/catch-guarded inside the
      // pipeline, so a single failure here can't block the save — we'll fall
      // back to a bundle-less save.
      let extractedBundle = undefined;
      if (currentModel?.scene) {
        try {
          extractedBundle = await extractAllMetadata({
            scene: currentModel.scene,
            vrm: currentModel.vrm,
            buffer: unsavedModelData,
            format,
          });
        } catch (err) {
          console.warn('[save] metadata extraction failed; saving without bundle:', err);
        }
      }

      // Save model to database. When the bundle is present, ModelService
      // merges its promoted fields (sha256, polyBucket, isHumanoid, etc.) onto
      // the record and runs a sha256 dedup check.
      const result = await models.save(
        {
          name: modelName,
          displayName: modelName,
          description: '',
          category: '',
          tags: [],
          format,
          version: '1.0',
          author: '',
          license: '',
          thumbnail: '',
          data: unsavedModelData,
          size: unsavedModelData.byteLength,
        },
        undefined,
        extractedBundle,
      );

      if (!hasSuccessAndData<{ uuid: string }>(result)) {
        console.error('Failed to save model:', result.error);
        return;
      }

      // The save may have hit dedup and returned an existing model rather
      // than creating a new one. Surface that to the console so the user
      // understands why the library count didn't change.
      if ('wasDeduped' in result && (result as { wasDeduped?: boolean }).wasDeduped) {
        console.info('Model already exists in library; loaded existing record.');
      }

      const modelUuid = result.data.uuid;
      setCurrentModelUuid(modelUuid);

      // Remember this as the last loaded model so the next session resumes here.
      getPreferencesService()
        .setPreference('lastModelUuid', modelUuid)
        .catch((err) => console.warn('[resume] lastModelUuid save failed:', err));

      // Capture and save thumbnail. Either the manual capture
      // (`unsavedThumbnailData`) or the viewer-driven auto-capture is fine —
      // both are already data-URLs at this point.
      const thumbnailToSave = unsavedThumbnailData || autoCapturedThumbnail;
      if (thumbnailToSave) {
        const { format, data } = parseDataUrl(thumbnailToSave);

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
      setAutoCapturedThumbnail(null);
      
      console.log('Model saved:', modelName);
    } catch (error) {
      console.error('Failed to save model:', error);
    } finally {
      setIsSaving(false);
    }
  }, [unsavedModelFile, unsavedModelData, unsavedThumbnailData, autoCapturedThumbnail, metadata, models, thumbnailService, currentModel]);
  
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

      // Remember this as the last animation so the next session resumes here.
      getPreferencesService()
        .setPreference('lastAnimationUuid', animationId)
        .catch((err) => console.warn('[resume] lastAnimationUuid save failed:', err));
    }
  }, [animations, loadAnimationFromFile, playAnimation, play]);
  
  /**
   * Handle animation delete from library
   */
  const handleAnimationDelete = useCallback(async (animationId: string) => {
    // If we're deleting the animation pinned for resume, drop the pin first.
    const lastResult = await getPreferencesService()
      .getPreference<string>('lastAnimationUuid')
      .catch(() => null);
    if (lastResult?.success && lastResult.data === animationId) {
      getPreferencesService().deletePreference('lastAnimationUuid').catch(() => {});
    }
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

      // Remember this as the last loaded model for next session.
      getPreferencesService()
        .setPreference('lastModelUuid', modelId)
        .catch((err) => console.warn('[resume] lastModelUuid save failed:', err));
    }
  }, [models, loadModelFromFile]);
  
  /**
   * Handle model delete from library
   */
  const handleModelDelete = useCallback(async (modelId: string) => {
    const result = await models.delete(modelId);
    if (result.success) {
      console.log('Model deleted:', modelId);

      // Clear current model from viewer if deleted model is currently loaded
      if (currentModelUuid === modelId) {
        clearCurrentModel();
        setCurrentModelUuid(null);
        // Don't keep pointing the resume flow at a model that no longer exists.
        getPreferencesService()
          .deletePreference('lastModelUuid')
          .catch((err) => console.warn('[resume] lastModelUuid clear failed:', err));
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
        // Build VRM-specific overrides from dialog selections.
        const result = await exportVRM(currentModel.scene, {
          quality: options.quality,
          removeUnnecessaryVertices: options.removeUnnecessaryVertices,
          combineSkeletons: options.combineSkeletons,
          combineMorphs: options.combineMorphs,
          metadata: {
            title: options.name,
            version: options.version || '1.0',
            author: options.author || 'Unknown',
            license: options.license,
            allowedUserName: options.allowedUserName,
            violentUsageName: options.violentUsageName,
            sexualUsageName: options.sexualUsageName,
            commercialUsageName: options.commercialUsageName,
            contactInformation: options.contactInformation,
            reference: options.reference,
            otherLicenseUrl: options.otherLicenseUrl,
          },
        });

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
      } else if (options.format === 'glb' || options.format === 'gltf') {
        // Export via the universal GLTFExporterEnhanced (was previously a no-op for glb)
        const result = await exportGLTF(currentModel.scene, options.format);
        if (!result.success) {
          console.error(`${options.format.toUpperCase()} export failed:`, result.error);
          return;
        }
        console.log(`${options.format.toUpperCase()} export successful:`, result.data);
      } else {
        console.warn('Unsupported export format:', options.format);
      }

      setIsExportDialogOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [currentModel, currentAnimation, exportVRM, exportVRMA, exportGLTF]);
  
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
  }, [currentModelUuid, unsavedModelFile, models, thumbnailService]);
  
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
   * Resets bone transforms to bind pose AND clears any blend-shape expression.
   * Previously this only cleared blend shapes, leaving the user's pose unchanged.
   */
  const handleResetPose = useCallback(() => {
    if (!currentModel) return;
    if (currentModel.vrm) {
      VRMHelper.resetAllBonePoses(currentModel.vrm);
    }
    clearExpression();
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
      const visible = vrmViewerRef.current.isVisible();
      const wireframe = vrmViewerRef.current.isWireframe();
      setIsModelVisible(visible);
      getPreferencesService()
        .setPreference('viewerToggles', { wireframe, visible })
        .catch((err) => console.warn('[resume] viewerToggles save failed:', err));
    }
  }, []);

  /**
   * Handle wireframe toggle
   */
  const handleWireframeToggle = useCallback(() => {
    if (vrmViewerRef.current) {
      vrmViewerRef.current.toggleWireframe();
      const wireframe = vrmViewerRef.current.isWireframe();
      const visible = vrmViewerRef.current.isVisible();
      setIsModelWireframe(wireframe);
      getPreferencesService()
        .setPreference('viewerToggles', { wireframe, visible })
        .catch((err) => console.warn('[resume] viewerToggles save failed:', err));
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
          <VRMViewer
            ref={vrmViewerRef}
            onThumbnailCaptured={handleAutoThumbnailCaptured}
          />
          
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

              {/* Side-panels (collapsible, stacked top-right) */}
              <div className="absolute top-4 right-4 z-10 w-64 space-y-2">
                {/* Expression / blend shapes */}
                <div>
                  <button
                    onClick={() => setIsExpressionPanelOpen((v) => !v)}
                    className="w-full px-3 py-2 mb-2 bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm text-gray-200 hover:bg-gray-700/90 transition-colors flex items-center justify-between"
                    aria-expanded={isExpressionPanelOpen}
                    aria-controls="expression-panel"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Expression
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpressionPanelOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {/* Always render — `aria-controls` references must point at
                      a live DOM node per ARIA spec. `hidden` plus the
                      conditional inner mount keeps the cost low. */}
                  <div id="expression-panel" hidden={!isExpressionPanelOpen}>
                    {isExpressionPanelOpen && <ExpressionPanel />}
                  </div>
                </div>

                {/* Idle motion */}
                <div>
                  <button
                    onClick={() => setIsIdlePanelOpen((v) => !v)}
                    className="w-full px-3 py-2 mb-2 bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm text-gray-200 hover:bg-gray-700/90 transition-colors flex items-center justify-between"
                    aria-expanded={isIdlePanelOpen}
                    aria-controls="idle-panel"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Idle Motion
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isIdlePanelOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div id="idle-panel" hidden={!isIdlePanelOpen}>
                    {isIdlePanelOpen && <IdleAnimationPanel />}
                  </div>
                </div>

                {/* Pose */}
                <div>
                  <button
                    onClick={() => setIsPosePanelOpen((v) => !v)}
                    className="w-full px-3 py-2 mb-2 bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm text-gray-200 hover:bg-gray-700/90 transition-colors flex items-center justify-between"
                    aria-expanded={isPosePanelOpen}
                    aria-controls="pose-panel"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pose
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isPosePanelOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div id="pose-panel" hidden={!isPosePanelOpen}>
                    {isPosePanelOpen && <PosePanel vrm={currentModel?.vrm ?? null} />}
                  </div>
                </div>

                {/* VRM info */}
                <div>
                  <button
                    onClick={() => setIsInfoPanelOpen((v) => !v)}
                    className="w-full px-3 py-2 mb-2 bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm text-gray-200 hover:bg-gray-700/90 transition-colors flex items-center justify-between"
                    aria-expanded={isInfoPanelOpen}
                    aria-controls="info-panel"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Info
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isInfoPanelOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div id="info-panel" hidden={!isInfoPanelOpen}>
                    {isInfoPanelOpen && <VRMInfoPanel vrm={currentModel?.vrm ?? null} />}
                  </div>
                </div>

                {/* Lighting */}
                <div>
                  <button
                    onClick={() => setIsLightingPanelOpen((v) => !v)}
                    className="w-full px-3 py-2 mb-2 bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm text-gray-200 hover:bg-gray-700/90 transition-colors flex items-center justify-between"
                    aria-expanded={isLightingPanelOpen}
                    aria-controls="lighting-panel"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Lighting
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isLightingPanelOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div id="lighting-panel" hidden={!isLightingPanelOpen}>
                    {isLightingPanelOpen && <LightingPanel />}
                  </div>
                </div>

                {/* Camera */}
                <div>
                  <button
                    onClick={() => setIsCameraPanelOpen((v) => !v)}
                    className="w-full px-3 py-2 mb-2 bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm text-gray-200 hover:bg-gray-700/90 transition-colors flex items-center justify-between"
                    aria-expanded={isCameraPanelOpen}
                    aria-controls="camera-controls-panel"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                      Camera
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isCameraPanelOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div id="camera-controls-panel" hidden={!isCameraPanelOpen}>
                    {isCameraPanelOpen && <CameraControls />}
                  </div>
                </div>
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
        {(isLoading || damLoadingState.isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gray-900/80">
            <div className="text-center">
              <svg className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357 2m15.357 2H15" />
              </svg>
              <p className="text-gray-300 text-sm">
                {damConfig.model ? 'Loading from DAM...' : 'Loading model...'}
              </p>
              {damConfig.model && (
                <p className="text-gray-400 text-xs mt-2 truncate max-w-xs mx-auto">
                  {damConfig.model}
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Error indicator */}
        {(error || damLoadingState.error) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gray-900/80">
            <div className="text-center">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm mb-2">Error loading model</p>
              <p className="text-gray-400 text-xs">{error || damLoadingState.error}</p>
              <button
                onClick={() => {
                  clearCurrentModel();
                  clearDAMState();
                }}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Clear Error
              </button>
              {damConfig.model && (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg max-w-md mx-auto">
                  <p className="text-gray-300 text-xs mb-2">DAM Configuration:</p>
                  <p className="text-blue-400 text-xs break-all">Model: {damConfig.model}</p>
                  {damConfig.animation && <p className="text-blue-400 text-xs break-all">Animation: {damConfig.animation}</p>}
                  {damConfig.autoplay && <p className="text-green-400 text-xs">Autoplay: enabled</p>}
                  {damConfig.camera && <p className="text-purple-400 text-xs">Camera: {damConfig.camera}</p>}
                </div>
              )}
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
