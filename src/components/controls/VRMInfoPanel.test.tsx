/**
 * VRMInfoPanel — read-only inspector for the currently-loaded VRM.
 *
 * All five `VRMHelper.*` static methods that the panel calls are mocked
 * at the module level so we can drive specific UI states without needing
 * a real VRM instance. The panel itself has no hooks beyond `useMemo`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const helperMock = vi.hoisted(() => ({
  getMetadata: vi.fn(),
  validateVRM: vi.fn(),
  getSize: vi.fn(),
  getBoundingBox: vi.fn(),
  getSkeletonHierarchy: vi.fn(),
}));

vi.mock('../../core/three/vrm/VRMHelper', () => ({
  VRMHelper: helperMock,
}));

import { VRMInfoPanel } from './VRMInfoPanel';

const fakeVrm = { uuid: 'fake-vrm' } as any;

describe('VRMInfoPanel', () => {
  it('renders an empty-state hint when no VRM is loaded', () => {
    render(<VRMInfoPanel vrm={null} />);
    expect(
      screen.getByText(/Load a VRM model to see its metadata/i),
    ).toBeInTheDocument();
    // Should not call any helper methods when vrm is null.
    expect(helperMock.getMetadata).not.toHaveBeenCalled();
  });

  it('renders valid-VRM dot + label when validation reports valid', () => {
    helperMock.validateVRM.mockReturnValueOnce({ valid: true, errors: [] });
    helperMock.getMetadata.mockReturnValueOnce(null);
    helperMock.getSize.mockReturnValueOnce(null);
    helperMock.getBoundingBox.mockReturnValueOnce(null);
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([]);

    render(<VRMInfoPanel vrm={fakeVrm} />);
    expect(screen.getByText(/Valid VRM/i)).toBeInTheDocument();
  });

  it('lists each validation error when validateVRM reports invalid', () => {
    helperMock.validateVRM.mockReturnValueOnce({
      valid: false,
      errors: ['Missing hips bone', 'No expressionManager'],
    });
    helperMock.getMetadata.mockReturnValueOnce(null);
    helperMock.getSize.mockReturnValueOnce(null);
    helperMock.getBoundingBox.mockReturnValueOnce(null);
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([]);

    render(<VRMInfoPanel vrm={fakeVrm} />);
    expect(screen.getByText(/2 issues/)).toBeInTheDocument();
    expect(screen.getByText(/Missing hips bone/)).toBeInTheDocument();
    expect(screen.getByText(/No expressionManager/)).toBeInTheDocument();
  });

  it('pluralizes "issue" correctly for a single error', () => {
    helperMock.validateVRM.mockReturnValueOnce({
      valid: false,
      errors: ['Missing humanoid'],
    });
    helperMock.getMetadata.mockReturnValueOnce(null);
    helperMock.getSize.mockReturnValueOnce(null);
    helperMock.getBoundingBox.mockReturnValueOnce(null);
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([]);

    render(<VRMInfoPanel vrm={fakeVrm} />);
    expect(screen.getByText(/^1 issue$/)).toBeInTheDocument();
  });

  it('renders each populated metadata field (and skips empty ones)', () => {
    helperMock.validateVRM.mockReturnValueOnce({ valid: true, errors: [] });
    helperMock.getMetadata.mockReturnValueOnce({
      title: 'Avatar Name',
      author: 'Creator',
      version: '1.0',
      licenseName: 'CC_BY',
      allowedUserName: 'Everyone',
      commercialUsageName: 'Allow',
      // omit other fields — they should NOT render
    });
    helperMock.getSize.mockReturnValueOnce(null);
    helperMock.getBoundingBox.mockReturnValueOnce(null);
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([]);

    render(<VRMInfoPanel vrm={fakeVrm} />);

    expect(screen.getByText('Avatar Name')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('CC_BY')).toBeInTheDocument();
    expect(screen.getByText('Everyone')).toBeInTheDocument();
    // Skipped fields should not appear as labels-without-values.
    expect(screen.queryByText(/^Violent use/i)).not.toBeInTheDocument();
  });

  it('renders dimensions block when size + bbox both present', () => {
    helperMock.validateVRM.mockReturnValueOnce({ valid: true, errors: [] });
    helperMock.getMetadata.mockReturnValueOnce(null);
    helperMock.getSize.mockReturnValueOnce({
      width: 0.5,
      height: 1.65,
      depth: 0.4,
    });
    helperMock.getBoundingBox.mockReturnValueOnce({
      min: { x: -0.25, y: 0, z: -0.2 },
      max: { x: 0.25, y: 1.65, z: 0.2 },
    });
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([]);

    render(<VRMInfoPanel vrm={fakeVrm} />);
    expect(screen.getByText(/Dimensions/)).toBeInTheDocument();
    expect(screen.getByText('1.650')).toBeInTheDocument();
    expect(screen.getByText(/\(-0\.25, 0\.00, -0\.20\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\.25, 1\.65, 0\.20\)/)).toBeInTheDocument();
  });

  it('renders skeleton list with depth-based indentation', () => {
    helperMock.validateVRM.mockReturnValueOnce({ valid: true, errors: [] });
    helperMock.getMetadata.mockReturnValueOnce(null);
    helperMock.getSize.mockReturnValueOnce(null);
    helperMock.getBoundingBox.mockReturnValueOnce(null);
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([
      { name: 'hips', depth: 0 },
      { name: 'spine', depth: 1 },
      { name: 'head', depth: 3 },
    ]);

    render(<VRMInfoPanel vrm={fakeVrm} />);
    expect(screen.getByText(/Skeleton \(3 bones\)/)).toBeInTheDocument();
    expect(screen.getByText('hips')).toBeInTheDocument();
    expect(screen.getByText('spine')).toBeInTheDocument();
    expect(screen.getByText('head')).toBeInTheDocument();
  });

  it('omits the skeleton section entirely when getSkeletonHierarchy returns []', () => {
    helperMock.validateVRM.mockReturnValueOnce({ valid: true, errors: [] });
    helperMock.getMetadata.mockReturnValueOnce(null);
    helperMock.getSize.mockReturnValueOnce(null);
    helperMock.getBoundingBox.mockReturnValueOnce(null);
    helperMock.getSkeletonHierarchy.mockReturnValueOnce([]);

    render(<VRMInfoPanel vrm={fakeVrm} />);
    expect(screen.queryByText(/Skeleton/i)).not.toBeInTheDocument();
  });
});
