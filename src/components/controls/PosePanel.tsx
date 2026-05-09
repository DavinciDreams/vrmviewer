import React, { useState } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { VRMHelper } from '../../core/three/vrm/VRMHelper';
import { VRMHumanoidBoneName } from '../../constants/boneNames';

export interface PosePanelProps {
  vrm: VRM | null | undefined;
  disabled?: boolean;
}

interface BoneState {
  position: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

const ZERO_BONE: BoneState = {
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

function readBoneState(vrm: VRM | null | undefined, bone: VRMHumanoidBoneName | ''): BoneState {
  if (!vrm || !bone) return ZERO_BONE;
  const transform = VRMHelper.getBoneTransform(vrm, bone as VRMHumanoidBoneName);
  if (!transform) return ZERO_BONE;
  const euler = new THREE.Euler().setFromQuaternion(transform.rotation, 'XYZ');
  return {
    position: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
    rotationDeg: { x: euler.x * RAD2DEG, y: euler.y * RAD2DEG, z: euler.z * RAD2DEG },
    scale: { x: transform.scale.x, y: transform.scale.y, z: transform.scale.z },
  };
}

/**
 * PosePanel — humanoid bone editor.
 *
 * Surfaces the rest of the VRMHelper API: bone position / rotation (Euler) /
 * scale, plus convenience operations (center-at-origin, scale-to-height,
 * reset selected bone).
 *
 * Only meaningful for VRM models with a humanoid rig. For non-VRM imports
 * (`currentModel.vrm` is undefined) the panel disables itself with a hint.
 */
export const PosePanel: React.FC<PosePanelProps> = ({ vrm, disabled = false }) => {
  const availableBones = vrm ? VRMHelper.getAvailableBones(vrm) : [];
  const hasBones = availableBones.length > 0;

  const [selectedBone, setSelectedBone] = useState<VRMHumanoidBoneName | ''>(
    hasBones ? availableBones[0] : '',
  );
  const [state, setState] = useState<BoneState>(readBoneState(vrm, selectedBone));
  const [targetHeight, setTargetHeight] = useState(1.6);

  // Re-read bone state when the selected bone or VRM identity changes — using
  // the React-docs adjust-state-during-render pattern so we don't trip the
  // setState-in-effect lint rule.
  // The vrm half of the key uses a stable identity (not just truthiness) so
  // that swapping models invalidates `selectedBone` too — otherwise the
  // dropdown would stay pointing at a bone name from the previous model.
  const vrmKey = vrm ? (vrm as unknown as { uuid?: string }).uuid ?? 'has' : 'none';
  const currentKey = `${vrmKey}::${selectedBone}`;
  const [lastKey, setLastKey] = useState<string>(currentKey);
  if (lastKey !== currentKey) {
    setLastKey(currentKey);
    // If the VRM identity changed and the previously-selected bone no longer
    // exists on the new model, snap to the first available bone.
    if (selectedBone && !availableBones.includes(selectedBone as VRMHumanoidBoneName)) {
      const next = hasBones ? availableBones[0] : '';
      setSelectedBone(next);
      setState(readBoneState(vrm, next));
    } else {
      setState(readBoneState(vrm, selectedBone));
    }
  }

  const applyState = (next: BoneState) => {
    setState(next);
    if (!vrm || !selectedBone) return;
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        next.rotationDeg.x * DEG2RAD,
        next.rotationDeg.y * DEG2RAD,
        next.rotationDeg.z * DEG2RAD,
        'XYZ',
      ),
    );
    VRMHelper.setBoneTransform(vrm, selectedBone as VRMHumanoidBoneName, {
      position: new THREE.Vector3(next.position.x, next.position.y, next.position.z),
      rotation,
      scale: new THREE.Vector3(next.scale.x, next.scale.y, next.scale.z),
    });
  };

  const setPositionAxis = (axis: 'x' | 'y' | 'z', value: number) =>
    applyState({ ...state, position: { ...state.position, [axis]: value } });

  const setRotationAxis = (axis: 'x' | 'y' | 'z', value: number) =>
    applyState({ ...state, rotationDeg: { ...state.rotationDeg, [axis]: value } });

