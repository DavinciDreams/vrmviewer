import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { configureDracoLoader } from '../../core/three/loaders/configureDracoLoader';

interface MarketplacePlatformStatus {
  platform?: string;
  status?: string;
  remoteStatus?: string;
  url?: string;
  editUrl?: string;
  productId?: string;
  uid?: string;
  count?: number;
  uploadedAt?: string;
  source?: string;
  lastError?: string | null;
}

export interface ModelData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  previewImages?: string[];
  createdAt: string;
  updatedAt?: string;
  format?: string;
  assetKind?: 'model' | 'texture';
  assetGroupId?: string;
  lodTier?: string;
  polycount?: number | null;
  packName?: string;
  isProductPack?: boolean;
  qualityTier?: 'draft' | 'game_ready' | 'hero';
  reviewStatus?: 'needs_regen' | 'pending' | 'approved' | 'rejected';
  exports?: {
    game?: { status: string; manifestPath?: string; lodDir?: string };
    store?: { status: string; manifestPath?: string; lodDir?: string; platforms?: Record<string, unknown> };
  };
  priceUsd?: number;
  marketplacePlatforms?: Record<string, MarketplacePlatformStatus>;
  listingStatus?: 'live' | 'draft' | 'failed' | 'unlisted';
}

interface InlineModelPreviewProps {
  model: ModelData;
}

const previewableModelFormats = new Set(['glb', 'gltf', 'vrm', 'fbx']);

const modelFileUrl = (model: ModelData) => {
  const params = new URLSearchParams();
  if (model.format) params.set('format', model.format);
  params.set('name', model.name);
  return `/api/models/${encodeURIComponent(model.id)}/file?${params.toString()}`;
};

const disposeObject = (object: THREE.Object3D) => {
  const disposedMaterials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.LineSegments)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      material.dispose();
    });
  });
};

const preparePreviewObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    child.frustumCulled = false;
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  });
};

const InlineModelPreview: React.FC<InlineModelPreviewProps> = ({ model }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState('Loading preview...');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let cancelled = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f2ec);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    camera.position.set(0, 1.2, 3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.target.set(0, 0.7, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9ca3af, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.4);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let previewRoot: THREE.Object3D | null = null;

    const fitPreviewRoot = (object: THREE.Object3D) => {
      previewRoot = object;
      preparePreviewObject(previewRoot);
      scene.add(previewRoot);

      const bounds = new THREE.Box3().setFromObject(previewRoot);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const scale = 1.8 / maxDim;
      previewRoot.scale.setScalar(scale);
      previewRoot.position.set(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      );
      previewRoot.updateMatrixWorld(true);

      controls.target.set(0, Math.max(size.y * scale * 0.45, 0.4), 0);
      camera.position.set(0, controls.target.y + 0.35, Math.max(2.2, maxDim * scale * 1.6));
      controls.update();
      setStatus('');
    };
    const onPreviewError = (error: unknown) => {
      console.warn(`Preview load failed for ${model.name}:`, error);
      if (!cancelled) setStatus('Preview failed');
    };

    if ((model.format ?? '').toLowerCase() === 'fbx') {
      const loader = new FBXLoader();
      loader.load(
        modelFileUrl(model),
        (object) => {
          if (cancelled) {
            disposeObject(object);
            return;
          }
          fitPreviewRoot(object);
        },
        undefined,
        onPreviewError,
      );
    } else {
      const loader = configureDracoLoader(new GLTFLoader());
      loader.load(
        modelFileUrl(model),
        (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }
          fitPreviewRoot(gltf.scene);
        },
        undefined,
        onPreviewError,
      );
    }

    let frameId = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      if (previewRoot) disposeObject(previewRoot);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [model]);

  return (
    <div
      ref={mountRef}
      className="relative h-full w-full"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      role="presentation"
    >
      {status && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/70 text-xs text-gray-200">
          {status}
        </div>
      )}
    </div>
  );
};

