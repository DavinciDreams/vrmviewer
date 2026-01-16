import React from 'react';
import { Input } from '../ui/Input';
import { Select, SelectOption } from '../ui/Select';

export interface ExportOptionsData {
  format: 'vrm' | 'vrma' | 'glb';
  name: string;
  description?: string;
  author?: string;
  version?: string;
  includeThumbnail: boolean;
  quality: 'low' | 'medium' | 'high';
}

export interface ExportOptionsProps {
  options: ExportOptionsData;
  onChange: (options: ExportOptionsData) => void;
}

const formatOptions: SelectOption[] = [
  { value: 'vrm', label: 'VRM' },
  { value: 'vrma', label: 'VRMA (Animation)' },
  { value: 'glb', label: 'GLB' },
];

const qualityOptions: SelectOption[] = [
  { value: 'low', label: 'Low (Smaller file)' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'high', label: 'High (Best quality)' },
];

export const ExportOptions: React.FC<ExportOptionsProps> = ({ options, onChange }) => {
  const handleChange = <K extends keyof ExportOptionsData>(
    key: K,
    value: ExportOptionsData[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-4">
      <Select
        label="Export Format"
        options={formatOptions}
        value={options.format}
        onChange={(e) => handleChange('format', e.target.value as ExportOptionsData['format'])}
        helperText="Choose the format for export"
      />
      
      <Input
        label="Name"
        value={options.name}
        onChange={(e) => handleChange('name', e.target.value)}
        placeholder="Enter export name"
        helperText="Descriptive name for the exported file"
      />
      
      <Input
        label="Description"
        value={options.description || ''}
        onChange={(e) => handleChange('description', e.target.value)}
        placeholder="Enter description (optional)"
      />
      
      <Input
        label="Author"
        value={options.author || ''}
        onChange={(e) => handleChange('author', e.target.value)}
        placeholder="Enter author name (optional)"
      />
      
      <Input
        label="Version"
        value={options.version || ''}
        onChange={(e) => handleChange('version', e.target.value)}
        placeholder="Enter version (optional)"
      />
      
      <Select
        label="Quality"
        options={qualityOptions}
        value={options.quality}
        onChange={(e) => handleChange('quality', e.target.value as ExportOptionsData['quality'])}
        helperText="Higher quality produces larger files"
      />
      
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="includeThumbnail"
          checked={options.includeThumbnail}
          onChange={(e) => handleChange('includeThumbnail', e.target.checked)}
          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
        />
        <label
          htmlFor="includeThumbnail"
          className="text-sm text-gray-300 cursor-pointer"
        >
          Include thumbnail
        </label>
      </div>
    </div>
  );
};
