import React, { useId, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import type { NormalizedLicense } from '../../types/database.types';

/**
 * Default-pre-populated license shape. `null` lets callers signal "no
 * extracted license available" so the dialog shows blank fields.
 */
export type SaveModelDialogDefaults = {
  name: string;
  description?: string;
  author?: string;
  license?: string;
  normalizedLicense?: NormalizedLicense | null;
};

/**
 * Output of the dialog's Save action. Callers pass this to
 * `ModelService.saveModel`; the `normalizedLicense` override is merged
 * onto the `extractedBundle` so the pipeline-extracted fields stay in
 * sync with the user's edits.
 */
export interface SaveModelFormData {
  name: string;
  description: string;
  author: string;
  license: string;
  normalizedLicense: NormalizedLicense;
}

export interface SaveModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SaveModelFormData) => void;
  defaults: SaveModelDialogDefaults | null;
}

const ALLOWED_USER_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'OnlyAuthor', label: 'Only Author' },
  { value: 'ExplicitlyLicensedPerson', label: 'Explicitly Licensed Person' },
  { value: 'Everyone', label: 'Everyone' },
];

const COMMERCIAL_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'Disallow', label: 'Disallow' },
  { value: 'Allow', label: 'Allow (any)' },
  { value: 'PersonalNonProfit', label: 'Personal — Non-Profit' },
  { value: 'PersonalProfit', label: 'Personal — Profit' },
  { value: 'Corporation', label: 'Corporation' },
];

const ALLOW_DISALLOW_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'Allow', label: 'Allow' },
  { value: 'Disallow', label: 'Disallow' },
];

const MODIFICATION_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'Prohibited', label: 'Prohibited' },
  { value: 'AllowModification', label: 'Allow Modification' },
  {
    value: 'AllowModificationRedistribution',
    label: 'Allow Modification + Redistribution',
  },
];

const CREDIT_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'Required', label: 'Required' },
  { value: 'Unnecessary', label: 'Unnecessary' },
];

const REDISTRIBUTION_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'Allow', label: 'Allow' },
  { value: 'Disallow', label: 'Disallow' },
];

/**
 * Save-model dialog with editable identity + license-metadata fields.
 *
 * Pre-populates from the extraction-pipeline output (passed via
 * `defaults`) so users can review and override what was auto-detected
 * from the VRM's embedded license metadata. Closes the deferred
 * "normalized license fields on the import path" item — previously only
 * the export dialog had license controls.
 */
