import React from 'react';
import type { ModelRecord } from '../../types/database.types';

type LoadedModelRecord = ModelRecord | (Omit<ModelRecord, 'data'> & { data?: undefined });

interface AssetInfoPanelProps {
  model: LoadedModelRecord | null;
}

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'none';
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="min-w-0 break-words text-gray-100">{value}</span>
    </div>
  );
}

export const AssetInfoPanel: React.FC<AssetInfoPanelProps> = ({ model }) => {
  if (!model) return null;

  const gameExport = model.exports?.game;
  const storeExport = model.exports?.store;
  const copyPlatforms = model.marketplaceCopy ? Object.keys(model.marketplaceCopy) : [];

  return (
    <aside className="max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/90 p-4 text-sm text-gray-100 shadow-lg backdrop-blur-sm">
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold leading-tight text-white">
            {model.displayName || model.name}
          </h2>
          <p className="mt-1 text-xs uppercase tracking-wide text-blue-300">
            {formatLabel(model.category || model.lodTier || model.format)}
          </p>
        </div>

        {model.description && (
          <p className="text-xs leading-relaxed text-gray-300">{model.description}</p>
        )}

        <div className="space-y-1 border-t border-gray-700 pt-3">
          <InfoRow label="LOD" value={model.lodTier?.toUpperCase()} />
          <InfoRow label="Quality" value={formatLabel(model.qualityTier)} />
          <InfoRow label="Review" value={formatLabel(model.reviewStatus)} />
          <InfoRow label="License" value={model.license} />
          <InfoRow label="Pack" value={model.packName || model.packSlug} />
          <InfoRow label="Size" value={model.size ? `${(model.size / 1024 / 1024).toFixed(1)} MB` : undefined} />
          <InfoRow label="Polys" value={model.polycount?.toLocaleString()} />
        </div>

        {model.tags && model.tags.length > 0 && (
          <div className="border-t border-gray-700 pt-3">
            <p className="mb-2 text-xs text-gray-400">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {model.tags.slice(0, 16).map((tag) => (
                <span key={tag} className="rounded bg-gray-800 px-2 py-0.5 text-[11px] text-gray-200">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1 border-t border-gray-700 pt-3">
          <p className="mb-2 text-xs font-medium text-gray-300">Store</p>
          <InfoRow label="Price" value={model.priceUsd ? `$${model.priceUsd}` : undefined} />
          <InfoRow label="Copy" value={copyPlatforms.length ? copyPlatforms.join(', ') : undefined} />
          <InfoRow label="Status" value={storeExport ? formatLabel(storeExport.status) : undefined} />
          <InfoRow label="Manifest" value={storeExport?.manifestPath} />
        </div>

        <div className="space-y-1 border-t border-gray-700 pt-3">
          <p className="mb-2 text-xs font-medium text-gray-300">Game Export</p>
          <InfoRow label="Status" value={gameExport ? formatLabel(gameExport.status) : undefined} />
          <InfoRow label="Manifest" value={gameExport?.manifestPath} />
          <InfoRow label="LOD dir" value={gameExport?.lodDir} />
        </div>
      </div>
    </aside>
  );
};
