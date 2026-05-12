import React, { useMemo } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { VRMHelper } from '../../core/three/vrm/VRMHelper';

export interface VRMInfoPanelProps {
  vrm: VRM | null | undefined;
}

/**
 * VRMInfoPanel — read-only inspector for the currently-loaded VRM.
 *
 * Surfaces five `VRMHelper` APIs that previously had no UI:
 *   - `getMetadata` → title / author / version / license fields
 *   - `validateVRM` → green-or-red status with the missing-bone / missing-
 *     manager error list
 *   - `getSize` → height / width / depth in metres
 *   - `getBoundingBox` → min / max corners
 *   - `getSkeletonHierarchy` → indented bone list (root → tips)
 *
 * All values are computed lazily via useMemo keyed on the VRM identity, so
 * the cost is only paid when the user opens the panel against a new model.
 * The dimension/box numbers come from a THREE.Box3 over the live scene —
 * they reflect the current scale + position, not the bind-pose-only shape.
 */
export const VRMInfoPanel: React.FC<VRMInfoPanelProps> = ({ vrm }) => {
  const metadata = useMemo(() => (vrm ? VRMHelper.getMetadata(vrm) : null), [vrm]);
  const validation = useMemo(() => (vrm ? VRMHelper.validateVRM(vrm) : null), [vrm]);
  const size = useMemo(() => (vrm ? VRMHelper.getSize(vrm) : null), [vrm]);
  const bbox = useMemo(() => (vrm ? VRMHelper.getBoundingBox(vrm) : null), [vrm]);
  const skeleton = useMemo(() => (vrm ? VRMHelper.getSkeletonHierarchy(vrm) : []), [vrm]);

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4 max-h-[32rem] overflow-y-auto text-sm">
      <h3 className="text-white font-medium">VRM Info</h3>

      {!vrm && (
        <p className="text-xs text-gray-400 italic">
          Load a VRM model to see its metadata, validation status, dimensions and skeleton.
        </p>
      )}

      {/* Validation status */}
      {validation && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                validation.valid ? 'bg-green-400' : 'bg-red-400'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-gray-200">
              {validation.valid ? 'Valid VRM' : `${validation.errors.length} issue${validation.errors.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {!validation.valid && (
            <ul className="text-xs text-red-300 list-disc list-inside space-y-0.5">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Metadata */}
      {metadata && (
        <div className="space-y-1 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-300 mb-1">Metadata</p>
          <InfoRow label="Title" value={metadata.title} />
          <InfoRow label="Author" value={metadata.author} />
          <InfoRow label="Version" value={metadata.version} />
          <InfoRow label="License" value={metadata.licenseName} />
          <InfoRow label="Allowed users" value={metadata.allowedUserName} />
          <InfoRow label="Commercial use" value={metadata.commercialUsageName} />
          <InfoRow label="Violent use" value={metadata.violentUsageName} />
          <InfoRow label="Sexual use" value={metadata.sexualUsageName} />
          <InfoRow label="Contact" value={metadata.contactInformation} />
          <InfoRow label="Reference" value={metadata.reference} />
        </div>
      )}

      {/* Dimensions */}
      {size && bbox && (
        <div className="space-y-1 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-300 mb-1">Dimensions (current scale, metres)</p>
          <InfoRow label="Height" value={size.height.toFixed(3)} />
          <InfoRow label="Width" value={size.width.toFixed(3)} />
          <InfoRow label="Depth" value={size.depth.toFixed(3)} />
          <InfoRow
            label="Min"
            value={`(${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}, ${bbox.min.z.toFixed(2)})`}
          />
          <InfoRow
            label="Max"
            value={`(${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)}, ${bbox.max.z.toFixed(2)})`}
          />
        </div>
      )}

      {/* Skeleton hierarchy */}
      {skeleton.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-300 mb-1">Skeleton ({skeleton.length} bones)</p>
          <ul className="text-xs font-mono text-gray-300 space-y-0.5 max-h-48 overflow-y-auto">
            {skeleton.map((bone, i) => (
              <li
                key={`${bone.name}-${i}`}
                style={{ paddingLeft: `${bone.depth * 0.75}rem` }}
                className="leading-tight"
              >
                <span className="text-gray-500">{bone.depth > 0 ? '└ ' : ''}</span>
                {bone.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value?: string | null;
}

/** Two-column key/value row. Hidden entirely when the value is falsy. */
const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 text-right truncate" title={value}>
        {value}
      </span>
    </div>
  );
};