export const SaveModelDialog: React.FC<SaveModelDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  defaults,
}) => {
  const initialNL = defaults?.normalizedLicense ?? {};
  const descriptionId = useId();

  const [name, setName] = useState(defaults?.name ?? '');
  const [description, setDescription] = useState(defaults?.description ?? '');
  const [author, setAuthor] = useState(defaults?.author ?? '');
  // Prefer the explicit top-level `license` only when it's non-empty; an
  // empty string should fall back to the pipeline-extracted licenseName.
  const [license, setLicense] = useState(
    defaults?.license || initialNL.licenseName || '',
  );
  const [licenseUrl, setLicenseUrl] = useState(initialNL.licenseUrl ?? '');
  const [allowedUserName, setAllowedUserName] = useState<string>(
    initialNL.allowedUserName ?? '',
  );
  const [commercialUsage, setCommercialUsage] = useState<string>(
    initialNL.commercialUsage ?? '',
  );
  const [violentUsage, setViolentUsage] = useState<string>(
    initialNL.violentUsage ?? '',
  );
  const [sexualUsage, setSexualUsage] = useState<string>(
    initialNL.sexualUsage ?? '',
  );
  const [modification, setModification] = useState<string>(
    initialNL.modification ?? '',
  );
  const [creditNotation, setCreditNotation] = useState<string>(
    initialNL.creditNotation ?? '',
  );
  const [allowRedistribution, setAllowRedistribution] = useState<string>(
    initialNL.allowRedistribution ?? '',
  );

  // Re-sync state when the caller swaps in a new model's defaults
  // (e.g. user cancels then loads a different file). Uses the React-docs
  // "adjust state during render" pattern to match AnimationEditor.tsx.
  const [lastName, setLastName] = useState(defaults?.name);
  if (defaults?.name !== lastName) {
    setLastName(defaults?.name);
    const nl = defaults?.normalizedLicense ?? {};
    setName(defaults?.name ?? '');
    setDescription(defaults?.description ?? '');
    setAuthor(defaults?.author ?? '');
    setLicense(defaults?.license || nl.licenseName || '');
    setLicenseUrl(nl.licenseUrl ?? '');
    setAllowedUserName(nl.allowedUserName ?? '');
    setCommercialUsage(nl.commercialUsage ?? '');
    setViolentUsage(nl.violentUsage ?? '');
    setSexualUsage(nl.sexualUsage ?? '');
    setModification(nl.modification ?? '');
    setCreditNotation(nl.creditNotation ?? '');
    setAllowRedistribution(nl.allowRedistribution ?? '');
  }

  const handleSave = () => {
    if (!name.trim()) return;

    const normalizedLicense: NormalizedLicense = {
      licenseName: license.trim() || undefined,
      licenseUrl: licenseUrl.trim() || undefined,
      allowedUserName:
        (allowedUserName as NormalizedLicense['allowedUserName']) || undefined,
      commercialUsage:
        (commercialUsage as NormalizedLicense['commercialUsage']) || undefined,
      violentUsage:
        (violentUsage as NormalizedLicense['violentUsage']) || undefined,
      sexualUsage:
        (sexualUsage as NormalizedLicense['sexualUsage']) || undefined,
      modification:
        (modification as NormalizedLicense['modification']) || undefined,
      creditNotation:
        (creditNotation as NormalizedLicense['creditNotation']) || undefined,
      allowRedistribution:
        (allowRedistribution as NormalizedLicense['allowRedistribution']) ||
        undefined,
    };

    onSave({
      name: name.trim(),
      description: description.trim(),
      author: author.trim(),
      license: license.trim(),
      normalizedLicense,
    });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Save Model" size="lg">
      <div className="space-y-4">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Identity
          </h3>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter model name"
            error={!name.trim() ? 'Name is required' : undefined}
          />
          <div>
            <label
              htmlFor={descriptionId}
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <Input
            label="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Optional author name"
          />
        </section>

        <section className="space-y-3 pt-2 border-t border-gray-700">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            License
          </h3>
          <p className="text-xs text-gray-400">
            Pre-filled from the model file when available. Override below
            to record your own terms.
          </p>
          <Input
            label="License name"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="e.g. CC_BY, CC0, VRoid Hub, Custom"
          />
          <Input
            label="License URL"
            value={licenseUrl}
            onChange={(e) => setLicenseUrl(e.target.value)}
            placeholder="https://..."
          />
          <Select
            label="Allowed users"
            value={allowedUserName}
            onChange={(e) => setAllowedUserName(e.target.value)}
            options={ALLOWED_USER_OPTIONS}
          />
          <Select
            label="Commercial use"
            value={commercialUsage}
            onChange={(e) => setCommercialUsage(e.target.value)}
            options={COMMERCIAL_OPTIONS}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Violent use"
              value={violentUsage}
              onChange={(e) => setViolentUsage(e.target.value)}
              options={ALLOW_DISALLOW_OPTIONS}
            />
            <Select
              label="Sexual use"
              value={sexualUsage}
              onChange={(e) => setSexualUsage(e.target.value)}
              options={ALLOW_DISALLOW_OPTIONS}
            />
          </div>
          <Select
            label="Modification"
            value={modification}
            onChange={(e) => setModification(e.target.value)}
            options={MODIFICATION_OPTIONS}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Credit notation"
              value={creditNotation}
              onChange={(e) => setCreditNotation(e.target.value)}
              options={CREDIT_OPTIONS}
            />
            <Select
              label="Redistribution"
              value={allowRedistribution}
              onChange={(e) => setAllowRedistribution(e.target.value)}
              options={REDISTRIBUTION_OPTIONS}
            />
          </div>
        </section>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Save to Library
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