export interface ModelCardProps {
  model: ModelData;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onEdit: (id: string) => void;
  onKeep?: (id: string) => Promise<void>;
  onRegenerate?: (id: string) => Promise<void>;
  onEnrich?: (id: string) => Promise<void>;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onLoad,
  onDelete,
  onEdit,
  onKeep,
  onRegenerate,
  onEnrich,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isKeeping, setIsKeeping] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isInlinePreviewOpen, setIsInlinePreviewOpen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
  const previewImages = (model.previewImages?.length ? model.previewImages : [model.thumbnail]).filter(
    (image): image is string => Boolean(image),
  );
  const currentImage = previewImages[imageIndex % Math.max(previewImages.length, 1)];
  const canInlinePreview = model.assetKind !== 'texture' && previewableModelFormats.has((model.format ?? '').toLowerCase());
  const qualityLabel = model.qualityTier?.replace(/_/g, ' ');
  const reviewLabel = model.reviewStatus?.replace(/_/g, ' ');
  const completedExports = [
    model.exports?.game?.status === 'completed' ? 'game' : null,
    model.exports?.store?.status === 'completed' ? 'store' : null,
  ].filter(Boolean);
  const marketplaceEntries = Object.entries(model.marketplacePlatforms ?? {});
  const platformCount = marketplaceEntries.length;
  const listingLabel = model.listingStatus ?? 'unlisted';
  const listingClass = model.listingStatus === 'live'
    ? 'border-sky-500/40 bg-sky-950/50 text-sky-200'
    : model.listingStatus === 'draft'
      ? 'border-violet-500/40 bg-violet-950/50 text-violet-200'
      : model.listingStatus === 'failed'
        ? 'border-red-500/40 bg-red-950/50 text-red-200'
        : 'border-gray-500/40 bg-gray-900/60 text-gray-200';
  const qualityClass = model.qualityTier === 'draft'
    ? 'border-amber-500/40 bg-amber-950/50 text-amber-200'
    : model.qualityTier === 'hero'
      ? 'border-blue-500/40 bg-blue-950/50 text-blue-200'
      : 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200';
  const reviewClass = model.reviewStatus === 'needs_regen'
    ? 'border-red-500/40 bg-red-950/50 text-red-200'
    : model.reviewStatus === 'approved'
      ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
      : 'border-gray-500/40 bg-gray-900/60 text-gray-200';

  const handleCardOpen = () => {
    if (isInlinePreviewOpen) return;
    onLoad(model.id);
  };

  const stopCardOpen = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    setDeleteError(null);
  };

  const handleKeepClick = async () => {
    if (!onKeep || isKeeping) return;
    setIsKeeping(true);
    try {
      await onKeep(model.id);
    } finally {
      setIsKeeping(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await onDelete(model.id);
      if (!result.success) {
        setDeleteError(result.error || 'Failed to delete model');
      } else {
        setIsDeleteDialogOpen(false);
      }
    } catch {
      setDeleteError('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRegenerateClick = async () => {
    if (!onRegenerate || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(model.id);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleEnrichClick = async () => {
    if (!onEnrich || isEnriching) return;
    setIsEnriching(true);
    try {
      await onEnrich(model.id);
    } finally {
      setIsEnriching(false);
    }
  };

  useEffect(() => {
    if (previewImages.length <= 1 || isInlinePreviewOpen) return undefined;
    const timer = window.setInterval(() => {
      setImageIndex((index) => (index + 1) % previewImages.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [isInlinePreviewOpen, previewImages.length]);

  return (
    <div
      className="group relative overflow-hidden rounded-md border border-gray-700 bg-gray-800 transition-colors hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      role="button"
      tabIndex={0}
      onClick={handleCardOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardOpen();
        }
      }}
      aria-label={`Open ${model.name} in viewer`}
      title={`Open ${model.name} in viewer`}
    >
      <div className="absolute right-2 top-2 z-30 flex gap-2">
        {onKeep && (
          <button
            type="button"
            onClick={(event) => {
              stopCardOpen(event);
              void handleKeepClick();
            }}
            disabled={isKeeping}
            aria-label={`Keep ${model.name}`}
            title="Keep"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-700/90 text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isKeeping ? (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={(event) => {
            stopCardOpen(event);
            handleDeleteClick();
          }}
          disabled={isDeleting}
          aria-label={`Discard ${model.name}`}
          title="Discard"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-400/60 bg-red-800/90 text-white shadow hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? (
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>

      <div className="relative flex aspect-square w-full items-center justify-center bg-gray-900 text-left">
        {model.assetKind === 'texture' && (
          <span className="absolute left-2 top-2 z-10 rounded border border-cyan-400/40 bg-cyan-950/85 px-2 py-0.5 text-[11px] font-medium uppercase text-cyan-100">
            Texture
          </span>
        )}
        {canInlinePreview && (
          <button
            type="button"
            onClick={(event) => {
              stopCardOpen(event);
              setIsInlinePreviewOpen((value) => !value);
            }}
            className="absolute right-2 top-11 z-20 rounded border border-blue-400/40 bg-blue-950/85 px-2 py-0.5 text-[11px] font-medium uppercase text-blue-100 opacity-95 hover:bg-blue-800"
          >
            {isInlinePreviewOpen ? 'Image' : 'Load Preview'}
          </button>
        )}
        {isInlinePreviewOpen && canInlinePreview ? (
          <InlineModelPreview model={model} />
        ) : currentImage ? (
          <img src={currentImage} alt={model.name} className="h-full w-full object-cover" />
        ) : (
          <svg className="h-14 w-14 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        )}
        {previewImages.length > 1 && !isInlinePreviewOpen && (
          <div className="absolute bottom-20 left-3 z-10 flex gap-1">
            {previewImages.slice(0, 6).map((image, index) => (
              <span
                key={`${image}-${index}`}
                className={`h-1.5 w-1.5 rounded-full ${index === imageIndex % previewImages.length ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950 via-gray-950/85 to-transparent p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white" title={model.name}>
            {model.name}
          </h3>
          {model.isProductPack && model.packName && (
            <p className="mt-1 truncate text-xs uppercase text-emerald-300" title={model.packName}>
              {model.packName}
            </p>
          )}
        </div>
      </div>

      <div className="p-3">
        <p className="text-xs text-gray-500">{formatDate(model.createdAt)}</p>
        {model.lodTier && (
          <p className="mt-1 truncate text-xs uppercase text-blue-300">
            {model.lodTier}
            {model.polycount ? ` - ${model.polycount.toLocaleString()} polys` : ''}
          </p>
        )}

        {(qualityLabel || reviewLabel || model.listingStatus || completedExports.length > 0 || model.priceUsd) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {model.listingStatus && (
              <span className={`rounded border px-1.5 py-0.5 text-[11px] uppercase ${listingClass}`}>
                {listingLabel}{platformCount > 0 ? ` ${platformCount}` : ''}
              </span>
            )}
            {qualityLabel && (
              <span className={`rounded border px-1.5 py-0.5 text-[11px] capitalize ${qualityClass}`}>
                {qualityLabel}
              </span>
            )}
            {reviewLabel && (
              <span className={`rounded border px-1.5 py-0.5 text-[11px] capitalize ${reviewClass}`}>
                {reviewLabel}
              </span>
            )}
            {completedExports.map((target) => (
              <span key={target} className="rounded border border-cyan-500/40 bg-cyan-950/50 px-1.5 py-0.5 text-[11px] uppercase text-cyan-200">
                {target} ready
              </span>
            ))}
            {model.priceUsd && (
              <span className="rounded border border-violet-500/40 bg-violet-950/50 px-1.5 py-0.5 text-[11px] text-violet-200">
                ${model.priceUsd}
              </span>
            )}
          </div>
        )}

        {marketplaceEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {marketplaceEntries.map(([platform, status]) => {
              const href = status.url || status.editUrl;
              const platformLabel = platform.replace(/_/g, ' ');
              const statusLabel = (status.remoteStatus || status.status || 'draft').replace(/_/g, ' ');
              const className = status.remoteStatus === 'FAILED' || status.status === 'failed'
                ? 'border-red-500/40 bg-red-950/50 text-red-200 hover:bg-red-900'
                : status.status === 'draft' || status.remoteStatus === 'draft'
                  ? 'border-violet-500/40 bg-violet-950/50 text-violet-200 hover:bg-violet-900'
                  : 'border-sky-500/40 bg-sky-950/50 text-sky-200 hover:bg-sky-900';
              const content = `${platformLabel}: ${statusLabel}`;
              return href ? (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={stopCardOpen}
                  className={`max-w-full truncate rounded border px-1.5 py-0.5 text-[11px] capitalize ${className}`}
                  title={href}
                >
                  {content}
                </a>
              ) : (
                <span
                  key={platform}
                  className={`max-w-full truncate rounded border px-1.5 py-0.5 text-[11px] capitalize ${className}`}
                >
                  {content}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={(event) => {
              stopCardOpen(event);
              onLoad(model.id);
            }}
            className="px-2 py-1.5 text-sm"
          >
            {model.assetKind === 'texture' ? 'Preview' : 'As Model'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              stopCardOpen(event);
              onEdit(model.id);
            }}
            className="px-2 py-1.5"
            title="Edit metadata"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            {onEnrich && (
              <Button
                variant="secondary"
                size="sm"
                className="px-2 py-1.5 text-sm"
                onClick={(event) => {
                  stopCardOpen(event);
                  void handleEnrichClick();
                }}
                disabled={isEnriching}
              >
                {isEnriching ? 'Enriching...' : 'Enrich'}
              </Button>
            )}
            {onRegenerate && (
              <Button
                variant={model.reviewStatus === 'needs_regen' ? 'danger' : 'secondary'}
                size="sm"
                className="px-2 py-1.5 text-sm"
                onClick={(event) => {
                  stopCardOpen(event);
                  void handleRegenerateClick();
                }}
                disabled={isRegenerating}
              >
                {isRegenerating ? 'Requesting...' : 'Regen'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Discard Asset"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Discard <span className="font-semibold text-white">{model.name}</span> from the review library?
          </p>
          <p className="text-sm text-gray-400">This action cannot be undone.</p>

          {deleteError && (
            <div className="rounded-lg border border-red-700 bg-red-900/50 p-3">
              <p className="text-sm text-red-300">{deleteError}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Discarding...' : 'Discard'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
