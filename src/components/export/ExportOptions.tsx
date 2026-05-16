import React from 'react';
import { Input } from '../ui/Input';
import { Select, SelectOption } from '../ui/Select';

export interface ExportOptionsData {
  format: 'vrm' | 'vrma' | 'glb' | 'gltf';
  destination: 'download' | 'game' | 'store' | 'gumroad_unreal';
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  keywords?: string;
  visibility?: 'public_cc0' | 'private_personal' | 'private_commercial' | 'platform_curated';
  includeThumbnail: boolean;
  generateLods?: boolean;
  withKtx2?: boolean;
  withLod3?: boolean;
  createGumroadDraft?: boolean;
  autoUploadGumroad?: boolean;
  quality: 'low' | 'medium' | 'high' | 'ultra';

  // VRM-specific optimization flags (ignored for non-VRM formats)
  removeUnnecessaryVertices?: boolean;
  combineSkeletons?: boolean;
  combineMorphs?: boolean;

  // VRM-specific license metadata (ignored for non-VRM formats)
  license?: string;
  allowedUserName?: 'OnlyAuthor' | 'ExplicitlyLicensedPerson' | 'Everyone';
  violentUsageName?: 'Disallow' | 'Allow';
  sexualUsageName?: 'Disallow' | 'Allow';
  commercialUsageName?: 'Disallow' | 'Allow';
  contactInformation?: string;
  reference?: string;
  otherLicenseUrl?: string;
}

export interface ExportOptionsProps {
  options: ExportOptionsData;
  onChange: (options: ExportOptionsData) => void;
}

const formatOptions: SelectOption[] = [
  { value: 'vrm', label: 'VRM' },
  { value: 'vrma', label: 'VRMA (Animation)' },
  { value: 'glb', label: 'GLB' },
  { value: 'gltf', label: 'GLTF (JSON)' },
];

const qualityOptions: SelectOption[] = [
  { value: 'low', label: 'Low (Smaller file)' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'high', label: 'High (Best quality)' },
  { value: 'ultra', label: 'Ultra (4K textures)' },
];

const destinationOptions: SelectOption[] = [
  { value: 'game', label: 'Game asset store' },
  { value: 'store', label: 'Marketplace/store package' },
  { value: 'gumroad_unreal', label: 'Gumroad + Unreal package' },
  { value: 'download', label: 'Download file' },
];

const visibilityOptions: SelectOption[] = [
  { value: 'platform_curated', label: 'Platform curated' },
  { value: 'public_cc0', label: 'Public CC0' },
  { value: 'private_personal', label: 'Private personal' },
  { value: 'private_commercial', label: 'Private commercial' },
];

const allowedUserOptions: SelectOption[] = [
  { value: 'OnlyAuthor', label: 'Only Author' },
  { value: 'ExplicitlyLicensedPerson', label: 'Explicitly Licensed Person' },
  { value: 'Everyone', label: 'Everyone' },
];

