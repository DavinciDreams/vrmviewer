import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { VRMViewer, VRMViewerHandle } from './components/viewer/VRMViewer';
import { ThumbnailCapture } from './components/viewer/ThumbnailCapture';
import { DropZone } from './components/dragdrop/DropZone';
import { FilePreview } from './components/dragdrop/FilePreview';
import { ModelControls } from './components/controls/ModelControls';
import { CameraControls } from './components/controls/CameraControls';
import { ExpressionPanel } from './components/controls/ExpressionPanel';
import { IdleAnimationPanel } from './components/controls/IdleAnimationPanel';
import { LightingPanel } from './components/controls/LightingPanel';
import { PosePanel } from './components/controls/PosePanel';
import { VRMInfoPanel } from './components/controls/VRMInfoPanel';
import { ExportDialog, ExportOptionsData } from './components/export/ExportDialog';
import { AnimationEditor } from './components/database/AnimationEditor';
import {
  SaveModelDialog,
  type SaveModelDialogDefaults,
  type SaveModelFormData,
} from './components/database/SaveModelDialog';
import { AssetInfoPanel } from './components/database/AssetInfoPanel';
import { Button } from './components/ui/Button';
import { BackfillProgressToast } from './components/ui/BackfillProgressToast';
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
import { runBackfillIfNeeded, type BackfillProgress } from './core/metadata/backfill';
import type { ExtractedBundle } from './core/database/services/ModelService';
import { getPreferencesService } from './core/database/services/PreferencesService';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnimationRecord, ModelRecord } from './types/database.types';

type LoadedModelRecord = ModelRecord | (Omit<ModelRecord, 'data'> & { data?: undefined });
const LOD_ORDER = ['lod0', 'lod1', 'lod2', 'lod3'] as const;

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

interface ControlSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

const ControlSection = ({ title, icon, children }: ControlSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/80">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-200 hover:bg-gray-700/60"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
};

