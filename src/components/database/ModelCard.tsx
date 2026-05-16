import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

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
  createdAt: string;
  updatedAt?: string;
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

export interface ModelCardProps {
  model: ModelData;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onEdit: (id: string) => void;
  onRegenerate?: (id: string) => Promise<void>;
  onEnrich?: (id: string) => Promise<void>;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onLoad,
  onDelete,
  onEdit,
  onRegenerate,
  onEnrich,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
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
    onLoad(model.id);
  };

  const stopCardOpen = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    setDeleteError(null);
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
      <button
        type="button"
        onClick={(event) => {
          stopCardOpen(event);
          handleDeleteClick();
        }}
        disabled={isDeleting}
        aria-label={`Delete ${model.name}`}
        title="Delete"
        className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500/50 bg-red-950/85 text-red-200 shadow hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? (
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>

      <div className="relative flex aspect-square w-full items-center justify-center bg-gray-900 text-left">
        {model.assetKind === 'texture' && (
          <span className="absolute left-2 top-2 z-10 rounded border border-cyan-400/40 bg-cyan-950/85 px-2 py-0.5 text-[11px] font-medium uppercase text-cyan-100">
            Texture
          </span>
        )}
        <span className="absolute right-2 top-11 z-10 rounded border border-blue-400/40 bg-blue-950/85 px-2 py-0.5 text-[11px] font-medium uppercase text-blue-100 opacity-90 transition-opacity group-hover:opacity-100">
          View
        </span>
        {model.thumbnail ? (
          <img src={model.thumbnail} alt={model.name} className="h-full w-full object-cover" />
        ) : (
          <svg className="h-14 w-14 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
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
        title="Delete Model"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete <span className="font-semibold text-white">{model.name}</span>?
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
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
