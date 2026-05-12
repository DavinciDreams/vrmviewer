/**
 * useExport — exporter delegation + state machine + download side-effect.
 *
 * Mocks the three exporter singletons. Verifies:
 *   - format/version overlays are stamped onto the options sent to each
 *     exporter (e.g. exportVRM always sets format='vrm', version='0.0')
 *   - the user-supplied overrides merge cleanly, including nested metadata
 *   - downloadFile path: URL.createObjectURL → anchor click → revoke
 *   - state flags (isExporting / exportProgress / exportResult) sequenced
 *     correctly during a run
 *   - updateExportOptions / updateMetadata merge into local state
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const exporters = vi.hoisted(() => ({
  vrm: { exportVRM: vi.fn() },
  vrma: { exportVRMA: vi.fn() },
  gltf: { exportGLTF: vi.fn() },
}));

vi.mock('../core/three/export/VRMExporter', () => ({
  getVRMExporter: () => exporters.vrm,
}));
vi.mock('../core/three/export/VRMAExporter', () => ({
  getVRMAExporter: () => exporters.vrma,
}));
vi.mock('../core/three/export/GLTFExporterEnhanced', () => ({
  getGLTFExporterEnhanced: () => exporters.gltf,
}));

// Import after mocks.
import { useExport } from './useExport';

// DOM-side mocks for the download helper.
beforeEach(() => {
  exporters.vrm.exportVRM.mockReset();
  exporters.vrma.exportVRMA.mockReset();
  exporters.gltf.exportGLTF.mockReset();

  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: vi.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fakeGroup = {} as any;
const fakeClip = {} as any;

function successResult(filename: string) {
  return {
    success: true,
    data: { blob: new Blob(['x']), filename },
  };
}

describe('useExport — exportVRM', () => {
  it('stamps format=vrm + version=0.0 onto options + downloads result on success', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce(successResult('avatar.vrm'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRM(fakeGroup);
    });

    expect(exporters.vrm.exportVRM).toHaveBeenCalledTimes(1);
    const [model, opts] = exporters.vrm.exportVRM.mock.calls[0];
    expect(model).toBe(fakeGroup);
    expect(opts.format).toBe('vrm');
    expect(opts.version).toBe('0.0');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('merges caller overrides into options + metadata (nested merge)', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce(successResult('avatar.vrm'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRM(fakeGroup, {
        quality: 'high',
        metadata: { author: 'Caller', title: 'Override Title' },
      });
    });

    const opts = exporters.vrm.exportVRM.mock.calls[0][1];
    expect(opts.quality).toBe('high');
    expect(opts.metadata.author).toBe('Caller');
    expect(opts.metadata.title).toBe('Override Title');
    // Caller-omitted nested metadata fields fall back to defaults.
    expect(opts.metadata.version).toBe('1.0');
  });

  it('does NOT download when exporter returns success=false', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce({
      success: false,
      error: { message: 'failed' },
    });

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRM(fakeGroup);
    });

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
  });

  it('state machine: isExporting toggles, progress null after, result stored', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce(successResult('avatar.vrm'));

    const { result } = renderHook(() => useExport());
    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportResult).toBeNull();

    await act(async () => {
      await result.current.exportVRM(fakeGroup);
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportProgress).toBeNull();
    expect(result.current.exportResult?.success).toBe(true);
  });
});

describe('useExport — exportVRMA', () => {
  it('stamps format=vrma onto options + uses metadata.title as animationName', async () => {
    exporters.vrma.exportVRMA.mockResolvedValueOnce(successResult('anim.vrma'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRMA(fakeClip, {
        metadata: { title: 'My Walk' },
      });
    });

    const [clip, opts] = exporters.vrma.exportVRMA.mock.calls[0];
    expect(clip).toBe(fakeClip);
    expect(opts.format).toBe('vrma');
    expect(opts.animationName).toBe('My Walk');
  });

  it('defaults animationName to "Untitled Animation" when metadata.title missing', async () => {
    exporters.vrma.exportVRMA.mockResolvedValueOnce(successResult('anim.vrma'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRMA(fakeClip);
    });

    const opts = exporters.vrma.exportVRMA.mock.calls[0][1];
    expect(opts.animationName).toBe('Untitled Animation');
  });

  it('downloads result on success', async () => {
    exporters.vrma.exportVRMA.mockResolvedValueOnce(successResult('a.vrma'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRMA(fakeClip);
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('useExport — exportGLTF', () => {
  it('stamps format=glb + binary=true when format omitted (default glb)', async () => {
    exporters.gltf.exportGLTF.mockResolvedValueOnce(successResult('out.glb'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportGLTF(fakeGroup);
    });

    const opts = exporters.gltf.exportGLTF.mock.calls[0][1];
    expect(opts.format).toBe('glb');
    expect(opts.binary).toBe(true);
  });

  it('stamps format=gltf + binary=false when format=gltf', async () => {
    exporters.gltf.exportGLTF.mockResolvedValueOnce(successResult('out.gltf'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportGLTF(fakeGroup, 'gltf');
    });

    const opts = exporters.gltf.exportGLTF.mock.calls[0][1];
    expect(opts.format).toBe('gltf');
    expect(opts.binary).toBe(false);
  });
});

describe('useExport — option/metadata mutators + cancel/reset', () => {
  it('updateExportOptions shallow-merges into state', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce(successResult('a.vrm'));

    const { result } = renderHook(() => useExport());
    act(() => {
      result.current.updateExportOptions({ quality: 'high' });
    });
    expect(result.current.exportOptions.quality).toBe('high');

    // Verify it flows through to the next export.
    await act(async () => {
      await result.current.exportVRM(fakeGroup);
    });
    expect(exporters.vrm.exportVRM.mock.calls[0][1].quality).toBe('high');
  });

  it('updateMetadata deep-merges metadata sub-object', () => {
    const { result } = renderHook(() => useExport());
    act(() => {
      result.current.updateMetadata({ author: 'A' });
    });
    act(() => {
      result.current.updateMetadata({ title: 'B' });
    });
    expect(result.current.exportOptions.metadata.author).toBe('A');
    expect(result.current.exportOptions.metadata.title).toBe('B');
  });

  it('cancelExport resets the three state fields', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce(successResult('a.vrm'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRM(fakeGroup);
    });
    expect(result.current.exportResult).not.toBeNull();

    act(() => {
      result.current.cancelExport();
    });
    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportProgress).toBeNull();
    expect(result.current.exportResult).toBeNull();
  });

  it('resetExport behaves the same as cancelExport', async () => {
    exporters.vrm.exportVRM.mockResolvedValueOnce(successResult('a.vrm'));

    const { result } = renderHook(() => useExport());
    await act(async () => {
      await result.current.exportVRM(fakeGroup);
    });

    act(() => {
      result.current.resetExport();
    });
    expect(result.current.exportResult).toBeNull();
  });
});
