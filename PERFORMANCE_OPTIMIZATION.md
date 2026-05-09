# Performance Optimization Guide

## Overview

This guide covers performance optimization strategies for handling diverse 3D assets (models, animations, creatures, props, etc.) in VRM Viewer.

## Asset Loading Optimization

### 1. Lazy Loading by Asset Type

Load different asset types based on user needs:

```typescript
// Load only necessary assets
async function loadAssetsByContext(context: 'viewer' | 'editor' | 'preview') {
  switch (context) {
    case 'viewer':
      // Load high-quality models with textures
      return loadModels({
        assetTypes: [AssetType.CHARACTER],
        quality: 'high',
        includeTextures: true
      });
    case 'editor':
      // Load wireframe models only
      return loadModels({
        assetTypes: [AssetType.CHARACTER],
        quality: 'low',
        includeTextures: false
      });
    case 'preview':
      // Load thumbnails only
      return loadThumbnails();
  }
}
```

### 2. Progressive Loading

Load assets in stages:

```typescript
async function loadModelProgressive(uuid: string) {
  // Stage 1: Load metadata and thumbnail
  const metadata = await db.models.where('uuid').equals(uuid).first();

  // Stage 2: Load geometry (low poly)
  const geometry = await loadModelGeometry(uuid, { quality: 'low' });

  // Stage 3: Load textures progressively
  const textures = await loadTexturesProgressive(uuid);

  // Stage 4: Load full quality
  const fullModel = await loadModelGeometry(uuid, { quality: 'high' });
}
```

### 3. Chunked File Loading

Load large files in chunks to avoid blocking:

```typescript
async function loadLargeFileInChunks(uuid: string, chunkSize = 1024 * 1024) {
  const record = await db.models.where('uuid').equals(uuid).first();
  const { data, size } = record!;

  const chunks = Math.ceil(size / chunkSize);
  const loadedChunks: ArrayBuffer[] = [];

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, size);
    const chunk = data.slice(start, end);
    loadedChunks.push(chunk);

    // Report progress
    onProgress?.({
      loaded: (i + 1) * chunkSize,
      total: size,
      percentage: ((i + 1) / chunks) * 100
    });

    // Yield to main thread
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return combineChunks(loadedChunks);
}
```

## Rendering Optimization

### 1. Level of Detail (LOD)

Switch model quality based on distance:

```typescript
class LODManager {
  private lodLevels = [
    { distance: 0, quality: 'high', polyCount: 50000 },
    { distance: 10, quality: 'medium', polyCount: 20000 },
    { distance: 20, quality: 'low', polyCount: 5000 },
  ];

  updateLOD(camera: THREE.Camera, model: THREE.Group) {
    const distance = camera.position.distanceTo(model.position);

    for (const level of this.lodLevels) {
      if (distance < level.distance) {
        this.setModelQuality(model, level.quality);
        break;
      }
    }
  }
}
```

### 2. Frustum Culling

Skip rendering objects outside camera view:

```typescript
class FrustumCulling {
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();

  cull(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.frustum.setFromProjectionMatrix(
      this.projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const inFrustum = this.frustum.intersectsObject(object);
        object.visible = inFrustum;
      }
    });
  }
}
```

### 3. Instanced Rendering

For repeated assets (props, environment):

```typescript
class InstancedMeshManager {
  private instances = new Map<string, THREE.InstancedMesh>();

  addInstance(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const key = `${geometry.uuid}-${material.uuid}`;

    if (!this.instances.has(key)) {
      const mesh = new THREE.InstancedMesh(geometry, material, 1000);
      this.instances.set(key, mesh);
    }

    const instance = this.instances.get(key)!;
    const index = instance.count;
    instance.setMatrixAt(index, new THREE.Matrix4());
    instance.instanceMatrix.needsUpdate = true;
  }
}
```

## Memory Optimization

### 1. Texture Compression

Compress textures for web delivery:

```typescript
async function optimizeTexture(texture: THREE.Texture): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = texture.image.width;
  canvas.height = texture.image.height;

  ctx.drawImage(texture.image as HTMLImageElement, 0, 0);

  // Compress as WebP with quality 0.8
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.8);
  });

  return blob;
}
```

### 2. Geometry Simplification

Reduce polygon count for distant models:

```typescript
async function simplifyGeometry(
  geometry: THREE.BufferGeometry,
  targetRatio: number
): Promise<THREE.BufferGeometry> {
  // Use BufferGeometryUtils.simplifyBufferGeometry
  const simplified = THREE.BufferGeometryUtils.mergeVertices(geometry);

  // Further simplification based on target ratio
  const targetCount = Math.floor(geometry.attributes.position.count * targetRatio);

  return THREE.BufferGeometryUtils.simplifyBufferGeometry(
    simplified,
    {
      vertices: targetCount,
      tolerance: 0.001
    }
  );
}
```

### 3. Dispose Unused Assets

Clean up memory when assets are unloaded:

```typescript
class AssetDisposer {
  disposeModel(model: THREE.Group) {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();

        if (Array.isArray(object.material)) {
          object.material.forEach(mat => mat.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }

  disposeAnimation(animation: THREE.AnimationClip) {
    // Animation clips don't require explicit disposal
    // but references should be cleared
  }
}
```

## Database Optimization

### 1. Index Strategy

Create indexes for frequently queried fields:

```typescript
// Schema definition with optimal indexes
this.version(3).stores({
  models: `
    ++id,
    uuid,
    name,
    format,
    assetType,          // NEW: Index for asset type filtering
    skeletonType,       // NEW: Index for skeleton type filtering
    createdAt,
    size,
    *tags
  `,
});
```

