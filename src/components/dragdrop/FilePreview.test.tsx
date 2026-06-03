import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilePreview } from './FilePreview';

describe('FilePreview', () => {
  it('labels VRMA files as animation files', () => {
    render(<FilePreview file={new File(['x'], 'walk.vrma')} />);

    expect(screen.getByText('walk.vrma')).toBeInTheDocument();
    expect(screen.getByText('Animation')).toBeInTheDocument();
    expect(screen.getByText('VRMA')).toBeInTheDocument();
  });

  it('labels FBX files as model / animation because the loader can resolve either path', () => {
    render(<FilePreview file={new File(['x'], 'cat_walk.fbx')} />);

    expect(screen.getByText('cat_walk.fbx')).toBeInTheDocument();
    expect(screen.getByText('Model / animation')).toBeInTheDocument();
    expect(screen.getByText('FBX')).toBeInTheDocument();
  });

  it('wires load and remove actions', () => {
    const onLoad = vi.fn();
    const onRemove = vi.fn();
    render(<FilePreview file={new File(['x'], 'cottage.glb')} onLoad={onLoad} onRemove={onRemove} />);

    screen.getByTitle('Load file').click();
    screen.getByTitle('Remove file').click();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