function App() {
  // Model (format-agnostic — replaces the deprecated useVRM)
  const {
    currentModel,
    isLoading,
    error,
    metadata,
    loadModelFromFile,
    clearCurrentModel,
  } = useModel();
  // Playback
  const { play } = usePlayback();
  // Animation
  const { currentAnimation, loadFromFile: loadAnimationFromFile, play: playAnimation } = useAnimation();
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
  const [isExporting, setIsExporting] = useState(false);
  const [isModelViewerOpen, setIsModelViewerOpen] = useState(false);
  const [bottomGeneratePrompt, setBottomGeneratePrompt] = useState('');
  const [isBottomGenerating, setIsBottomGenerating] = useState(false);
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
  const [currentModelRecord, setCurrentModelRecord] = useState<LoadedModelRecord | null>(null);
  const [lodSiblingRecords, setLodSiblingRecords] = useState<LoadedModelRecord[]>([]);
  const [modelLoadStatus, setModelLoadStatus] = useState<string | null>(null);

  // Track thumbnail capture state for visual feedback
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Track unsaved model state
  const [unsavedModelFile, setUnsavedModelFile] = useState<File | null>(null);
  const [unsavedModelData, setUnsavedModelData] = useState<ArrayBuffer | null>(null);
  const [unsavedThumbnailData, setUnsavedThumbnailData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Save-model dialog: opens between the "Save Model" button click and the
  // actual save. Lets the user review + edit auto-extracted license metadata
  // before it lands in the database. The bundle is cached across the
  // open → confirm transition so we don't re-extract on save.
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveDialogDefaults, setSaveDialogDefaults] = useState<SaveModelDialogDefaults | null>(null);
  const [pendingExtractedBundle, setPendingExtractedBundle] = useState<ExtractedBundle | undefined>(undefined);
  const saveExtractionTokenRef = useRef(0);
  
  const [autoCapturedThumbnail, setAutoCapturedThumbnail] = useState<string | null>(null);

  // Live metadata-backfill progress for the toast. `null` while no backfill
  // is active; the toast also hides itself when `total === 0`.
  const [backfillProgress, setBackfillProgress] = useState<BackfillProgress | null>(null);
  
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
              setCurrentModelRecord(rec);
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
   * Run the metadata-pipeline backfill once on boot. Short-circuits when
   * the current EXTRACTOR_VERSION has already been processed for this
   * user — so the only actual work happens on a version bump or for
   * records that predate the pipeline. Yields to requestIdleCallback
   * between batches so it doesn't compete with rendering.
   */
  useEffect(() => {
    if (!isInitialized) return;
    let cancelled = false;
    runBackfillIfNeeded((progress) => {
      if (cancelled) return;
      setBackfillProgress(progress);
    }).catch((err) => {
      if (!cancelled) console.warn('[backfill] failed:', err);
    });
    return () => {
      cancelled = true;
    };
  }, [isInitialized]);

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
    const normalizedExtension = extension.replace(/^\./, '');

    setIsModelViewerOpen(true);
    setModelLoadStatus(`Loading ${file.name}...`);

    if (fileType === 'model') {
      // Clear current model and unsaved state before loading new model
      clearCurrentModel();
      setCurrentModelUuid(null);
      setCurrentModelRecord(null);
      setUnsavedModelFile(null);
      setUnsavedModelData(null);
      setUnsavedThumbnailData(null);
      setAutoCapturedThumbnail(null);

      // Load model
      const model = await loadModelFromFile(file);
      if (model) {
        const hasRenderableMesh = (() => {
          let foundMesh = false;
          model.scene?.traverse((object) => {
            if (object instanceof THREE.Mesh) foundMesh = true;
          });
          return foundMesh;
        })();

        if (normalizedExtension === 'fbx' && !hasRenderableMesh && model.animations?.length) {
          setPendingAnimationFile(file);
          setPendingAnimationClip(model.animations[0]);
          setIsAnimationEditorOpen(true);
          clearCurrentModel();
          setModelLoadStatus(`Loaded animation from ${file.name}`);
          window.setTimeout(() => setModelLoadStatus(null), 2500);
          return;
        }

        // Store unsaved model data
        const fileData = await file.arrayBuffer();
        setUnsavedModelFile(file);
        setUnsavedModelData(fileData);
        setModelLoadStatus(null);
      } else {
        setModelLoadStatus(`Could not load ${file.name}`);
        window.setTimeout(() => setModelLoadStatus(null), 5000);
      }
    } else if (fileType === 'animation') {
      // Load animation
      if (normalizedExtension === 'bvh') {
        const result = await bvhLoader.loadFromFile(file);
          if (hasSuccessAndData<{ animation: import('three').AnimationClip }>(result)) {
            setPendingAnimationFile(file);
            setPendingAnimationClip(result.data.animation);
            setIsAnimationEditorOpen(true);
            setModelLoadStatus(`Loaded animation ${file.name}`);
            window.setTimeout(() => setModelLoadStatus(null), 2500);
          }
      } else if (normalizedExtension === 'vrma') {
        const result = await vrmaLoader.loadFromFile(file);
          if (hasSuccessAndData<{ animation: import('three').AnimationClip }>(result)) {
            setPendingAnimationFile(file);
            setPendingAnimationClip(result.data.animation);
            setIsAnimationEditorOpen(true);
            setModelLoadStatus(`Loaded animation ${file.name}`);
            window.setTimeout(() => setModelLoadStatus(null), 2500);
          }
      }
    } else {
      setModelLoadStatus(`Unsupported file type: ${file.name}`);
      window.setTimeout(() => setModelLoadStatus(null), 5000);
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
    setIsModelViewerOpen(true);
    setDroppedFiles((prev) => [...prev, ...files]);

    for (const file of files) {
      await handleFileLoad(file);
    }
  }, [isInitialized, handleFileLoad]);

  useEffect(() => {
    const isFileDrag = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const handleWindowDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
    };

    const handleWindowDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[data-vrm-dropzone="true"]')) return;

      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void handleDrop(files);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleDrop]);
  
  /**
   * Open the save-model dialog immediately. Metadata extraction can take a
   * noticeable amount of time for large GLBs, so it runs in the background
   * and enriches the save only if it finishes before the user confirms.
   */
  const handleOpenSaveDialog = useCallback(async () => {
    if (!unsavedModelFile || !unsavedModelData) {
      console.warn('No unsaved model to save');
      setModelLoadStatus('No unsaved model is loaded');
      window.setTimeout(() => setModelLoadStatus(null), 4000);
      return;
    }

    const format = getFileExtension(unsavedModelFile.name) as 'vrm' | 'gltf' | 'glb' | 'fbx';
    const baseName = unsavedModelFile.name.replace(/\.[^.]+$/, '') || 'model';
    const suggestedName = generateUniqueName(metadata?.name || baseName, []);
    const extractionToken = saveExtractionTokenRef.current + 1;
    saveExtractionTokenRef.current = extractionToken;

    setPendingExtractedBundle(undefined);
    setSaveDialogDefaults({
      name: suggestedName,
      description: '',
      author: '',
      license: '',
      normalizedLicense: null,
    });
    setIsSaveDialogOpen(true);
    setModelLoadStatus('Save dialog ready');
    window.setTimeout(() => setModelLoadStatus(null), 2000);

    // Run extraction after opening so large assets don't make the button feel
    // broken. If it finishes before confirmation, `handleSaveModelConfirm`
    // will use the promoted metadata/dedup bundle.
    if (currentModel?.scene) {
      try {
        const extractedBundle = (await extractAllMetadata({
          scene: currentModel.scene,
          vrm: currentModel.vrm,
          buffer: unsavedModelData,
          format,
        })) as ExtractedBundle;
        if (saveExtractionTokenRef.current === extractionToken) {
          setPendingExtractedBundle(extractedBundle);
        }
      } catch (err) {
        console.warn('[save] metadata extraction failed; saving can continue with form defaults:', err);
      }
    }
  }, [unsavedModelFile, unsavedModelData, currentModel, metadata]);

  /**
   * Handle save-dialog confirmation. Uses the form values to override the
   * auto-extracted bundle so user edits flow through to the persisted
   * record (especially `normalizedLicense`, which the pipeline pulled from
   * the VRM but the user may want to correct).
   */
  const handleSaveModelConfirm = useCallback(async (form: SaveModelFormData) => {
    if (!unsavedModelFile || !unsavedModelData) {
      console.warn('No unsaved model to save');
      setModelLoadStatus('No unsaved model is loaded');
      window.setTimeout(() => setModelLoadStatus(null), 4000);
      setIsSaveDialogOpen(false);
      return;
    }

    try {
      setIsSaving(true);
      setIsSaveDialogOpen(false);
      setModelLoadStatus(`Saving ${form.name}...`);

      const modelName = form.name;
      const format = getFileExtension(unsavedModelFile.name) as 'vrm' | 'gltf' | 'glb' | 'fbx';

      // Merge user-edited license fields onto the cached bundle so the
      // promoted-fields path inside ModelService sees the user's values.
      const extractedBundle: ExtractedBundle | undefined = pendingExtractedBundle
        ? {
            ...pendingExtractedBundle,
            normalizedLicense: form.normalizedLicense,
          }
        : undefined;

      // Save model to database. When the bundle is present, ModelService
      // merges its promoted fields (sha256, polyBucket, isHumanoid, etc.) onto
      // the record and runs a sha256 dedup check.
      const result = await models.save(
        {
          name: modelName,
          displayName: modelName,
          description: form.description,
          category: '',
          tags: [],
          format,
          version: '1.0',
          author: form.author,
          license: form.license,
          thumbnail: '',
          data: unsavedModelData,
          size: unsavedModelData.byteLength,
        },
        undefined,
        extractedBundle,
      );

      if (!hasSuccessAndData<{ uuid: string }>(result)) {
        console.error('Failed to save model:', result.error);
        setModelLoadStatus(result.error?.message ?? 'Failed to save model');
        window.setTimeout(() => setModelLoadStatus(null), 6000);
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
      setCurrentModelRecord(result.data as ModelRecord);
      window.dispatchEvent(new CustomEvent('vrmviewer:model-saved', {
        detail: { uuid: modelUuid },
      }));

      // Remember this as the last loaded model so the next session resumes here.
      getPreferencesService()
        .setPreference('lastModelUuid', modelUuid)
        .catch((err) => console.warn('[resume] lastModelUuid save failed:', err));

      // Capture and save thumbnail. Either the manual capture
      // (`unsavedThumbnailData`) or the viewer-driven auto-capture is fine —
      // both are already data-URLs at this point.
      const thumbnailToSave = unsavedThumbnailData || autoCapturedThumbnail;
      if (thumbnailToSave) {
        const thumbnailResult = await models.update(modelUuid, {
          thumbnailDataUrl: thumbnailToSave,
        } as Partial<ModelRecord> & { thumbnailDataUrl: string });

        if (hasSuccessAndData<ModelRecord>(thumbnailResult)) {
          setCurrentModelRecord(thumbnailResult.data as ModelRecord);
          window.dispatchEvent(new CustomEvent('vrmviewer:model-thumbnail-updated', {
            detail: { uuid: modelUuid },
          }));
          console.log('Thumbnail saved for model:', modelUuid);
        } else if (!thumbnailResult.success) {
          console.warn('Model saved, but thumbnail update failed:', thumbnailResult.error);
        }
      }
      
      // Clear unsaved state
      setUnsavedModelFile(null);
      setUnsavedModelData(null);
      setUnsavedThumbnailData(null);
      setAutoCapturedThumbnail(null);
      
      console.log('Model saved:', modelName);
      setModelLoadStatus(`Saved ${modelName}`);
      window.setTimeout(() => setModelLoadStatus(null), 3500);
    } catch (error) {
      console.error('Failed to save model:', error);
      setModelLoadStatus(error instanceof Error ? error.message : 'Failed to save model');
      window.setTimeout(() => setModelLoadStatus(null), 6000);
    } finally {
      saveExtractionTokenRef.current += 1;
      setIsSaving(false);
      setPendingExtractedBundle(undefined);
      setSaveDialogDefaults(null);
    }
  }, [unsavedModelFile, unsavedModelData, unsavedThumbnailData, autoCapturedThumbnail, pendingExtractedBundle, models]);

  const handleCloseSaveDialog = useCallback(() => {
    setIsSaveDialogOpen(false);
    setPendingExtractedBundle(undefined);
    setSaveDialogDefaults(null);
  }, []);
  
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
    setIsModelViewerOpen(true);
    // Clear unsaved state when loading from library
    setModelLoadStatus('Preparing library model...');
    setUnsavedModelFile(null);
    setUnsavedModelData(null);
    setUnsavedThumbnailData(null);
    setCurrentModelRecord(null);
    setLodSiblingRecords([]);
    
    // Set current model UUID to enable thumbnail re-capture
    setCurrentModelUuid(modelId);

    const modelResult = await models.getByUuid(modelId);
    const modelRecord = hasSuccessAndData<ModelRecord>(modelResult)
      ? modelResult.data
      : undefined;

    if (modelRecord) {
      setModelLoadStatus(`Loading ${modelRecord.name}...`);

      const file = new File([modelRecord.data], `${modelRecord.name}.${modelRecord.format}`, {
        type: modelRecord.format === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary',
      });
      const loaded = await loadModelFromFile(file);
      if (!loaded) {
        setModelLoadStatus(`Failed to load ${modelRecord.name}`);
        return;
      }

      setCurrentModelRecord(modelRecord);
      setModelLoadStatus(null);

      // Remember this as the last loaded model for next session.
      getPreferencesService()
        .setPreference('lastModelUuid', modelId)
        .catch((err) => console.warn('[resume] lastModelUuid save failed:', err));
    } else {
      setModelLoadStatus('Model record could not be read from the library');
    }
  }, [models, loadModelFromFile]);

  useEffect(() => {
    if (!currentModelRecord?.assetGroupId) {
      return;
    }

    let isCancelled = false;
    void (async () => {
      const result = await models.getAllSummaries();
      if (isCancelled || !hasData<LoadedModelRecord[]>(result) || !result.data) return;

      const siblings = result.data
        .filter((model) => model.assetGroupId === currentModelRecord.assetGroupId && model.lodTier)
        .sort((a, b) => {
          const aIndex = LOD_ORDER.indexOf(a.lodTier as (typeof LOD_ORDER)[number]);
          const bIndex = LOD_ORDER.indexOf(b.lodTier as (typeof LOD_ORDER)[number]);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

      setLodSiblingRecords(siblings);
    })();

    return () => {
      isCancelled = true;
    };
  }, [currentModelRecord?.assetGroupId, models]);

  const loadLodSibling = useCallback(async (direction: 1 | -1) => {
    if (!currentModelRecord?.assetGroupId || !currentModelRecord.lodTier) return;

    const summariesResult = lodSiblingRecords.length > 0 ? null : await models.getAllSummaries();
    const siblings = lodSiblingRecords.length > 0
      ? lodSiblingRecords
      : hasData<LoadedModelRecord[]>(summariesResult) && summariesResult.data
        ? summariesResult.data
          .filter((model) => model.assetGroupId === currentModelRecord.assetGroupId && model.lodTier)
          .sort((a, b) => {
            const aIndex = LOD_ORDER.indexOf(a.lodTier as (typeof LOD_ORDER)[number]);
            const bIndex = LOD_ORDER.indexOf(b.lodTier as (typeof LOD_ORDER)[number]);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
          })
        : [];

    if (siblings.length <= 1) return;

    const currentIndex = siblings.findIndex((model) => model.uuid === currentModelRecord.uuid);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + siblings.length) % siblings.length;
    const next = siblings[nextIndex];

    if (next?.uuid && next.uuid !== currentModelRecord.uuid) {
      await handleModelLoad(next.uuid);
    }
  }, [currentModelRecord, handleModelLoad, lodSiblingRecords, models]);

  const currentLodIndex = useMemo(() => {
    if (!currentModelRecord || lodSiblingRecords.length === 0) return -1;
    return lodSiblingRecords.findIndex((model) => model.uuid === currentModelRecord.uuid);
  }, [currentModelRecord, lodSiblingRecords]);

  useEffect(() => {
    if (!currentModelRecord?.assetGroupId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isFormField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
      if (isFormField) return;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
        event.preventDefault();
        void loadLodSibling(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
        event.preventDefault();
        void loadLodSibling(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentModelRecord?.assetGroupId, loadLodSibling]);
  
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
        setIsModelViewerOpen(false);
        setCurrentModelUuid(null);
        setCurrentModelRecord(null);
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
      setIsExporting(true);
      if (options.destination === 'game' || options.destination === 'store' || options.destination === 'gumroad_unreal') {
        if (!currentModelUuid) {
          console.error('Cannot export to store without a saved model UUID');
          return;
        }
        const hillDestination = options.destination === 'gumroad_unreal' ? 'store' : options.destination;
        const response = await fetch('/api/hill/export-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelUuid: currentModelUuid,
            destination: hillDestination,
            name: options.name,
            description: options.description,
            author: options.author,
            version: options.version,
            category: options.category,
            keywords: (options.keywords ?? '')
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            license: options.license,
            visibility: options.visibility,
            generateLods: options.generateLods !== false,
            withKtx2: options.withKtx2 !== false,
            withLod3: options.withLod3 !== false,
            marketplacePackage: options.destination === 'gumroad_unreal' || options.destination === 'store',
            createGumroadDraft: options.destination === 'gumroad_unreal' && options.createGumroadDraft === true,
            autoUploadGumroad: options.destination === 'gumroad_unreal' && options.autoUploadGumroad === true,
          }),
        });
        const result = await response.json() as { success?: boolean; error?: { message?: string }; data?: { id: string } };
        if (!response.ok || !result.success) {
          throw new Error(result.error?.message ?? `Export request failed with ${response.status}`);
        }
        console.log('Hill export job queued:', result.data?.id);
        setIsExportDialogOpen(false);
        return;
      }

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
    } finally {
      setIsExporting(false);
    }
  }, [currentModel, currentAnimation, currentModelUuid, exportVRM, exportVRMA, exportGLTF]);
  
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
        const updateResult = await models.update(currentModelUuid, {
          thumbnailDataUrl,
        });
        if (updateResult.success) {
          window.dispatchEvent(new CustomEvent('vrmviewer:model-thumbnail-updated', {
            detail: { uuid: currentModelUuid },
          }));
          console.log('Thumbnail updated for model:', currentModelUuid);
        } else {
          console.error('Failed to update model thumbnail:', updateResult.error);
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

  const handleBottomGenerate = useCallback(async () => {
    const prompt = bottomGeneratePrompt.trim();
    if (!prompt || isBottomGenerating) return;

    setIsBottomGenerating(true);
    setModelLoadStatus('Queueing Hill generation...');
    try {
      const response = await fetch('/api/hill/conjure-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: 'create',
          exportTarget: 'library',
          generateLods: true,
        }),
      });
      const result = await response.json() as { success?: boolean; error?: { message?: string }; data?: { id?: string } };
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? `Request failed with ${response.status}`);
      }
      setBottomGeneratePrompt('');
      setModelLoadStatus(`Queued Hill generation${result.data?.id ? `: ${result.data.id}` : ''}`);
      window.dispatchEvent(new CustomEvent('vrmviewer:hill-conjure-queued'));
      window.setTimeout(() => setModelLoadStatus(null), 4000);
    } catch (err) {
      setModelLoadStatus(err instanceof Error ? err.message : 'Failed to queue Hill generation');
      window.setTimeout(() => setModelLoadStatus(null), 6000);
    } finally {
      setIsBottomGenerating(false);
    }
  }, [bottomGeneratePrompt, isBottomGenerating]);
  
  const hasModel = !!currentModel;
  const exportMetadata = useMemo(() => (
    currentModelRecord ? {
      format: currentModelRecord.format === 'fbx' ? 'glb' as const : currentModelRecord.format,
      name: currentModelRecord.displayName || currentModelRecord.name,
      description: currentModelRecord.description ?? '',
      author: currentModelRecord.author ?? '',
      version: currentModelRecord.version ?? '1.0',
      category: currentModelRecord.category ?? '',
      tags: currentModelRecord.tags ?? [],
      license: currentModelRecord.license ?? '',
      visibility: currentModelRecord.license === 'cc0' ? 'public_cc0' as const : 'platform_curated' as const,
    } : {
      name: metadata?.name || 'model_export',
      author: metadata?.author || '',
      version: metadata?.version || '',
      format: (metadata?.format === 'vrm' || metadata?.format === 'gltf' || metadata?.format === 'glb'
        ? metadata.format
        : 'glb') as 'vrm' | 'gltf' | 'glb',
    }
  ), [currentModelRecord, metadata]);
  const controlsPanel = hasModel ? (
    <div className="space-y-3">
      <ControlSection
        title="Expression"
        icon={(
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      >
        <ExpressionPanel />
      </ControlSection>

      <ControlSection
        title="Idle Motion"
        icon={(
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      >
        <IdleAnimationPanel />
      </ControlSection>

      <ControlSection
        title="Pose"
        icon={(
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      >
        <PosePanel vrm={currentModel?.vrm ?? null} />
      </ControlSection>

      <ControlSection
        title="Info"
        icon={(
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      >
        <VRMInfoPanel vrm={currentModel?.vrm ?? null} />
      </ControlSection>

      <ControlSection
        title="Lighting"
        icon={(
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      >
        <LightingPanel />
      </ControlSection>

      <ControlSection
        title="Camera"
        icon={(
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      >
        <CameraControls />
      </ControlSection>
    </div>
  ) : (
    <p className="text-sm text-gray-400">Load a model to use viewer controls.</p>
  );

  const droppedFileTray = droppedFiles.length > 0 ? (
    <div className="pointer-events-auto max-h-72 w-full max-w-md overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">
          Dropped Files ({droppedFiles.length})
        </h3>
        <button
          type="button"
          onClick={() => setDroppedFiles([])}
          className="text-xs text-gray-400 transition-colors hover:text-white"
        >
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {droppedFiles.map((file, index) => (
          <FilePreview
            key={`${file.name}-${file.lastModified}-${index}`}
            file={file}
            onRemove={() => handleRemoveFile(index)}
            onLoad={() => void handleFileLoad(file)}
          />
        ))}
      </div>
    </div>
  ) : null;
  
  return (
    <MainLayout
      controlsPanel={controlsPanel}
      onAnimationPlay={handleAnimationPlay}
      onAnimationDelete={handleAnimationDelete}
      onAnimationUpdate={handleAnimationUpdate}
      onModelLoad={handleModelLoad}
      onModelDelete={handleModelDelete}
      onModelUpdate={handleModelUpdate}
      onExport={() => setIsExportDialogOpen(true)}
      isModelViewerOpen={isModelViewerOpen}
    >
      <div className="relative flex h-full min-h-0 flex-col">
        {/* Viewer */}
        <div className="relative min-h-0 flex-1 overflow-hidden pb-24">
          <VRMViewer
            ref={vrmViewerRef}
            onThumbnailCaptured={handleAutoThumbnailCaptured}
          />

          {(modelLoadStatus || error) && (
            <div className="absolute top-4 left-1/2 z-20 max-w-sm -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-2 text-sm text-gray-100 shadow-lg">
              {modelLoadStatus ?? error}
            </div>
          )}
          <div className="absolute left-4 top-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModelViewerOpen(false)}
              className="rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-gray-800"
            >
              Back to assets
            </button>
          
            {hasModel && (
              <>
                {/* Save Model Button (only for unsaved models) */}
                {unsavedModelFile && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleOpenSaveDialog}
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
                )}

                <ThumbnailCapture
                  onCapture={handleThumbnailCapture}
                  isCapturing={isCapturing}
                  disabled={!hasModel}
                />
              </>
            )}
          </div>

          {hasModel && (
            <>
              <div className="absolute top-4 right-4 z-10">
                <AssetInfoPanel model={currentModelRecord} />
              </div>

              {currentModelRecord?.lodTier && (
                <div className="absolute left-4 top-20 z-10 rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2 text-xs text-white shadow-lg">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadLodSibling(-1)}
                      disabled={lodSiblingRecords.length <= 1}
                      title="Previous LOD"
                      aria-label="Previous LOD"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-800 text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <div className="min-w-[5.5rem]">
                      <div className="font-semibold uppercase">{currentModelRecord.lodTier}</div>
                      <div className="text-gray-300">
                        {currentModelRecord.polycount ? `${currentModelRecord.polycount.toLocaleString()} polys` : 'LOD variant'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadLodSibling(1)}
                      disabled={lodSiblingRecords.length <= 1}
                      title="Next LOD"
                      aria-label="Next LOD"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-800 text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  {lodSiblingRecords.length > 1 && currentLodIndex >= 0 && (
                    <div className="mt-1 text-center text-[11px] text-gray-400">
                      {currentLodIndex + 1} / {lodSiblingRecords.length}
                    </div>
                  )}
                  {(currentModelRecord.qualityTier || currentModelRecord.reviewStatus) && (
                    <div className="mt-1 text-gray-300 capitalize">
                      {[currentModelRecord.qualityTier, currentModelRecord.reviewStatus]
                        .filter(Boolean)
                        .map((value) => String(value).replace(/_/g, ' '))
                        .join(' · ')}
                    </div>
                  )}
                </div>
              )}
              
              {/* Controls Overlay */}
              <div className="absolute bottom-6 left-4 right-4 z-20 space-y-3">
                <ModelControls
                  isVisible={isModelVisible}
                  onVisibilityToggle={handleVisibilityToggle}
                  isWireframe={isModelWireframe}
                  onWireframeToggle={handleWireframeToggle}
                  onResetPose={handleResetPose}
                  onResetCamera={handleResetCamera}
                  onSend={() => setIsExportDialogOpen(true)}
                  generatePrompt={bottomGeneratePrompt}
                  onGeneratePromptChange={setBottomGeneratePrompt}
                  onGenerate={handleBottomGenerate}
                  isGenerating={isBottomGenerating}
                />
              </div>

            </>
          )}

          {hasModel && droppedFileTray && (
            <div className="absolute right-4 top-28 z-20 max-w-[calc(100%-2rem)]">
              {droppedFileTray}
            </div>
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
              
              {droppedFileTray && <div className="mt-6">{droppedFileTray}</div>}
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
        metadata={exportMetadata}
        isExporting={isExporting}
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
      <SaveModelDialog
        isOpen={isSaveDialogOpen}
        onClose={handleCloseSaveDialog}
        onSave={handleSaveModelConfirm}
        defaults={saveDialogDefaults}
      />
      <BackfillProgressToast progress={backfillProgress} />

    </MainLayout>
  );
}

export default App;