const allowDisallowOptions: SelectOption[] = [
  { value: 'Disallow', label: 'Disallow' },
  { value: 'Allow', label: 'Allow' },
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
        label="Destination"
        options={destinationOptions}
        value={options.destination}
        onChange={(e) => handleChange('destination', e.target.value as ExportOptionsData['destination'])}
        helperText="Send directly into the game asset store, prepare a marketplace package, or export a local file"
      />

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
        label="Category"
        value={options.category || ''}
        onChange={(e) => handleChange('category', e.target.value)}
        placeholder="building, vegetation, prop..."
      />

      <Input
        label="Keywords"
        value={options.keywords || ''}
        onChange={(e) => handleChange('keywords', e.target.value)}
        placeholder="Comma-separated product keywords"
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

      <Select
        label="Visibility / License Mode"
        options={visibilityOptions}
        value={options.visibility ?? 'platform_curated'}
        onChange={(e) => handleChange('visibility', e.target.value as ExportOptionsData['visibility'])}
      />

      {options.destination !== 'download' && (
        <fieldset className="border border-gray-700 rounded-lg p-3 space-y-2">
          <legend className="text-xs text-gray-400 px-1">Store export build</legend>
          {([
            ['generateLods', 'Generate LOD pyramid'],
            ['withKtx2', 'Include KTX2 variants'],
            ['withLod3', 'Include LOD3/imposter tier'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`export-${key}`}
                checked={options[key] !== false}
                onChange={(e) => handleChange(key, e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor={`export-${key}`} className="text-sm text-gray-300 cursor-pointer">
                {label}
              </label>
            </div>
          ))}
          {options.destination === 'gumroad_unreal' && (
            <>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="export-create-gumroad-draft"
                  checked={options.createGumroadDraft === true}
                  onChange={(e) => handleChange('createGumroadDraft', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="export-create-gumroad-draft" className="text-sm text-gray-300 cursor-pointer">
                  Create Gumroad draft
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="export-auto-upload-gumroad"
                  checked={options.autoUploadGumroad === true}
                  onChange={(e) => handleChange('autoUploadGumroad', e.target.checked)}
                  disabled={options.createGumroadDraft !== true}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                />
                <label htmlFor="export-auto-upload-gumroad" className="text-sm text-gray-300 cursor-pointer">
                  Attach files with Gumroad browser session
                </label>
              </div>
            </>
          )}
        </fieldset>
      )}
      
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

      {/* VRM-specific optimization flags */}
      {options.format === 'vrm' && (
        <fieldset className="border border-gray-700 rounded-lg p-3 space-y-2">
          <legend className="text-xs text-gray-400 px-1">VRM optimization</legend>
          {([
            ['removeUnnecessaryVertices', 'Remove unnecessary vertices'],
            ['combineSkeletons', 'Combine skeletons'],
            ['combineMorphs', 'Combine morph targets'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`opt-${key}`}
                // Default ON to match VRMExporter behaviour (`!== false`)
                checked={options[key] !== false}
                onChange={(e) => handleChange(key, e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor={`opt-${key}`} className="text-sm text-gray-300 cursor-pointer">
                {label}
              </label>
            </div>
          ))}
        </fieldset>
      )}

      {/* VRM license metadata */}
      {options.format === 'vrm' && (
        <fieldset className="border border-gray-700 rounded-lg p-3 space-y-3">
          <legend className="text-xs text-gray-400 px-1">VRM license metadata</legend>
          <Select
            label="Allowed users"
            options={allowedUserOptions}
            value={options.allowedUserName ?? ''}
            onChange={(e) =>
              handleChange(
                'allowedUserName',
                (e.target.value || undefined) as ExportOptionsData['allowedUserName']
              )
            }
            helperText="Who is permitted to use this avatar"
          />
          <Select
            label="Violent usage"
            options={allowDisallowOptions}
            value={options.violentUsageName ?? ''}
            onChange={(e) =>
              handleChange(
                'violentUsageName',
                (e.target.value || undefined) as ExportOptionsData['violentUsageName']
              )
            }
          />
          <Select
            label="Sexual usage"
            options={allowDisallowOptions}
            value={options.sexualUsageName ?? ''}
            onChange={(e) =>
              handleChange(
                'sexualUsageName',
                (e.target.value || undefined) as ExportOptionsData['sexualUsageName']
              )
            }
          />
          <Select
            label="Commercial usage"
            options={allowDisallowOptions}
            value={options.commercialUsageName ?? ''}
            onChange={(e) =>
              handleChange(
                'commercialUsageName',
                (e.target.value || undefined) as ExportOptionsData['commercialUsageName']
              )
            }
          />
          <Input
            label="License"
            value={options.license || ''}
            onChange={(e) => handleChange('license', e.target.value)}
            placeholder="e.g. CC_BY, CC_BY_NC, Other"
          />
          <Input
            label="Other license URL"
            value={options.otherLicenseUrl || ''}
            onChange={(e) => handleChange('otherLicenseUrl', e.target.value)}
            placeholder="URL of license terms (optional)"
          />
          <Input
            label="Contact"
            value={options.contactInformation || ''}
            onChange={(e) => handleChange('contactInformation', e.target.value)}
            placeholder="Email or website (optional)"
          />
          <Input
            label="Reference"
            value={options.reference || ''}
            onChange={(e) => handleChange('reference', e.target.value)}
            placeholder="Reference URL (optional)"
          />
        </fieldset>
      )}
    </div>
  );
};
