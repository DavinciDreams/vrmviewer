import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { ExportOptions, ExportOptionsData } from './ExportOptions';

export type { ExportOptionsData };

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptionsData) => void;
  defaultName?: string;
  isExporting?: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  defaultName = 'export',
  isExporting = false,
}) => {
  const [options, setOptions] = useState<ExportOptionsData>({
    format: 'vrm',
    name: defaultName,
    description: '',
    author: '',
    version: '',
    includeThumbnail: true,
    quality: 'medium',
  });

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