  const setScaleAxis = (axis: 'x' | 'y' | 'z', value: number) =>
    applyState({ ...state, scale: { ...state.scale, [axis]: value } });

  const handleResetBone = () => {
    if (!vrm || !selectedBone) return;
    VRMHelper.resetBonePose(vrm, selectedBone as VRMHumanoidBoneName);
    setState(readBoneState(vrm, selectedBone));
  };

  const handleCenterOrigin = () => {
    if (!vrm) return;
    VRMHelper.centerAtOrigin(vrm);
    setState(readBoneState(vrm, selectedBone));
  };

  const handleScaleToHeight = () => {
    if (!vrm) return;
    VRMHelper.scaleToHeight(vrm, targetHeight);
    setState(readBoneState(vrm, selectedBone));
  };

  // Render helpers -----------------------------------------------------------

  const axisRow = (
    label: string,
    axis: 'x' | 'y' | 'z',
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step: number,
  ) => (
    <div className="space-y-1" key={`${label}-${axis}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label} {axis.toUpperCase()}</span>
        <span className="text-xs text-blue-400 font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled || !hasBones}
        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
      />
    </div>
  );

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4 max-h-[32rem] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Pose</h3>
        <button
          onClick={handleResetBone}
          disabled={disabled || !vrm || !selectedBone}
          className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
        >
          Reset bone
        </button>
      </div>

      {!vrm && (
        <p className="text-xs text-gray-400 italic">
          Pose editing requires a VRM model with a humanoid rig.
        </p>
      )}

      {/* Bone selector */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Bone</label>
        <select
          value={selectedBone}
          onChange={(e) => setSelectedBone(e.target.value as VRMHumanoidBoneName)}
          disabled={disabled || !hasBones}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {hasBones ? (
            availableBones.map((bone) => (
              <option key={bone} value={bone}>
                {bone}
              </option>
            ))
          ) : (
            <option value="">No humanoid bones</option>
          )}
        </select>
      </div>

      {/* Position */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-300">Position</p>
        {axisRow('Position', 'x', state.position.x, (v) => setPositionAxis('x', v), -1, 1, 0.01)}
        {axisRow('Position', 'y', state.position.y, (v) => setPositionAxis('y', v), -1, 1, 0.01)}
        {axisRow('Position', 'z', state.position.z, (v) => setPositionAxis('z', v), -1, 1, 0.01)}
      </div>

      {/* Rotation */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-300">Rotation (degrees)</p>
        {axisRow('Rotation', 'x', state.rotationDeg.x, (v) => setRotationAxis('x', v), -180, 180, 1)}
        {axisRow('Rotation', 'y', state.rotationDeg.y, (v) => setRotationAxis('y', v), -180, 180, 1)}
        {axisRow('Rotation', 'z', state.rotationDeg.z, (v) => setRotationAxis('z', v), -180, 180, 1)}
      </div>

      {/* Scale */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-300">Scale</p>
        {axisRow('Scale', 'x', state.scale.x, (v) => setScaleAxis('x', v), 0.1, 2, 0.05)}
        {axisRow('Scale', 'y', state.scale.y, (v) => setScaleAxis('y', v), 0.1, 2, 0.05)}
        {axisRow('Scale', 'z', state.scale.z, (v) => setScaleAxis('z', v), 0.1, 2, 0.05)}
      </div>

      {/* Whole-model utilities */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-300">Model</p>
        <button
          onClick={handleCenterOrigin}
          disabled={disabled || !vrm}
          className="w-full px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Center at origin
        </button>
        <div className="flex gap-2">
          <input
            type="number"
            min="0.5"
            max="3"
            step="0.05"
            value={targetHeight}
            onChange={(e) => setTargetHeight(parseFloat(e.target.value))}
            disabled={disabled || !vrm}
            className="flex-1 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleScaleToHeight}
            disabled={disabled || !vrm}
            className="px-3 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Scale to height (m)
          </button>
        </div>
      </div>
    </div>
  );
};
