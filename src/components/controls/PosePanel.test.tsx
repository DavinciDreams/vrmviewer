/**
 * PosePanel — humanoid bone editor backed by VRMHelper static methods.
 * VRMHelper is mocked at the module level; the panel itself is exercised
 * end-to-end including the bone-selector dropdown and the three axis groups.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as THREE from 'three';

const helperMock = vi.hoisted(() => ({
  getAvailableBones: vi.fn(),
  getBoneTransform: vi.fn(),
  setBoneTransform: vi.fn(),
  resetBonePose: vi.fn(),
  centerAtOrigin: vi.fn(),
  scaleToHeight: vi.fn(),
}));

vi.mock('../../core/three/vrm/VRMHelper', () => ({
  VRMHelper: helperMock,
}));

import { PosePanel } from './PosePanel';

const fakeVrm = { uuid: 'fake-vrm' } as any;

function transform(overrides: Partial<{
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
}> = {}) {
  return {
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Quaternion(),
    scale: new THREE.Vector3(1, 1, 1),
    ...overrides,
  };
}

beforeEach(() => {
  helperMock.getAvailableBones.mockReset().mockReturnValue(['hips', 'spine', 'head']);
  helperMock.getBoneTransform.mockReset().mockReturnValue(transform());
  helperMock.setBoneTransform.mockReset();
  helperMock.resetBonePose.mockReset();
  helperMock.centerAtOrigin.mockReset();
  helperMock.scaleToHeight.mockReset();
});

describe('PosePanel — empty state', () => {
  it('renders the no-VRM hint when vrm is null', () => {
    render(<PosePanel vrm={null} />);
    expect(
      screen.getByText(/Pose editing requires a VRM model/i),
    ).toBeInTheDocument();
  });

  it('does not call helper functions when vrm is null', () => {
    render(<PosePanel vrm={null} />);
    expect(helperMock.getBoneTransform).not.toHaveBeenCalled();
    expect(helperMock.setBoneTransform).not.toHaveBeenCalled();
  });
});

describe('PosePanel — bone selector', () => {
  it('renders one option per available bone, first selected by default', () => {
    render(<PosePanel vrm={fakeVrm} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('hips');
    expect(select.options.length).toBe(3);
  });

  it('shows a "No humanoid bones" fallback option when none are available', () => {
    helperMock.getAvailableBones.mockReturnValueOnce([]);
    render(<PosePanel vrm={fakeVrm} />);
    expect(
      screen.getByRole('option', { name: /no humanoid bones/i }),
    ).toBeInTheDocument();
  });

  it('changing selection re-reads the bone transform', () => {
    render(<PosePanel vrm={fakeVrm} />);
    const select = screen.getByRole('combobox');
    helperMock.getBoneTransform.mockClear();
    fireEvent.change(select, { target: { value: 'spine' } });
    expect(helperMock.getBoneTransform).toHaveBeenCalledWith(fakeVrm, 'spine');
  });
});

describe('PosePanel — axis sliders', () => {
  it('position X slider calls setBoneTransform with updated position', () => {
    render(<PosePanel vrm={fakeVrm} />);
    const sliders = screen.getAllByRole('slider');
    // First three sliders are position x/y/z (in that order).
    fireEvent.change(sliders[0], { target: { value: '0.5' } });

    expect(helperMock.setBoneTransform).toHaveBeenCalledTimes(1);
    const [vrmArg, boneArg, opts] = helperMock.setBoneTransform.mock.calls[0];
    expect(vrmArg).toBe(fakeVrm);
    expect(boneArg).toBe('hips');
    expect(opts.position.x).toBeCloseTo(0.5);
    expect(opts.position.y).toBe(0);
    expect(opts.position.z).toBe(0);
  });

  it('rotation slider converts degrees to a quaternion before setBoneTransform', () => {
    render(<PosePanel vrm={fakeVrm} />);
    const sliders = screen.getAllByRole('slider');
    // sliders[3..5] are rotation x/y/z.
    fireEvent.change(sliders[3], { target: { value: '90' } }); // 90° around X

    const opts = helperMock.setBoneTransform.mock.calls[0][2];
    // Quaternion(x, y, z, w) for 90° around X ≈ (sin(45°), 0, 0, cos(45°))
    expect(opts.rotation.x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(opts.rotation.w).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it('scale slider calls setBoneTransform with updated scale', () => {
    render(<PosePanel vrm={fakeVrm} />);
    const sliders = screen.getAllByRole('slider');
    // sliders[6..8] are scale x/y/z.
    fireEvent.change(sliders[6], { target: { value: '1.5' } });

    const opts = helperMock.setBoneTransform.mock.calls[0][2];
    expect(opts.scale.x).toBeCloseTo(1.5);
    expect(opts.scale.y).toBe(1);
  });
});

describe('PosePanel — utility actions', () => {
  it('Reset bone button calls VRMHelper.resetBonePose for the selected bone', () => {
    render(<PosePanel vrm={fakeVrm} />);
    fireEvent.click(screen.getByRole('button', { name: /reset bone/i }));
    expect(helperMock.resetBonePose).toHaveBeenCalledWith(fakeVrm, 'hips');
  });

  it('Reset bone disabled when no vrm', () => {
    render(<PosePanel vrm={null} />);
    expect(screen.getByRole('button', { name: /reset bone/i })).toBeDisabled();
  });

  it('Center at origin button calls VRMHelper.centerAtOrigin', () => {
    render(<PosePanel vrm={fakeVrm} />);
    fireEvent.click(screen.getByRole('button', { name: /center at origin/i }));
    expect(helperMock.centerAtOrigin).toHaveBeenCalledWith(fakeVrm);
  });

  it('Scale to height button forwards the typed height value', () => {
    render(<PosePanel vrm={fakeVrm} />);
    const heightInput = screen.getByRole('spinbutton');
    fireEvent.change(heightInput, { target: { value: '1.8' } });
    fireEvent.click(screen.getByRole('button', { name: /scale to height/i }));
    expect(helperMock.scaleToHeight).toHaveBeenCalledWith(fakeVrm, 1.8);
  });
});

describe('PosePanel — disabled state', () => {
  it('disables sliders and buttons when disabled prop is true', () => {
    render(<PosePanel vrm={fakeVrm} disabled />);
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /center at origin/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /scale to height/i })).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

describe('PosePanel — bone-list invalidation on vrm change', () => {
  it('snaps to the first available bone when current selection no longer exists on the new vrm', () => {
    // Start with full bone list, select "spine".
    const { rerender } = render(<PosePanel vrm={fakeVrm} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'spine' } });
    expect((select as HTMLSelectElement).value).toBe('spine');

    // Swap the VRM (new identity) and have only ['leftArm'] available.
    const newVrm = { uuid: 'other-vrm' } as any;
    helperMock.getAvailableBones.mockReturnValue(['leftArm']);

    rerender(<PosePanel vrm={newVrm} />);
    // "spine" isn't in the new bone list → component snaps to first available.
    expect((select as HTMLSelectElement).value).toBe('leftArm');
  });
});