### 2. Query Optimization

Use indexed fields for fast queries:

```typescript
// ✅ GOOD: Uses indexed field
const characters = await db.models
  .where('assetType')
  .equals(AssetType.CHARACTER)
  .toArray();

// ❌ BAD: Filters after loading all records
const allModels = await db.models.toArray();
const characters = allModels.filter(m => m.assetType === AssetType.CHARACTER);
```

### 3. Pagination

Load data in pages for large datasets:

```typescript
async function loadModelsPaginated(page: number, pageSize = 50) {
  const offset = page * pageSize;

  // Use Dexie's offset and limit
  const models = await db.models
    .orderBy('createdAt')
    .reverse()
    .offset(offset)
    .limit(pageSize)
    .toArray();

  const total = await db.models.count();

  return {
    data: models,
    page,
    pageSize,
    hasMore: offset + models.length < total,
    total
  };
}
```

## Animation Optimization

### 1. Animation Sampling

Reduce animation keyframes for performance:

```typescript
function sampleAnimation(
  animation: THREE.AnimationClip,
  targetFPS: number
): THREE.AnimationClip {
  const originalFPS = 60; // Assume original is 60fps
  const sampleRatio = originalFPS / targetFPS;

  const newTracks = animation.tracks.map(track => {
    const times = track.times;
    const values = track.values;

    // Sample every nth frame
    const sampledTimes = times.filter((_, i) => i % Math.floor(sampleRatio) === 0);
    const sampledValues = values.filter((_, i) => i % Math.floor(sampleRatio) === 0);

    track.times = sampledTimes;
    track.values = sampledValues;
    return track;
  });

  return new THREE.AnimationClip(
    animation.name + '_sampled',
    animation.duration * sampleRatio,
    newTracks
  );
}
```

### 2. Animation Caching

Cache decoded animations:

```typescript
class AnimationCache {
  private cache = new Map<string, THREE.AnimationClip>();

  get(key: string): THREE.AnimationClip | undefined {
    return this.cache.get(key);
  }

  set(key: string, animation: THREE.AnimationClip) {
    // Cache with size limit
    const maxSize = 10;
    if (this.cache.size >= maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, animation);
  }
}
```

## Asset-Specific Optimizations

### Character Models

```typescript
// Character optimization priorities
const CHARACTER_OPTIMIZATIONS = {
  preserve: ['face', 'hands'],  // High detail for important areas
  simplify: ['clothing', 'hair'],  // Can simplify
  lod: true,
  morphTargets: false,  // Disable if not needed
};
```

### Creature Models

```typescript
// Creature optimization priorities
const CREATURE_OPTIMIZATIONS = {
  preserve: ['head', 'spine'],  // Important for animation
  simplify: ['legs', 'tail'],  // Can use LOD
  fur: false,  // Disable fur simulation for performance
  ikChains: true,  // Keep IK for animation quality
};
```

### Prop Models

```typescript
// Prop optimization priorities
const PROP_OPTIMIZATIONS = {
  lod: true,  // Props can use aggressive LOD
  instancing: true,  // Enable instancing for repeated props
  batching: true,  // Batch similar props
};
```

## Monitoring and Profiling

### 1. Performance Metrics

Track key performance indicators:

```typescript
class PerformanceMonitor {
  private metrics = {
    loadTime: [] as number[],
    memoryUsage: [] as number[],
    frameTime: [] as number[],
  };

  recordLoadTime(time: number) {
    this.metrics.loadTime.push(time);
    console.log(`Model load time: ${time}ms`);
  }

  getAverageLoadTime(): number {
    const sum = this.metrics.loadTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.loadTime.length;
  }
}
```

### 2. Memory Profiling

Monitor IndexedDB usage:

```typescript
async function getDatabaseUsage() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { usage, quota } = await navigator.storage.estimate();
    const percentage = (usage / quota) * 100;

    console.log(`Database usage: ${percentage.toFixed(2)}%`);

    if (percentage > 80) {
      console.warn('Database nearly full. Consider cleanup.');
    }
  }
}
```

### 3. Frame Rate Monitoring

Monitor rendering performance:

```typescript
class FPSMonitor {
  private frames = 0;
  private lastTime = performance.now();

  update() {
    this.frames++;

    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    if (elapsed >= 1000) {
      const fps = Math.round((this.frames * 1000) / elapsed);
      console.log(`FPS: ${fps}`);

      if (fps < 30) {
        console.warn('Low frame rate detected. Consider optimizations.');
      }

      this.frames = 0;
      this.lastTime = currentTime;
    }
  }
}
```

## Best Practices Summary

1. **Load Only What You Need**: Use lazy loading and progressive loading
2. **Simplify for Distance**: Implement LOD system for distant models
3. **Reuse Geometry**: Use instancing for repeated assets
4. **Compress Textures**: Use WebP for web delivery
5. **Cache Wisely**: Cache animations and frequently used assets
6. **Monitor Performance**: Track FPS, memory, and load times
7. **Clean Up**: Dispose unused assets promptly
8. **Use IndexedDB Indexes**: Query by indexed fields for speed
9. **Paginate Large Data**: Load large datasets in pages
10. **Sample Animations**: Reduce keyframes for distant/less important animations

## Optimization Checklist

- [ ] Progressive loading implemented
- [ ] LOD system active for models
- [ ] Texture compression enabled
- [ ] Instancing used for repeated assets
- [ ] Database queries use indexed fields
- [ ] Pagination for large datasets
- [ ] Asset disposal on unload
- [ ] Animation caching implemented
- [ ] Performance monitoring active
- [ ] Regular cleanup of old data
