import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ModelCard } from './ModelCard';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AnimationEditor } from './AnimationEditor';
import { useDatabase } from '../../hooks/useDatabase';
import { getThumbnailService } from '../../core/database/services/ThumbnailService';

const HILL_CONTROLS_ENABLED = import.meta.env.VITE_ENABLE_HILL_CONTROLS === 'true';

export interface ModelData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  previewImages?: string[];
  createdAt: string;
  updatedAt?: string;
  format?: string;
  category?: string;
  assetKind?: 'model' | 'texture';
  size?: number;
  sourcePath?: string;
  assetGroupId?: string;
  lodTier?: string;
  polycount?: number | null;
  packSlug?: string;
  packName?: string;
  isProductPack?: boolean;
  qualityTier?: 'draft' | 'game_ready' | 'hero';
  reviewStatus?: 'needs_regen' | 'pending' | 'approved' | 'rejected';
  exports?: {
    game?: { status: string; manifestPath?: string; lodDir?: string };
    store?: {
      status: string;
      manifestPath?: string;
      lodDir?: string;
      platforms?: Record<string, MarketplacePlatformStatus>;
    };
  };
  priceUsd?: number;
  marketplacePlatforms?: Record<string, MarketplacePlatformStatus>;
  listingStatus?: 'live' | 'draft' | 'failed' | 'unlisted';
}

type HillModelMetadata = {
  description?: string;
  prompt?: string;
  refImage?: string;
  referenceImage?: string;
  sourcePath?: string;
  sourceCatalog?: string;
  marketplacePackage?: string;
  category?: string;
  marketplace?: Record<string, MarketplacePlatformStatus>;
  isProductPack?: boolean;
  heroMedia?: {
    primary?: string;
    fabCover?: string;
    perProp?: Record<string, { primary?: string }>;
  };
  hero_media?: {
    primary?: string;
    fab_cover?: string;
    per_prop?: Record<string, { primary?: string }>;
  };
  prop?: {
    name?: string;
    ref_image?: string;
    referenceImage?: string;
  } | null;
};

const toIsoString = (value: Date | string | undefined) => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const localHillImageUrl = (filePath?: string) => (
  filePath ? `/api/hill/file?path=${encodeURIComponent(filePath)}` : undefined
);

const firstLocalHillImage = (...filePaths: Array<string | undefined | null>) => {
  const filePath = filePaths.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return localHillImageUrl(filePath ?? undefined);
};

const assetRootFromPath = (filePath?: string) => {
  if (!filePath) return undefined;
  const marker = '/meshes/';
  if (filePath.includes(marker)) return filePath.slice(0, filePath.indexOf(marker));
  const refMarker = '/reference_images/';
  if (filePath.includes(refMarker)) return filePath.slice(0, filePath.indexOf(refMarker));
  const packageMarker = '/packages/';
  if (filePath.includes(packageMarker)) return filePath.slice(0, filePath.indexOf(packageMarker));
  return undefined;
};

const coverCandidatesForRecord = (record: { sourcePath?: string; packSlug?: string; metadata?: unknown }) => {
  const metadata = record.metadata as HillModelMetadata | undefined;
  const assetRoot = assetRootFromPath(record.sourcePath ?? metadata?.marketplacePackage);
  return [
    metadata?.heroMedia?.primary,
    metadata?.hero_media?.primary,
    metadata?.heroMedia?.fabCover,
    metadata?.hero_media?.fab_cover,
    assetRoot && record.packSlug ? `${assetRoot}/${record.packSlug}_cover.png` : undefined,
    assetRoot && record.packSlug ? `${assetRoot}/${record.packSlug}_cover_3x3.png` : undefined,
    assetRoot ? `${assetRoot}/cover_grid_2048.png` : undefined,
    assetRoot ? `${assetRoot}/cover.png` : undefined,
  ];
};

const metadataThumbnailForRecord = (record: {
  thumbnail?: string;
  sourcePath?: string;
  assetGroupId?: string;
  packSlug?: string;
  metadata?: unknown;
}) => {
  const metadata = record.metadata as HillModelMetadata | undefined;
  const propName = metadata?.prop?.name;
  const perProp = propName
    ? metadata?.heroMedia?.perProp?.[propName]?.primary ?? metadata?.hero_media?.per_prop?.[propName]?.primary
    : undefined;
  const isPackPreview = Boolean(record.assetGroupId?.endsWith(':image-pack') || (!metadata?.prop && metadata?.isProductPack));
  const propThumbnail = firstLocalHillImage(
    perProp,
    metadata?.prop?.ref_image,
    metadata?.prop?.referenceImage,
    metadata?.refImage,
    metadata?.referenceImage,
  );
  const coverThumbnail = firstLocalHillImage(...coverCandidatesForRecord(record));
  if (isPackPreview) return coverThumbnail ?? propThumbnail ?? record.thumbnail;
  return propThumbnail ?? coverThumbnail ?? record.thumbnail;
};

