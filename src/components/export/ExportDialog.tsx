import React, { useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { ExportOptions, ExportOptionsData } from './ExportOptions';

export type { ExportOptionsData };

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptionsData) => void;
  defaultName?: string;
  metadata?: Partial<ExportOptionsData> & {
    tags?: string[];
    license?: string;
  };
  isExporting?: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  defaultName = 'export',
  metadata,
  isExporting = false,
}) => {
  const [options, setOptions] = useState<ExportOptionsData>({
    format: 'vrm',
    destination: 'game',
    name: defaultName,
    description: '',
    author: '',
    version: '',
    category: '',
    keywords: '',
    visibility: 'platform_curated',
    includeThumbnail: true,
    generateLods: true,
    withKtx2: true,
    withLod3: true,
    createGumroadDraft: false,
    autoUploadGumroad: false,
    quality: 'medium',
  });

  useEffect(() => {
    if (!isOpen) return;
    // Export defaults are intentionally refreshed when the modal opens for a
    // newly loaded model; user edits happen after this initial open sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptions((current) => ({
      ...current,
      format: metadata?.format ?? current.format,
      destination: metadata?.destination ?? current.destination,
      name: metadata?.name || defaultName,
      description: metadata?.description ?? '',
      author: metadata?.author ?? '',
      version: metadata?.version ?? '',
      category: metadata?.category ?? '',
      keywords: metadata?.keywords ?? metadata?.tags?.join(', ') ?? '',
      license: metadata?.license ?? '',
      visibility: metadata?.visibility ?? current.visibility ?? 'platform_curated',
      generateLods: metadata?.generateLods ?? true,
      withKtx2: metadata?.withKtx2 ?? true,
      withLod3: metadata?.withLod3 ?? true,
    }));
  }, [defaultName, isOpen, metadata]);

  const handleExport = () => {
    if (!options.name.trim()) return;
    onExport(options);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Export" size="lg">
      <div className="space-y-6">
        <ExportOptions options={options} onChange={setOptions} />
        
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!options.name.trim() || isExporting}
            loading={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
