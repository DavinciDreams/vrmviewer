/**
 * useThumbnailCapture — config overrides, capture pipeline, save side-effect,
 * data-URL parsing, viewer-ref fallback, delete/get pass-through.
 *
 * captureThumbnail (the util) is mocked since it requires a live WebGL
 * context. ThumbnailService is mocked at the module level.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const captureMock = vi.hoisted(() => vi.fn());
const serviceMock = vi.hoisted(() => ({
  saveThumbnail: vi.fn().mockResolvedValue({ success: true }),
  getThumbnailByTarget: vi.fn(),
  deleteThumbnailByTarget: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../utils/thumbnailUtils', () => ({
  captureThumbnail: captureMock,
}));
vi.mock('../core/database/services/ThumbnailService', () => ({
  getThumbnailService: () => serviceMock,
}));

import { useThumbnailCapture } from './useThumbnailCapture';

const fakeRenderer = {} as any;
const fakeScene = {} as any;
const fakeCamera = {} as any;

beforeEach(() => {
  captureMock.mockReset();
  serviceMock.saveThumbnail.mockReset().mockResolvedValue({ success: true });
  serviceMock.getThumbnailByTarget.mockReset();
  serviceMock.deleteThumbnailByTarget
    .mockReset()
    .mockResolvedValue({ success: true });
});

describe('useThumbnailCapture — capture', () => {
  it('forwards captureThumbnail with config defaults', async () => {
    captureMock.mockResolvedValueOnce('data:image/png;base64,XYZ');

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let returned = '';
    await act(async () => {
      returned = await result.current.capture(fakeRenderer, fakeScene, fakeCamera);
    });

    expect(returned).toBe('data:image/png;base64,XYZ');
    expect(captureMock).toHaveBeenCalledWith(
      fakeRenderer,
      fakeScene,
      fakeCamera,
      expect.objectContaining({
        size: 256,
        format: 'png',
        quality: 0.9,
        backgroundColor: '#1a1a2e',
      }),
    );
  });

  it('per-call option overrides take precedence over hook config', async () => {
    captureMock.mockResolvedValueOnce('data:image/jpeg;base64,YYY');

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0, size: 100 }));
    await act(async () => {
      await result.current.capture(fakeRenderer, fakeScene, fakeCamera, {
        size: 512,
        format: 'jpeg',
      });
    });

    const opts = captureMock.mock.calls[0][3];
    expect(opts.size).toBe(512);
    expect(opts.format).toBe('jpeg');
  });

  it('throws when enabled=false', async () => {
    const { result } = renderHook(() =>
      useThumbnailCapture({ enabled: false, delay: 0 }),
    );

    await expect(
      result.current.capture(fakeRenderer, fakeScene, fakeCamera),
    ).rejects.toThrow(/disabled/i);
  });
});

describe('useThumbnailCapture — captureAndSave', () => {
  it('parses data URL, saves thumbnail, returns success with thumbnail', async () => {
    captureMock.mockResolvedValueOnce('data:image/png;base64,Zm9v');

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res: any;
    await act(async () => {
      res = await result.current.captureAndSave(
        fakeRenderer,
        fakeScene,
        fakeCamera,
        'model-uuid',
        'ModelName',
      );
    });

    expect(res.success).toBe(true);
    expect(res.thumbnail).toBe('data:image/png;base64,Zm9v');
    expect(serviceMock.saveThumbnail).toHaveBeenCalledTimes(1);
    const saved = serviceMock.saveThumbnail.mock.calls[0][0];
    expect(saved.type).toBe('model');
    expect(saved.targetUuid).toBe('model-uuid');
    expect(saved.format).toBe('png');
    expect(saved.data).toBe('Zm9v'); // base64 portion only
  });

  it('rejects malformed data URL', async () => {
    captureMock.mockResolvedValueOnce('garbage-not-a-data-url');

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res: any;
    await act(async () => {
      res = await result.current.captureAndSave(
        fakeRenderer,
        fakeScene,
        fakeCamera,
        'uuid',
        'name',
      );
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/data URL/i);
    expect(serviceMock.saveThumbnail).not.toHaveBeenCalled();
  });

  it('surfaces service save failure', async () => {
    captureMock.mockResolvedValueOnce('data:image/png;base64,Zm9v');
    serviceMock.saveThumbnail.mockResolvedValueOnce({
      success: false,
      error: { message: 'quota' },
    });

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res: any;
    await act(async () => {
      res = await result.current.captureAndSave(
        fakeRenderer,
        fakeScene,
        fakeCamera,
        'uuid',
        'name',
      );
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('quota');
  });

  it('returns disabled error when enabled=false', async () => {
    const { result } = renderHook(() =>
      useThumbnailCapture({ enabled: false, delay: 0 }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.captureAndSave(
        fakeRenderer,
        fakeScene,
        fakeCamera,
        'u',
        'n',
      );
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/disabled/i);
  });
});

describe('useThumbnailCapture — captureFromViewer', () => {
  it('delegates to viewerRef.current.captureThumbnail and saves', async () => {
    const viewerCapture = vi
      .fn()
      .mockResolvedValueOnce('data:image/webp;base64,QkFa');
    const viewerRef = { current: { captureThumbnail: viewerCapture } };

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res: any;
    await act(async () => {
      res = await result.current.captureFromViewer(viewerRef as any, 'u', 'n');
    });

    expect(viewerCapture).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(serviceMock.saveThumbnail).toHaveBeenCalled();
    expect(serviceMock.saveThumbnail.mock.calls[0][0].format).toBe('webp');
  });

  it('returns error when viewerRef.current is missing', async () => {
    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res: any;
    await act(async () => {
      res = await result.current.captureFromViewer(
        { current: null } as any,
        'u',
        'n',
      );
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/viewer reference/i);
  });

  it('returns disabled error when enabled=false', async () => {
    const viewerRef = { current: { captureThumbnail: vi.fn() } };
    const { result } = renderHook(() =>
      useThumbnailCapture({ enabled: false, delay: 0 }),
    );
    let res: any;
    await act(async () => {
      res = await result.current.captureFromViewer(viewerRef as any, 'u', 'n');
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/disabled/i);
  });
});

describe('useThumbnailCapture — deleteThumbnail / getThumbnail', () => {
  it('deleteThumbnail returns true on service success', async () => {
    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res = false;
    await act(async () => {
      res = await result.current.deleteThumbnail('uuid');
    });
    expect(res).toBe(true);
    expect(serviceMock.deleteThumbnailByTarget).toHaveBeenCalledWith('uuid');
  });

  it('deleteThumbnail returns false on service failure', async () => {
    serviceMock.deleteThumbnailByTarget.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let res = true;
    await act(async () => {
      res = await result.current.deleteThumbnail('uuid');
    });
    expect(res).toBe(false);
  });

  it('getThumbnail rebuilds the data URL from the stored format + base64', async () => {
    serviceMock.getThumbnailByTarget.mockResolvedValueOnce({
      success: true,
      data: { format: 'png', data: 'Zm9v' },
    });

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let url: string | null = null;
    await act(async () => {
      url = await result.current.getThumbnail('uuid');
    });
    expect(url).toBe('data:image/png;base64,Zm9v');
  });

  it('getThumbnail returns null when service returns failure', async () => {
    serviceMock.getThumbnailByTarget.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let url: string | null = '';
    await act(async () => {
      url = await result.current.getThumbnail('uuid');
    });
    expect(url).toBeNull();
  });

  it('getThumbnail returns null + logs on service throw', async () => {
    serviceMock.getThumbnailByTarget.mockRejectedValueOnce(new Error('db down'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useThumbnailCapture({ delay: 0 }));
    let url: string | null = '';
    await act(async () => {
      url = await result.current.getThumbnail('uuid');
    });
    expect(url).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