const metadataPreviewImagesForRecord = (record: {
  thumbnail?: string;
  sourcePath?: string;
  assetGroupId?: string;
  packSlug?: string;
  metadata?: unknown;
}) => {
  const metadata = record.metadata as HillModelMetadata | undefined;
  const propName = metadata?.prop?.name;
  const perProp = propName
    ? metadata?.heroMedia?.perProp?.[propName]?.primary ?? metadata?.hero_media?.per_prop?.[propName]?.primary
    : undefined;
  return Array.from(new Set([
    firstLocalHillImage(perProp),
    firstLocalHillImage(metadata?.prop?.ref_image),
    firstLocalHillImage(metadata?.prop?.referenceImage),
    firstLocalHillImage(metadata?.refImage),
    firstLocalHillImage(metadata?.referenceImage),
    ...coverCandidatesForRecord(record).map((candidate) => firstLocalHillImage(candidate)),
    record.thumbnail,
  ].filter((image): image is string => Boolean(image))));
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 / 1024)} MB`;
};

const formatLabel = (value?: string) => value ? value.replace(/_/g, ' ') : '';

const marketplaceLabel = (platform: string, status: MarketplacePlatformStatus) => {
  const remote = status.remoteStatus && status.remoteStatus !== status.status
    ? ` / ${formatLabel(status.remoteStatus)}`
    : '';
  const count = typeof status.count === 'number' ? ` (${status.count})` : '';
  return `${formatLabel(platform)} ${formatLabel(status.status)}${remote}${count}`;
};

const marketplaceState = (platforms?: Record<string, MarketplacePlatformStatus>): ModelData['listingStatus'] => {
  const values = Object.values(platforms ?? {});
  if (values.length === 0) return 'unlisted';
  if (values.some((status) => status.remoteStatus === 'FAILED' || status.status === 'failed')) return 'failed';
  if (values.some((status) => status.status === 'draft' || status.remoteStatus === 'draft')) return 'draft';
  if (values.some((status) => Boolean(status.url || status.editUrl || status.productId || status.uid))) return 'live';
  return 'unlisted';
};

const isTextureRecord = (record: {
  category?: string;
  format?: string;
  packSlug?: string;
  metadata?: unknown;
}) => {
  const metadata = record.metadata as HillModelMetadata | undefined;
  const category = (record.category ?? metadata?.category ?? '').toLowerCase();
  return category === 'texture_pack' ||
    category === 'textures' ||
    record.format === 'texture' ||
    Boolean(record.packSlug?.includes('_pbr_'));
};

const PAGE_SIZE = 96;

interface HillStatus {
  modelCount: number;
  packCount: number;
  packs: string[];
  promotionQueueCount?: number;
  promotionQueuePath?: string;
  pendingRegenJobs: number;
  pendingConjureJobs?: number;
  jobsDir: string;
  catalogRoot: string;
}

interface HillConjureJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  prompt: string;
  mode: 'store' | 'create' | 'conjure';
  exportTarget?: 'library' | 'store' | 'game';
  generateLods?: boolean;
  steps?: number;
  noRembg?: boolean;
  assetId?: string;
  assetName?: string;
  error?: string;
  createdAt: string;
}

interface HillRegenJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  sourceModelUuid: string;
  sourceModelName?: string;
  assetId?: string;
  assetName?: string;
  error?: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message?: string;
  };
}

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

interface PromotionQueueItem {
  slug: string;
  packRoot: string;
  sourceRole: string;
  promotionStatus: string;
  categoryHint: string;
  fileCount: number;
  totalSizeBytes: number;
  lodTiers: string[];
  catalog?: {
    cataloged: boolean;
    category?: string;
    metadataPath?: string;
    title?: string;
    priceUsd?: number;
    store?: {
      gumroad?: string;
      fab?: string;
    };
    marketplace?: Record<string, MarketplacePlatformStatus>;
  };
}

export interface ModelLibraryProps {
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: { type: string; message: string; } | undefined }>;
  onUpdate: (id: string, name: string, description: string) => void;
  isAssetSurface?: boolean;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({
  onLoad,
  onDelete,
  onUpdate,
  isAssetSurface = false,
}) => {
  const { isInitialized, models } = useDatabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingModel, setEditingModel] = useState<ModelData | undefined>();
  const [modelList, setModelList] = useState<ModelData[]>([]);
  const [modelTotal, setModelTotal] = useState(0);
  const [modelHasMore, setModelHasMore] = useState(false);
  const [modelOffset, setModelOffset] = useState(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hillStatus, setHillStatus] = useState<HillStatus | null>(null);
  const [assetView, setAssetView] = useState<'library' | 'review'>('library');
  const [promotionQueue, setPromotionQueue] = useState<PromotionQueueItem[]>([]);
  const [isPromotionQueueLoading, setIsPromotionQueueLoading] = useState(false);
  const [promotingSlug, setPromotingSlug] = useState<string | null>(null);
  const [conjureJobs, setConjureJobs] = useState<HillConjureJob[]>([]);
  const [regenJobs, setRegenJobs] = useState<HillRegenJob[]>([]);
  const hadActiveConjureJobRef = useRef(false);
  const hadActiveRegenJobRef = useRef(false);
  const [isConjureOpen, setIsConjureOpen] = useState(false);
  const [conjurePrompt, setConjurePrompt] = useState('');
  const [conjureMode, setConjureMode] = useState<'store' | 'create' | 'conjure'>('conjure');
  const [conjureGenerateLods, setConjureGenerateLods] = useState(true);
  const [conjureExportTarget, setConjureExportTarget] = useState<'library' | 'store' | 'game'>('game');
  const [conjureQuality, setConjureQuality] = useState('medium');
  const [conjureSteps, setConjureSteps] = useState('12');
  const [conjureNoRembg, setConjureNoRembg] = useState(false);
  const [isConjuring, setIsConjuring] = useState(false);

  // Multi-select / bulk-delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: 'bulkDelete'; count: number }
    | { kind: 'clearAll'; count: number }
    | null
  >(null);
  // Latch while a destructive operation is in flight so a double-click on the
  // confirm button doesn't fire two concurrent bulk-delete calls.
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [formatFilter, setFormatFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [assetKindFilter, setAssetKindFilter] = useState<'all' | 'models' | 'textures'>('all');
  const [packFilter, setPackFilter] = useState<string>('');
  const [listingFilter, setListingFilter] = useState<'all' | 'live' | 'draft' | 'failed' | 'unlisted'>('all');
  // Sort — 'recent' surfaces the most-recently-saved records first, the
  // closest UI to the unwired `useDatabase.models.getRecent()` method.
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'oldest' | 'size' | 'listed' | 'unlisted'>('recent');

  // Thumbnail service
  const thumbnailService = getThumbnailService();

  const resetPaging = () => {
    setModelOffset(0);
  };

  // Fetch models from database. Resolves setState in async continuations
  // (legitimate data-fetching pattern; the new react-hooks/set-state-in-effect
  // rule still flags it because the call originates inside an effect).
  const fetchModels = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setIsLoading(true);
      setError(null);
      // Use the blob-stripped summary getter — the library UI only needs
      // metadata + thumbnail, never the raw model ArrayBuffer. With large
      // libraries (10+ multi-MB VRMs) the difference is significant.
      const result = await models.getAllSummaries({
        limit: PAGE_SIZE,
        offset: modelOffset,
        search: searchQuery || undefined,
        format: formatFilter || undefined,
        category: categoryFilter || undefined,
        assetKind: assetKindFilter,
        packSlug: packFilter || undefined,
        listing: listingFilter,
        sort: sortBy,
      });

      // Handle DatabaseOperationResult type - check if result has data property
      const records = 'data' in result && result.data ? result.data : null;

      if (records) {
        const transformedData: ModelData[] = records.map((record) => {
          const metadata = record.metadata as HillModelMetadata | undefined;
          const storeExport = record.exports?.store as { platforms?: Record<string, MarketplacePlatformStatus> } | undefined;
          const marketplacePlatforms = storeExport?.platforms ?? metadata?.marketplace ?? {};
          const isProductPack = metadata?.isProductPack === true;
          return {
            id: record.uuid,
            name: record.name,
            description: record.description || metadata?.description || metadata?.prompt,
            thumbnail: metadataThumbnailForRecord(record),
            previewImages: metadataPreviewImagesForRecord(record),
            createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
            updatedAt: toIsoString(record.updatedAt),
            format: record.format,
            category: record.category,
            assetKind: isTextureRecord(record) ? 'texture' : 'model',
            size: record.size,
            sourcePath: record.sourcePath,
            assetGroupId: record.assetGroupId,
            lodTier: record.lodTier,
            polycount: record.polycount,
            packSlug: record.packSlug,
            packName: record.packName,
            isProductPack,
            qualityTier: record.qualityTier,
            reviewStatus: record.reviewStatus,
            exports: record.exports,
            priceUsd: record.priceUsd,
            marketplacePlatforms,
            listingStatus: marketplaceState(marketplacePlatforms),
          };
        });
        setModelList(transformedData);
        const meta = ('meta' in result ? result.meta : undefined) as
          | { total?: number; hasMore?: boolean }
          | undefined;
        setModelTotal(meta?.total ?? transformedData.length);
        setModelHasMore(Boolean(meta?.hasMore));

        const thumbnailEntries: Array<[string, string]> = [];
        for (const record of records) {
          const thumbnailResult = await thumbnailService.getThumbnailByTarget(record.uuid);
          if (thumbnailResult.success && thumbnailResult.data) {
            const dataUrl = `data:image/${thumbnailResult.data.format};base64,${thumbnailResult.data.data}`;
            thumbnailEntries.push([record.uuid, dataUrl]);
          }
        }
        setThumbnails(Object.fromEntries(thumbnailEntries));
      } else {
        setError('Failed to load models');
      }
    } catch (err) {
      setError('Failed to load models');
      console.error('Error fetching models:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    isInitialized,
    models,
    thumbnailService,
    modelOffset,
    searchQuery,
    formatFilter,
    categoryFilter,
    assetKindFilter,
    packFilter,
    listingFilter,
    sortBy,
  ]);

  const fetchHillStatus = useCallback(async () => {
    if (!HILL_CONTROLS_ENABLED) {
      setHillStatus(null);
      return;
    }
    try {
      const response = await fetch('/api/hill/status');
      if (!response.ok) throw new Error(`Hill status failed: ${response.status}`);
      const result = await response.json() as ApiResponse<HillStatus>;
      if (result.success && result.data) {
        setHillStatus(result.data);
      }
    } catch (err) {
      console.warn('Unable to load Hill status:', err);
      setHillStatus(null);
    }
  }, []);

  const fetchConjureJobs = useCallback(async () => {
    if (!HILL_CONTROLS_ENABLED) {
      setConjureJobs([]);
      return;
    }
    try {
      const response = await fetch('/api/hill/conjure-jobs');
      if (!response.ok) throw new Error(`Hill conjure jobs failed: ${response.status}`);
      const result = await response.json() as ApiResponse<HillConjureJob[]>;
      if (result.success && result.data) {
        setConjureJobs(result.data.slice(0, 5));
      }
    } catch (err) {
      console.warn('Unable to load Hill conjure jobs:', err);
    }
  }, []);

  const fetchRegenJobs = useCallback(async () => {
    if (!HILL_CONTROLS_ENABLED) {
      setRegenJobs([]);
      return;
    }
    try {
      const response = await fetch('/api/hill/regen-jobs');
      if (!response.ok) throw new Error(`Hill regen jobs failed: ${response.status}`);
      const result = await response.json() as ApiResponse<HillRegenJob[]>;
      if (result.success && result.data) {
        setRegenJobs(result.data.slice(0, 8));
      }
    } catch (err) {
      console.warn('Unable to load Hill regen jobs:', err);
    }
  }, []);

  const fetchPromotionQueue = useCallback(async () => {
    if (!HILL_CONTROLS_ENABLED) {
      setPromotionQueue([]);
      setIsPromotionQueueLoading(false);
      return;
    }
    try {
      setIsPromotionQueueLoading(true);
      const response = await fetch('/api/hill/promotion-queue');
      if (!response.ok) throw new Error(`Hill promotion queue failed: ${response.status}`);
      const result = await response.json() as ApiResponse<PromotionQueueItem[]>;
      if (result.success && result.data) {
        setPromotionQueue(result.data);
      }
    } catch (err) {
      console.warn('Unable to load Hill promotion queue:', err);
      setPromotionQueue([]);
    } finally {
      setIsPromotionQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    // Canonical data-fetching effect: setState calls happen after async work,
    // not synchronously, so the cascading-render concern of this rule does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchModels();
    fetchHillStatus();
    fetchConjureJobs();
    fetchRegenJobs();
    fetchPromotionQueue();
  }, [fetchModels, fetchHillStatus, fetchConjureJobs, fetchRegenJobs, fetchPromotionQueue]);

  useEffect(() => {
    const refreshModels = () => {
      void fetchModels();
    };
    const refreshHillJobs = () => {
      void fetchConjureJobs();
      void fetchRegenJobs();
      void fetchHillStatus();
      void fetchPromotionQueue();
    };
    window.addEventListener('vrmviewer:model-saved', refreshModels);
    window.addEventListener('vrmviewer:model-thumbnail-updated', refreshModels);
    window.addEventListener('vrmviewer:hill-conjure-queued', refreshHillJobs);
    window.addEventListener('vrmviewer:hill-regen-queued', refreshHillJobs);
    return () => {
      window.removeEventListener('vrmviewer:model-saved', refreshModels);
      window.removeEventListener('vrmviewer:model-thumbnail-updated', refreshModels);
      window.removeEventListener('vrmviewer:hill-conjure-queued', refreshHillJobs);
      window.removeEventListener('vrmviewer:hill-regen-queued', refreshHillJobs);
    };
  }, [fetchConjureJobs, fetchHillStatus, fetchModels, fetchRegenJobs, fetchPromotionQueue]);

  useEffect(() => {
    const hasActiveJob = conjureJobs.some((job) => job.status === 'queued' || job.status === 'running');
    if (!hasActiveJob) {
      if (hadActiveConjureJobRef.current) {
        hadActiveConjureJobRef.current = false;
        void fetchModels();
        void fetchHillStatus();
      }
      return undefined;
    }
    hadActiveConjureJobRef.current = true;
    const timer = window.setInterval(() => {
      fetchConjureJobs();
      fetchHillStatus();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [conjureJobs, fetchConjureJobs, fetchHillStatus, fetchModels]);

  useEffect(() => {
    const hasActiveJob = regenJobs.some((job) => job.status === 'queued' || job.status === 'running');
    if (!hasActiveJob) {
      if (hadActiveRegenJobRef.current) {
        hadActiveRegenJobRef.current = false;
        void fetchModels();
        void fetchRegenJobs();
        void fetchHillStatus();
      }
      return undefined;
    }
    hadActiveRegenJobRef.current = true;
    const timer = window.setInterval(() => {
      fetchRegenJobs();
      fetchHillStatus();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [regenJobs, fetchHillStatus, fetchModels, fetchRegenJobs]);

  // Unique formats + categories derived from the loaded list so the filter
  // dropdowns only show options that actually have records.
  const availableFormats = useMemo(
    () => Array.from(new Set(modelList.map((m) => m.format).filter((f): f is string => !!f))).sort(),
    [modelList],
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(modelList.map((m) => m.category).filter((c): c is string => !!c))).sort(),
    [modelList],
  );
  const availablePacks = useMemo(
    () => Array.from(
      new Map(
        modelList
          .filter((m) => m.isProductPack && m.packSlug && m.packName)
          .map((m) => [m.packSlug as string, m.packName as string]),
      ),
    ).sort((a, b) => a[1].localeCompare(b[1])),
    [modelList],
  );
  const assetKindCounts = useMemo(() => {
    const textures = modelList.filter((model) => model.assetKind === 'texture').length;
    return {
      all: modelList.length,
      models: modelList.length - textures,
      textures,
    };
  }, [modelList]);

  // Merge thumbnails into the displayed list at render time so we don't have to
  // re-sync separate state via an effect when thumbnails resolve.
  const filteredModels = useMemo(
    () => {
      const q = searchQuery.toLowerCase();
      const groupsWithDefault = new Set(
        modelList
          .filter((model) => model.assetGroupId && model.lodTier === 'default')
          .map((model) => model.assetGroupId as string),
      );
      const filtered = modelList
        .filter((model) => {
          const matchesSearch =
            !q ||
            model.name.toLowerCase().includes(q) ||
            model.description?.toLowerCase().includes(q);
          const matchesFormat = !formatFilter || model.format === formatFilter;
          const matchesCategory = !categoryFilter || model.category === categoryFilter;
          const matchesAssetKind = assetKindFilter === 'all' ||
            (assetKindFilter === 'textures' ? model.assetKind === 'texture' : model.assetKind !== 'texture');
          const matchesPack = !packFilter || model.packSlug === packFilter;
          const matchesListing = listingFilter === 'all' || model.listingStatus === listingFilter;
          const isPrimaryLod = !model.assetGroupId ||
            !model.lodTier ||
            model.lodTier === 'default' ||
            (model.lodTier === 'lod1' && !groupsWithDefault.has(model.assetGroupId));
          return matchesSearch && matchesFormat && matchesCategory && matchesAssetKind && matchesPack && matchesListing && isPrimaryLod;
        })
        .map((model) => ({
          ...model,
          thumbnail: model.thumbnail || thumbnails[model.id],
        }));

      // Sort in place (filtered is already a fresh array from .filter().map())
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'recent':
            return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
          case 'oldest':
            return a.createdAt.localeCompare(b.createdAt);
          case 'size':
            return (b.size ?? 0) - (a.size ?? 0);
          case 'listed':
            return Number(b.listingStatus === 'live') - Number(a.listingStatus === 'live') ||
              (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
          case 'unlisted':
            return Number(b.listingStatus === 'unlisted') - Number(a.listingStatus === 'unlisted') ||
              (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
          default:
            return 0;
        }
      });
      return filtered;
    },
    [modelList, thumbnails, searchQuery, formatFilter, categoryFilter, assetKindFilter, packFilter, listingFilter, sortBy],
  );

  const filteredPromotionQueue = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return promotionQueue
      .filter((item) => {
        const matchesSearch = !q ||
          item.slug.toLowerCase().includes(q) ||
          item.packRoot.toLowerCase().includes(q) ||
          item.categoryHint.toLowerCase().includes(q) ||
          item.promotionStatus.toLowerCase().includes(q);
        const matchesCategory = !categoryFilter || item.categoryHint === categoryFilter || item.catalog?.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .slice(0, 80);
  }, [promotionQueue, searchQuery, categoryFilter]);

  const handleEdit = (id: string) => {
    const model = modelList.find((m) => m.id === id);
    if (model) {
      setEditingModel(model);
    }
  };

  const handleSave = (id: string, name: string, description: string) => {
    onUpdate(id, name, description);
    setEditingModel(undefined);
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredModels.map((m) => m.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const performBulkDelete = async () => {
    if (isDeleting) return;
    const ids = Array.from(selectedIds);
    setIsDeleting(true);
    setConfirmDialog(null);
    if (ids.length === 0) {
      setIsDeleting(false);
      return;
    }
    try {
      const result = await models.bulkDelete(ids);
      if (result.success) {
        setDeleteMessage({ type: 'success', text: `Deleted ${ids.length} asset${ids.length === 1 ? '' : 's'} from the library and asset folders` });
        setSelectedIds(new Set());
        setSelectMode(false);
        await fetchModels();
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Bulk delete failed';
        setDeleteMessage({ type: 'error', text: errorMessage });
      }
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteMessage(null), 4000);
    }
  };

  const performClearAll = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setConfirmDialog(null);
    try {
      const result = await models.clearAll();
      if (result.success) {
        setDeleteMessage({ type: 'success', text: 'All models cleared' });
        setSelectedIds(new Set());
        setSelectMode(false);
        await fetchModels();
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Clear all failed';
        setDeleteMessage({ type: 'error', text: errorMessage });
      }
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteMessage(null), 4000);
    }
  };

  const handleDelete = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const result = await onDelete(id);
    if (result.success) {
      // Refresh model list after successful deletion
      await fetchModels();
      // Show success message
      setDeleteMessage({ type: 'success', text: 'Asset deleted from the library and asset folders' });
      // Clear message after 3 seconds
      setTimeout(() => setDeleteMessage(null), 3000);
      return { success: true };
    } else {
      // Show error message
      const errorMessage = typeof result.error === 'string'
        ? result.error
        : result.error?.message || 'Failed to delete model';
      setDeleteMessage({ type: 'error', text: errorMessage });
      // Clear message after 5 seconds
      setTimeout(() => setDeleteMessage(null), 5000);
      return { success: false, error: errorMessage };
    }
  };

  const handleRegenerate = async (id: string) => {
    const model = modelList.find((item) => item.id === id);
    try {
      const response = await fetch('/api/hill/regen-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelUuid: id,
          reason: 'manual_ui_request',
          promptHint: [model?.name, model?.description].filter(Boolean).join('. '),
          qualityTier: model?.qualityTier,
          reviewStatus: model?.reviewStatus,
        }),
      });
      const result = await response.json() as ApiResponse<{ id: string }>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? `Request failed with ${response.status}`);
      }

      setDeleteMessage({
        type: 'success',
        text: `Queued Hill regen for ${model?.name ?? 'asset'}`,
      });
      window.dispatchEvent(new CustomEvent('vrmviewer:hill-regen-queued'));
      await fetchRegenJobs();
      await fetchHillStatus();
      setTimeout(() => setDeleteMessage(null), 4000);
    } catch (err) {
      setDeleteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to queue Hill regen',
      });
      setTimeout(() => setDeleteMessage(null), 5000);
      throw err;
    }
  };

  const handleEnrich = async (id: string) => {
    const model = modelList.find((item) => item.id === id);
    try {
      const response = await fetch('/api/hill/enrich-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelUuid: id,
          destination: 'store',
        }),
      });
      const result = await response.json() as ApiResponse<{ job: { id: string } }>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? `Request failed with ${response.status}`);
      }

      setDeleteMessage({
        type: 'success',
        text: `Enriched ${model?.name ?? 'asset'} metadata`,
      });
      await fetchModels();
      setTimeout(() => setDeleteMessage(null), 4000);
    } catch (err) {
      setDeleteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to enrich asset',
      });
      setTimeout(() => setDeleteMessage(null), 5000);
      throw err;
    }
  };

  const handleKeep = async (id: string) => {
    const model = modelList.find((item) => item.id === id);
    const updateResult = await models.update(id, {
      reviewStatus: 'approved',
      qualityTier: model?.qualityTier ?? 'game_ready',
    });
    if (!updateResult.success) {
      const errorMessage = typeof updateResult.error === 'string'
        ? updateResult.error
        : updateResult.error?.message || 'Failed to keep asset';
      setDeleteMessage({ type: 'error', text: errorMessage });
      setTimeout(() => setDeleteMessage(null), 5000);
      throw new Error(errorMessage);
    }

    setDeleteMessage({ type: 'success', text: `Kept ${model?.name ?? 'asset'}` });
    await fetchModels();
    setTimeout(() => setDeleteMessage(null), 3000);
  };

  const handleConjureSubmit = async () => {
    const prompt = conjurePrompt.trim();
    if (!prompt || isConjuring) return;
    setIsConjuring(true);
    try {
      const response = await fetch('/api/hill/conjure-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: conjureMode,
          quality: conjureQuality || undefined,
          generateLods: conjureGenerateLods,
          exportTarget: conjureExportTarget,
          steps: conjureSteps ? Number(conjureSteps) : undefined,
          noRembg: conjureNoRembg,
        }),
      });
      const result = await response.json() as ApiResponse<HillConjureJob>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? `Request failed with ${response.status}`);
      }
      setConjurePrompt('');
      setIsConjureOpen(false);
      setDeleteMessage({
        type: 'success',
        text: `Queued Hill ${conjureMode} job for ${conjureExportTarget}`,
      });
      await fetchConjureJobs();
      await fetchHillStatus();
      setTimeout(() => setDeleteMessage(null), 4000);
    } catch (err) {
      setDeleteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to queue conjure job',
      });
      setTimeout(() => setDeleteMessage(null), 5000);
    } finally {
      setIsConjuring(false);
    }
  };

  const handleConjureModeChange = (mode: 'store' | 'create' | 'conjure') => {
    setConjureMode(mode);
    setConjureQuality('medium');
    setConjureSteps('12');
    setConjureExportTarget((current) => {
      if (mode === 'conjure') return 'game';
      return current === 'game' ? 'library' : current;
    });
  };

  const handlePromoteAsset = async (slug: string) => {
    if (promotingSlug) return;
    setPromotingSlug(slug);
    try {
      const response = await fetch('/api/hill/promotion-queue/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: [slug], importVrm: true }),
      });
      const result = await response.json() as ApiResponse<{
        stdout?: string;
        stderr?: string;
        importedModels?: Array<{ uuid: string; assetGroupId?: string; lodTier?: string; updatedAt?: string; createdAt?: string }>;
      }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? `Promotion failed with ${response.status}`);
      }
      setDeleteMessage({ type: 'success', text: `Promoted ${slug} and imported it into the viewer` });
      await fetchPromotionQueue();
      await fetchModels();
      await fetchHillStatus();
      setAssetView('library');
      setPackFilter(slug);
      const importedModels = result.data?.importedModels ?? [];
      const groupsWithDefault = new Set(
        importedModels
          .filter((model) => model.assetGroupId && model.lodTier === 'default')
          .map((model) => model.assetGroupId as string),
      );
      const primaryModel = importedModels
        .filter((model) =>
          !model.assetGroupId ||
          !model.lodTier ||
          model.lodTier === 'default' ||
          (model.lodTier === 'lod1' && !groupsWithDefault.has(model.assetGroupId)),
        )
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))[0];
      if (primaryModel?.uuid) {
        onLoad(primaryModel.uuid);
      }
      setTimeout(() => setDeleteMessage(null), 5000);
    } catch (err) {
      setDeleteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to promote ${slug}`,
      });
      setTimeout(() => setDeleteMessage(null), 6000);
    } finally {
      setPromotingSlug(null);
    }
  };

  const pageStart = modelTotal === 0 ? 0 : modelOffset + 1;
  const pageEnd = Math.min(modelOffset + filteredModels.length, modelTotal);

  return (
    <div className={`flex h-full ${isAssetSurface ? 'bg-gray-900' : 'flex-col'}`}>
      <div className={isAssetSurface ? 'flex w-80 shrink-0 flex-col overflow-y-auto border-r border-gray-700 bg-gray-800' : 'contents'}>
      {/* Delete notification */}
      {deleteMessage && (
        <div className={`px-4 py-3 border-b ${
          deleteMessage.type === 'success' 
            ? 'bg-green-900/50 border-green-700' 
            : 'bg-red-900/50 border-red-700'
        }`}>
          <div className="flex items-center">
            {deleteMessage.type === 'success' ? (
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className={`text-sm ${
              deleteMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>
              {deleteMessage.text}
            </p>
          </div>
        </div>
      )}
      
      {/* Search + filter + bulk-action toolbar */}
      <div className={`${isAssetSurface ? 'p-4' : 'p-4'} border-b border-gray-700 space-y-3`}>
        {isAssetSurface && (
          <div className="space-y-2">
            <div>
              <h1 className="text-lg font-semibold text-white">Asset Manager</h1>
              <p className="mt-1 text-xs text-gray-400">
                Browse, enrich, regenerate, and open assets.
              </p>
            </div>
            <div className="rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-300">
              {modelTotal.toLocaleString()} visible · showing {pageStart.toLocaleString()}-{pageEnd.toLocaleString()}
            </div>
          </div>
        )}
        {HILL_CONTROLS_ENABLED && hillStatus && (
          <div className="rounded border border-emerald-500/30 bg-emerald-950/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-emerald-200">Hill pipeline</span>
              <span className="text-emerald-300">
                {hillStatus.packCount} pack{hillStatus.packCount === 1 ? '' : 's'} · {hillStatus.promotionQueueCount ?? promotionQueue.length} review · {hillStatus.pendingRegenJobs} regen · {hillStatus.pendingConjureJobs ?? 0} conjure
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-emerald-100/70" title={hillStatus.catalogRoot}>
              {hillStatus.catalogRoot}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsConjureOpen((value) => !value)}
                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Conjure
              </button>
              {conjureJobs[0] && (
                <span className="truncate text-[11px] text-emerald-100/70">
                  Latest: {conjureJobs[0].status} · {conjureJobs[0].assetName ?? conjureJobs[0].prompt}
                </span>
              )}
              {regenJobs[0] && (
                <span className="truncate text-[11px] text-amber-100/80">
                  Regen: {regenJobs[0].status} · {regenJobs[0].assetName ?? regenJobs[0].sourceModelName ?? regenJobs[0].sourceModelUuid}
                </span>
              )}
            </div>
            {isConjureOpen && (
              <div className="mt-3 space-y-2">
                <p className="rounded border border-emerald-500/20 bg-gray-900 px-2 py-1.5 text-[11px] text-emerald-100/80">
                  Flux Klein reference image → Bruno Trellis2 1024 no-cascade · 2048 texture · queued on the DGX GPU lock
                </p>
                <textarea
                  value={conjurePrompt}
                  onChange={(event) => setConjurePrompt(event.target.value)}
                  placeholder="Describe the asset to generate..."
                  className="h-20 w-full resize-none rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="grid grid-cols-2 gap-2">
	                  <select
	                    value={conjureMode}
	                    onChange={(event) => handleConjureModeChange(event.target.value as typeof conjureMode)}
	                    aria-label="Conjure mode"
                    className="min-w-0 rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="conjure">In-game conjure</option>
                    <option value="create">Create mode</option>
                    <option value="store">Store/catalog asset</option>
                  </select>
                  <select
                    value={conjureExportTarget}
                    onChange={(event) => setConjureExportTarget(event.target.value as typeof conjureExportTarget)}
                    aria-label="Export target"
                    className="min-w-0 rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="library">Save to library</option>
                    <option value="game">Export to game</option>
                    <option value="store">Export to store</option>
                  </select>
                  <select
                    value={conjureQuality}
                    onChange={(event) => setConjureQuality(event.target.value)}
                    aria-label="Trellis quality"
                    className="min-w-0 rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="medium">Bruno 1024 / 2048 tex</option>
                    <option value="high">Bruno 1536</option>
                  </select>
                  <label className="min-w-0 text-xs text-emerald-100/80">
                    <span className="sr-only">Trellis steps</span>
                    <input
                      type="number"
                      min={4}
                      max={32}
                      step={1}
                      value={conjureSteps}
                      onChange={(event) => setConjureSteps(event.target.value)}
                      placeholder="Preset steps"
                      aria-label="Trellis steps"
                      className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-emerald-100/80">
                    <input
                      type="checkbox"
                      checked={conjureNoRembg}
                      onChange={(event) => setConjureNoRembg(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    Skip rembg
                  </label>
                  <label className="col-span-2 inline-flex items-center gap-2 text-xs text-emerald-100/80">
                    <input
                      type="checkbox"
                      checked={conjureGenerateLods}
                      onChange={(event) => setConjureGenerateLods(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    Generate LODs
                  </label>
                  <button
                    type="button"
                    onClick={handleConjureSubmit}
                    disabled={!conjurePrompt.trim() || isConjuring}
                    className="col-span-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isConjuring ? 'Queueing...' : 'Generate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {HILL_CONTROLS_ENABLED && (
        <div className="grid grid-cols-2 gap-2 rounded border border-gray-700 bg-gray-900 p-1">
          <button
            type="button"
            onClick={() => setAssetView('library')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              assetView === 'library'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            Library ({filteredModels.length})
          </button>
          <button
            type="button"
            onClick={() => setAssetView('review')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              assetView === 'review'
                ? 'bg-amber-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            Review Queue ({promotionQueue.length})
          </button>
        </div>
        )}
        <div className={isAssetSurface ? 'space-y-3' : ''}>
          <Input
            value={searchQuery}
            onChange={(e) => {
              resetPaging();
              setSearchQuery(e.target.value);
            }}
            placeholder={HILL_CONTROLS_ENABLED && assetView === 'review' ? 'Search review queue...' : 'Search assets...'}
          />
        {(availableFormats.length > 0 || availableCategories.length > 0 || availablePacks.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 grid grid-cols-3 gap-1 rounded border border-gray-600 bg-gray-900 p-1">
              {([
                ['all', `All ${assetKindCounts.all.toLocaleString()}`],
                ['models', `Models ${assetKindCounts.models.toLocaleString()}`],
                ['textures', `Textures ${assetKindCounts.textures.toLocaleString()}`],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    resetPaging();
                    setAssetKindFilter(value);
                  }}
                  className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    assetKindFilter === value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {availablePacks.length > 0 && (
              <select
                value={packFilter}
                onChange={(e) => {
                  resetPaging();
                  setPackFilter(e.target.value);
                }}
                aria-label="Filter by pack"
                className="col-span-2 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All packs</option>
                {availablePacks.map(([slug, name]) => (
                  <option key={slug} value={slug}>{name}</option>
                ))}
              </select>
            )}
            {availableFormats.length > 0 && (
              <select
                value={formatFilter}
                onChange={(e) => {
                  resetPaging();
                  setFormatFilter(e.target.value);
                }}
                aria-label="Filter by format"
                className="min-w-0 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All formats</option>
                {availableFormats.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </select>
            )}
            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => {
                  resetPaging();
                  setCategoryFilter(e.target.value);
                }}
                aria-label="Filter by category"
                className="min-w-0 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <select
              value={listingFilter}
              onChange={(e) => {
                resetPaging();
                setListingFilter(e.target.value as typeof listingFilter);
              }}
              aria-label="Filter by listing status"
              className="col-span-2 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Listed and unlisted</option>
              <option value="live">Live listings</option>
              <option value="draft">Drafts</option>
              <option value="failed">Failed uploads</option>
              <option value="unlisted">Unlisted only</option>
            </select>
            {(formatFilter || categoryFilter || assetKindFilter !== 'all' || packFilter || listingFilter !== 'all') && (
              <button
                onClick={() => {
                  resetPaging();
                  setFormatFilter('');
                  setCategoryFilter('');
                  setAssetKindFilter('all');
                  setPackFilter('');
                  setListingFilter('all');
                }}
                className="col-span-2 justify-self-start px-1 text-xs text-gray-400 hover:text-white"
                title="Clear filters"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor="model-sort" className="text-xs text-gray-400 whitespace-nowrap">
            Sort
          </label>
          <select
            id="model-sort"
            value={sortBy}
            onChange={(e) => {
              resetPaging();
              setSortBy(e.target.value as typeof sortBy);
            }}
            className="flex-1 min-w-0 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recent first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="listed">Listed first</option>
            <option value="unlisted">Unlisted first</option>
          </select>
        </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-400">
            {selectMode
              ? `${selectedIds.size} selected${filteredModels.length ? ` of ${filteredModels.length}` : ''}`
              : (formatFilter || categoryFilter || assetKindFilter !== 'all' || packFilter || listingFilter !== 'all')
                ? `${modelTotal} visible asset${modelTotal === 1 ? '' : 's'}`
                : `${modelTotal} primary asset${modelTotal === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            {!selectMode && assetView === 'library' && (
              <>
                <button
                  onClick={() => setModelOffset(Math.max(0, modelOffset - PAGE_SIZE))}
                  disabled={modelOffset === 0 || isLoading}
                  className="text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() => setModelOffset(modelOffset + PAGE_SIZE)}
                  disabled={!modelHasMore || isLoading}
                  className="text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </>
            )}
            {selectMode ? (
              <>
                <button
                  onClick={selectedIds.size === filteredModels.length ? clearSelection : selectAll}
                  disabled={filteredModels.length === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedIds.size === filteredModels.length && filteredModels.length > 0 ? 'Clear' : 'All'}
                </button>
                <button
                  onClick={() =>
                    selectedIds.size > 0 &&
                    setConfirmDialog({ kind: 'bulkDelete', count: selectedIds.size })
                  }
                  disabled={selectedIds.size === 0}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete ({selectedIds.size})
                </button>
                <button onClick={toggleSelectMode} className="text-gray-300 hover:text-white">
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleSelectMode}
                  disabled={modelList.length === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select
                </button>
                <button
                  onClick={() => setConfirmDialog({ kind: 'clearAll', count: modelList.length })}
                  disabled={modelList.length === 0}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
      
      {/* Model / Review Queue */}
      <div className={`${isAssetSurface ? 'bg-gray-900 p-5' : 'p-4'} flex-1 overflow-y-auto`}>
        {HILL_CONTROLS_ENABLED && assetView === 'review' ? (
          isPromotionQueueLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-gray-600 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-400">Loading review queue...</p>
            </div>
          ) : filteredPromotionQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 4h10a2 2 0 012 2v14l-7-3-7 3V6a2 2 0 012-2z" />
              </svg>
              <p className="text-gray-400">{searchQuery ? 'No queued assets found' : 'Review queue is clear'}</p>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery ? 'Try a different queue search' : 'New gathered assets will appear here after Hill scans.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPromotionQueue.map((item) => {
                const marketplaceEntries = Object.entries(item.catalog?.marketplace ?? {});
                return (
                <div key={item.slug} className="rounded border border-gray-700 bg-gray-800 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white" title={item.slug}>
                        {item.catalog?.title || item.slug}
                      </h3>
                      <p className="mt-1 truncate text-[11px] text-gray-400" title={item.packRoot}>
                        {item.packRoot}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePromoteAsset(item.slug)}
                      disabled={!!promotingSlug}
                      className="shrink-0 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {promotingSlug === item.slug ? 'Loading...' : item.catalog?.cataloged ? 'Load Catalog' : 'Promote + Load'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-[10px] text-gray-200">
                      {formatLabel(item.categoryHint)}
                    </span>
                    <span className="rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-[10px] text-gray-200">
                      {formatLabel(item.sourceRole)}
                    </span>
                    <span className="rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[10px] text-amber-200">
                      {formatLabel(item.promotionStatus)}
                    </span>
                    {item.catalog?.cataloged && (
                      <span className="rounded border border-emerald-500/40 bg-emerald-950/50 px-1.5 py-0.5 text-[10px] text-emerald-200">
                        cataloged
                      </span>
                    )}
                    {item.catalog?.store?.gumroad && (
                      <span className="rounded border border-violet-500/40 bg-violet-950/50 px-1.5 py-0.5 text-[10px] text-violet-200">
                        Gumroad {formatLabel(item.catalog.store.gumroad)}
                      </span>
                    )}
                    {item.catalog?.store?.fab && (
                      <span className="rounded border border-cyan-500/40 bg-cyan-950/50 px-1.5 py-0.5 text-[10px] text-cyan-200">
                        Fab {formatLabel(item.catalog.store.fab)}
                      </span>
                    )}
                    {marketplaceEntries.map(([platform, status]) => (
                      <span
                        key={`${item.slug}-${platform}`}
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${
                          status.remoteStatus === 'FAILED' || status.status === 'failed'
                            ? 'border-red-500/40 bg-red-950/50 text-red-200'
                            : 'border-sky-500/40 bg-sky-950/50 text-sky-200'
                        }`}
                        title={[status.url, status.editUrl, status.source].filter(Boolean).join('\n')}
                      >
                        {marketplaceLabel(platform, status)}
                      </span>
                    ))}
                    {item.catalog?.priceUsd && (
                      <span className="rounded border border-violet-500/40 bg-violet-950/50 px-1.5 py-0.5 text-[10px] text-violet-200">
                        ${item.catalog.priceUsd}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-gray-300">
                    <div>
                      <p className="text-gray-500">Files</p>
                      <p>{item.fileCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Size</p>
                      <p>{formatBytes(item.totalSizeBytes)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">LODs</p>
                      <p className="truncate" title={item.lodTiers.join(', ') || 'none'}>
                        {item.lodTiers.length ? item.lodTiers.join(', ') : 'none'}
                      </p>
                    </div>
                  </div>
                  {marketplaceEntries.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-gray-700 pt-2 text-[11px]">
                      {marketplaceEntries.map(([platform, status]) => (
                        <div key={`${item.slug}-${platform}-link`} className="flex items-center gap-2 text-gray-300">
                          <span className="w-16 shrink-0 text-gray-500">{formatLabel(platform)}</span>
                          {status.url ? (
                            <a
                              href={status.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-blue-300 hover:text-blue-200"
                              title={status.url}
                            >
                              {status.url}
                            </a>
                          ) : (
                            <span className="truncate text-gray-500">No public URL recorded</span>
                          )}
                          {status.editUrl && (
                            <a
                              href={status.editUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-gray-400 hover:text-gray-200"
                            >
                              edit
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-gray-400">Loading models...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400">Error loading models</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            <p className="text-gray-400">
              {searchQuery ? 'No models found' : 'No models yet'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Drag and drop model files to get started'}
            </p>
          </div>
        ) : (
          <div className={isAssetSurface
            ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            : 'grid grid-cols-2 gap-3'
          }>
            {filteredModels.map((model) => (
              <div key={model.id} className="relative">
                {selectMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelected(model.id)}
                    aria-label={selectedIds.has(model.id) ? 'Deselect' : 'Select'}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(model.id)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-gray-900/70 border-gray-500 hover:border-blue-400'
                    }`}
                  >
                    {selectedIds.has(model.id) && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <ModelCard
                  model={model}
                  onLoad={selectMode ? () => toggleSelected(model.id) : onLoad}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onKeep={selectMode ? undefined : handleKeep}
                  onRegenerate={selectMode || !HILL_CONTROLS_ENABLED ? undefined : handleRegenerate}
                  onEnrich={selectMode || !HILL_CONTROLS_ENABLED ? undefined : handleEnrich}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <AnimationEditor
        isOpen={!!editingModel}
        onClose={() => setEditingModel(undefined)}
        onSave={handleSave}
        animation={editingModel ? { id: editingModel.id, name: editingModel.name, description: editingModel.description } : undefined}
      />

      {/* Destructive-action confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.kind === 'clearAll' ? 'Clear entire library?' : 'Delete selected models?'}
        message={
          confirmDialog?.kind === 'clearAll'
            ? `This will remove all ${confirmDialog.count} models and their thumbnails from the database. This cannot be undone.`
            : confirmDialog
              ? `This will delete ${confirmDialog.count} asset${confirmDialog.count === 1 ? '' : 's'} from the library and archive owned source files out of the watched asset folders. This cannot be undone from the UI.`
              : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDialog?.kind === 'clearAll') performClearAll();
          else if (confirmDialog?.kind === 'bulkDelete') performBulkDelete();
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};
