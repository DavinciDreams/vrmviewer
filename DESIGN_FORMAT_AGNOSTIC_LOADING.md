# Format-Agnostic Model Loading System - Design Document

**Date**: 2025-01-25
**Status**: Task #12 In Progress
**Purpose**: Design universal model loading system supporting all 3D formats

## 1. Overview

Design a format-agnostic model loading system that prioritizes GLTF/GLB while maintaining full support for VRM, FBX, BVH, PMX, and other formats.

### 1.1 Design Principles

1. **Format-Agnostic First**: GLB/GLTF are defaults, not special cases
2. **Progressive Enhancement**: Core features work for all formats
3. **Format-Specific Features**: Available when format supports them
4. **Backward Compatible**: Existing VRM workflow continues to work
5. **Extensible**: Easy to add new format support

### 1.2 Current State Assessment

**Strengths** (What we keep):
- ✅ LoaderManager already format-agnostic with switch statement
- ✅ All loaders already implemented (GLTF, FBX, BVH, VRMA, VRM)
- ✅ File type detection working
- ✅ Unified load result interface exists
- ✅ useVRM hook already handles non-VRM files

**Weaknesses** (What we fix):
- ❌ VRM types are primary (should be optional)
- ❌ VRM naming everywhere (should be generic)
- ❌ BlendShapeManager VRM-specific (needs morph target abstraction)
- ❌ No skeleton type detection
- ❌ No asset type categorization

---

## 2. Architecture Design

### 2.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                        Application Layer                     │
│  (App.tsx, Components - UI only, no format assumptions)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         Hook Layer                          │
│  useModel() - Format-agnostic hook for model operations    │
│  useAnimation() - Animation playback (any format)          │
│  useMorphTargets() - Morph target control (any format)     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        Store Layer                          │
│  modelStore - Model state (format-agnostic)                │
│  animationStore - Animation state                          │
│  morphTargetStore - Morph target state                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                          │
│  ModelService - CRUD operations for models                 │
│  AnimationService - CRUD operations for animations         │
│  ThumbnailService - Thumbnail generation                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Loader Manager Layer                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         LoaderManager (Orchestrator)                  │ │
│  │  - Detects format from file extension/content         │ │
│  │  - Routes to appropriate loader                       │ │
│  │  - Normalizes results to Model interface             │ │
│  │  - Handles progress tracking                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                          ↓                                 │
│  ┌──────────┬──────────┬──────────┬──────────┬─────────┐ │
│  │  GLB     │  GLTF    │   VRM    │   FBX    │   BVH   │ │
│  │ Loader   │  Loader  │  Loader  │  Loader  │  Loader │ │
│  │          │          │          │          │         │ │
│  │ Three.js │ Three.js │ @pixiv   │ Three.js │ Custom  │ │
│  │ Built-in│ Built-in │ three-vrm│ Built-in │ Parser  │ │
│  └──────────┴──────────┴──────────┴──────────┴─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User drops file → DropZone Component
     ↓
App.tsx: handleDrop()
     ↓
useModel.loadFromFile(file)
     ↓
modelStore.setLoading(true)
     ↓
LoaderManager.loadFromFile(file)
     ↓
Format detection (extension + magic bytes)
     ↓
Switch(format):
  - 'glb' → glbLoader.loadFromFile()
  - 'gltf' → gltfLoader.loadFromFile()
  - 'vrm' → vrmLoader.loadFromFile()
  - 'fbx' → fbxLoader.loadFromFile()
  - 'bvh' → bvhLoader.loadFromFile()
     ↓
Each loader returns LoaderResult<Model>
     ↓
LoaderManager normalizes to Model interface
     ↓
modelStore.setModel(model)
     ↓
ModelViewer component renders scene
     ↓
Conditional features:
  - if model.vrm → Show VRM controls
  - if model.morphTargets → Show morph target controls
  - if model.skeleton → Show skeleton controls
```

---

## 3. Core Interfaces

### 3.1 Universal Model Interface

Already created in `src/types/model.types.ts`:

```typescript
interface Model {
  scene: THREE.Group;
  format: ModelFormat;
  metadata: ModelMetadata;
  skeleton?: THREE.Skeleton;
  skeletonMetadata?: SkeletonMetadata;
  animations?: THREE.AnimationClip[];
  morphTargets?: Map<string, MorphTargetData[]>;
  vrm?: VRMType;  // Optional, only for VRM files
  fbx?: object;   // Optional, only for FBX files
  // ... other format-specific data
}
```

**Key Design Decisions**:
1. Core fields required for all formats
2. Format-specific fields optional
3. No VRM assumptions at top level
4. Type-safe access via guard functions

### 3.2 Format Detection

```typescript
interface FormatDetector {
  // Detect from file extension
  detectFromExtension(filename: string): ModelFormat | null;

  // Detect from file content (magic bytes)
  detectFromContent(arrayBuffer: ArrayBuffer): ModelFormat | null;

  // Validate format matches content
  validateFormat(filename: string, arrayBuffer: ArrayBuffer): boolean;
}
```

**Magic Bytes**:
- GLB: `glTF` (first 4 bytes)
- FBX: `Kaydara` (first 7 bytes)
- BVH: `HIERARCHY` (first line)
- VRM: GLB with VRM extension

### 3.3 Loader Interface

All loaders implement this interface:

```typescript
interface ModelLoader {
  // Load from file
  loadFromFile(file: File, options?: ModelLoadOptions): Promise<LoaderResult<Model>>;

  // Load from URL
  loadFromURL(url: string, options?: ModelLoadOptions): Promise<LoaderResult<Model>>;

  // Load from ArrayBuffer
  loadFromArrayBuffer(buffer: ArrayBuffer, options?: ModelLoadOptions): Promise<LoaderResult<Model>>;

  // Get supported formats
  getSupportedFormats(): ModelFormat[];

  // Clean up resources
  dispose(): void;
}
```

---

## 4. Enhanced Loader Manager

### 4.1 Current LoaderManager (Good Foundation)

**What Works**:
- ✅ Switch statement routes to correct loader
- ✅ Progress tracking
- ✅ Error handling
- ✅ Unified result interface

**What Needs Enhancement**:
1. Add PMX, MMD (VMD) loaders
2. Improve format detection
3. Add skeleton type detection
4. Add asset type detection
5. Better error messages per format
6. Format-specific optimization hints

### 4.2 Enhanced LoaderManager Design

```typescript
class EnhancedLoaderManager {
  private loaders: Map<ModelFormat, ModelLoader>;
  private detector: FormatDetector;
  private analyzer: ModelAnalyzer;

  async loadFromFile(file: File, options?: ModelLoadOptions): Promise<LoaderResult<Model>> {
    // 1. Detect format
    const format = await this.detectFormat(file);

    // 2. Get appropriate loader
    const loader = this.getLoader(format);

    // 3. Load the file
    const result = await loader.loadFromFile(file, {
      ...options,
      progressCallback: (progress) => this.trackProgress(progress, format)
    });

    // 4. Analyze loaded model
    if (result.success && result.data) {
      const analyzed = await this.analyzer.analyze(result.data);
      result.data = { ...result.data, ...analyzed };
    }

    // 5. Return normalized result
    return result;
  }

  private async detectFormat(file: File): Promise<ModelFormat> {
    // Try extension first
    const format = this.detector.detectFromExtension(file.name);
    if (format) return format;

    // Fall back to content detection
    const buffer = await file.arrayBuffer();
    const contentFormat = this.detector.detectFromContent(buffer);
    if (contentFormat) return contentFormat;

    throw new Error(`Unsupported file format: ${file.name}`);
  }
}
```

### 4.3 Model Analyzer

New component for analyzing loaded models:

```typescript
class ModelAnalyzer {
  async analyze(model: Model): Promise<Partial<Model>> {
    const analysis: Partial<Model> = {};

    // Detect skeleton type
    analysis.skeletonMetadata = this.detectSkeletonType(model);

    // Count geometry
    analysis.vertexCount = this.countVertices(model.scene);
    analysis.triangleCount = this.countTriangles(model.scene);
    analysis.meshCount = this.countMeshes(model.scene);

    // Extract morph targets
    analysis.morphTargets = this.extractMorphTargets(model);

    // Detect asset type
    analysis.metadata = {
      ...model.metadata,
      assetType: this.detectAssetType(model)
    };

    // Extract capabilities
    analysis.metadata.capabilities = this.detectCapabilities(model);

    return analysis;
  }

  private detectSkeletonType(model: Model): SkeletonMetadata {
    if (!model.skeleton) {
      return { type: SkeletonType.NONE, boneCount: 0, hasMorphTargets: false };
    }

    const bones = model.skeleton.bones;
    const boneCount = bones.length;

    // Detect by bone naming patterns
    if (this.hasHumanoidBones(bones)) {
      return {
        type: SkeletonType.HUMANOID,
        boneCount,
        hasMorphTargets: !!model.morphTargets?.size
      };
    }

    if (this.hasQuadrupedBones(bones)) {
      return {
        type: SkeletonType.QUADRUPED,
        boneCount,
        hasMorphTargets: !!model.morphTargets?.size,
        rigging: 'quadruped'
      };
    }

    // More detection patterns...

    return {
      type: SkeletonType.CUSTOM,
      boneCount,
      hasMorphTargets: !!model.morphTargets?.size
    };
  }

  private detectAssetType(model: Model): AssetType {
    // Use skeleton metadata as primary clue
    if (model.skeletonMetadata?.type === SkeletonType.HUMANOID) {
      return AssetType.CHARACTER;
    }

    if (model.skeletonMetadata?.type === SkeletonType.QUADRUPED) {
      return AssetType.CREATURE;
    }

    if (!model.skeleton) {
      // No skeleton, check mesh structure
      const meshCount = this.countMeshes(model.scene);
      if (meshCount === 1) {
        return AssetType.PROP;
      }
      if (meshCount > 10) {
        return AssetType.ENVIRONMENT;
      }
    }

    return AssetType.OTHER;
  }

  private hasHumanoidBones(bones: THREE.Bone[]): boolean {
    const boneNames = bones.map(b => b.name.toLowerCase());
    const requiredBones = ['hips', 'spine', 'head'];
    return requiredBones.every(name =>
      boneNames.some(boneName => boneName.includes(name))
    );
  }

  private hasQuadrupedBones(bones: THREE.Bone[]): boolean {
    const boneNames = bones.map(b => b.name.toLowerCase());
    const indicators = ['hind', 'front', 'tail', 'paw', 'hoof'];
    const matchCount = indicators.filter(indicator =>
      boneNames.some(boneName => boneName.includes(indicator))
    ).length;
    return matchCount >= 3;
  }
}
```

---

## 5. Hook Refactoring

### 5.1 Current useVRM → New useModel

**Current** (VRM-centric):
```typescript
// src/hooks/useVRM.ts
export function useVRM() {
  const { currentModel, isLoading, error, metadata } = useVRMStore();
  // VRM-specific logic
  return { currentModel, isLoading, loadModelFromFile };
}
```

**New** (Format-agnostic):
```typescript
// src/hooks/useModel.ts
export function useModel() {
  const {
    currentModel,
    isLoading,
    error,
    metadata,
    setModel,
    setLoading,
    setError
  } = useModelStore();

  const loadFromFile = useCallback(async (file: File): Promise<Model | null> => {
    setLoading(true);
    setError(null);

    try {
      // Use enhanced loader manager
      const result = await loaderManager.loadFromFile(file);

      if (result.success && result.data) {
        setModel(result.data);
        return result.data;
      } else {
        setError(result.error?.message || 'Failed to load model');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError]);

  return {
    currentModel,
    isLoading,
    error,
    metadata,
    loadFromFile,
    // Format helpers
    format: currentModel?.format,
    isVRM: currentModel?.format === 'vrm',
    hasSkeleton: !!currentModel?.skeleton,
    hasMorphTargets: !!currentModel?.morphTargets?.size,
  };
}
```

### 5.2 Backward Compatibility

```typescript
// src/hooks/useVRM.ts (deprecated alias)
import { useModel } from './useModel';

/**
 * @deprecated Use useModel instead
 */
export function useVRM() {
  return useModel();
}
```

---

## 6. Component Refactoring

### 6.1 VRMViewer → ModelViewer

**Current VRMViewer** (VRM assumptions):
```typescript
export function VRMViewer({ vrm }: { vrm: VRM }) {
  useEffect(() => {
    // VRM-specific initialization
    vrm.expressionManager.setValue('happy', 1.0);
  }, [vrm]);

  return <canvas ref={canvasRef} />;
}
```

**New ModelViewer** (Format-agnostic):
```typescript
export function ModelViewer({ model }: { model: Model }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!model) return;

    // Common setup for all formats
    scene.add(model.scene);

    // Format-specific setup
    if (model.format === 'vrm' && model.vrm) {
      // VRM-specific initialization
      setupVRM(model.vrm);
    }

    if (model.morphTargets) {
      // Morph targets work for any format
      setupMorphTargets(model.morphTargets);
    }

  }, [model]);

  return (
    <canvas ref={canvasRef}>
      {/* Conditional controls based on format */}
      {model.format === 'vrm' && <VRMControls vrm={model.vrm} />}
      {model.morphTargets && <MorphTargetControls targets={model.morphTargets} />}
      {model.skeleton && <SkeletonControls skeleton={model.skeleton} />}
    </canvas>
  );
}
```

---

## 7. New Loaders to Add

### 7.1 PMX Loader (MikuMikuDance)

```typescript
// src/core/three/loaders/PMXLoader.ts
export class PMXLoader implements ModelLoader {
  async loadFromFile(file: File): Promise<LoaderResult<Model>> {
    // Parse PMX format (binary)
    // Extract mesh, skeleton, morph targets
    // Convert to Model interface
  }

  getSupportedFormats(): ModelFormat[] {
    return ['pmx'];
  }
}
```

### 7.2 VMD Loader (MMD Animations)

```typescript
// src/core/three/loaders/VMDLoader.ts
export class VMDLoader implements AnimationLoader {
  async loadFromFile(file: File): Promise<LoaderResult<THREE.AnimationClip>> {
    // Parse VMD format
    // Convert to AnimationClip
  }
}
```

---

## 8. Migration Plan

### Phase 1: Type System (Week 1, Days 1-2)
- [x] Create `src/types/model.types.ts`
- [ ] Add backward compatibility aliases
- [ ] Update imports incrementally
- [ ] Run type checks

### Phase 2: Hooks (Week 1, Days 2-3)
- [ ] Create `src/hooks/useModel.ts`
- [ ] Add deprecated `useVRM` alias
- [ ] Update `App.tsx` to use `useModel`
- [ ] Test all formats still work

### Phase 3: Stores (Week 1, Day 4)
- [ ] Rename `vrmStore.ts` → `modelStore.ts`
- [ ] Update type references
- [ ] Add export alias
- [ ] Test state persistence

### Phase 4: Loaders (Week 1, Days 4-5)
- [ ] Enhance `LoaderManager`
- [ ] Add `ModelAnalyzer`
- [ ] Add skeleton type detection
- [ ] Add asset type detection

### Phase 5: Components (Week 2)
- [ ] Rename `VRMViewer` → `ModelViewer`
- [ ] Update all component imports
- [ ] Add conditional rendering
- [ ] Test with all formats

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('LoaderManager', () => {
  it('should route .glb files to GLBLoader', async () => {
    const file = createMockFile('model.glb', glbData);
    const result = await loaderManager.loadFromFile(file);
    expect(result.data?.format).toBe('glb');
  });

  it('should route .vrm files to VRMLoader', async () => {
    const file = createMockFile('model.vrm', vrmData);
    const result = await loaderManager.loadFromFile(file);
    expect(result.data?.format).toBe('vrm');
  });

  it('should detect format from content', async () => {
    const file = createMockFile('model.unknown', glbData);
    const result = await loaderManager.loadFromFile(file);
    expect(result.data?.format).toBe('glb'); // Detected from magic bytes
  });
});

describe('ModelAnalyzer', () => {
  it('should detect humanoid skeleton', () => {
    const model = createMockModel({ bones: ['hips', 'spine', 'head'] });
    const analysis = analyzer.analyze(model);
    expect(analysis.skeletonMetadata?.type).toBe(SkeletonType.HUMANOID);
  });

  it('should detect quadruped skeleton', () => {
    const model = createMockModel({ bones: ['hindLeg', 'frontLeg', 'tail'] });
    const analysis = analyzer.analyze(model);
    expect(analysis.skeletonMetadata?.type).toBe(SkeletonType.QUADRUPED);
  });
});
```

### 9.2 Integration Tests

```typescript
describe('Model Loading Flow', () => {
  it('should load GLB model from file', async () => {
    const { result } = renderHook(() => useModel());
    const file = createMockGLBFile();

    const model = await result.current.loadFromFile(file);

    expect(model?.format).toBe('glb');
    expect(model?.scene).toBeInstanceOf(THREE.Group);
    expect(result.current.isLoading).toBe(false);
  });

  it('should load VRM model with VRM-specific features', async () => {
    const { result } = renderHook(() => useModel());
    const file = createMockVRMFile();

    const model = await result.current.loadFromFile(file);

    expect(model?.format).toBe('vrm');
    expect(model?.vrm).toBeDefined();
    expect(result.current.isVRM).toBe(true);
  });
});
```

---

## 10. Performance Considerations

### 10.1 Loading Optimization

1. **Lazy Loader Loading**:
   ```typescript
   // Load VRM loader only when needed
   async getVRMLoader() {
     if (!this.vrmLoader) {
       const { VRMLoader } = await import('./VRMLoader');
       this.vrmLoader = new VRMLoader();
     }
     return this.vrmLoader;
   }
   ```

2. **Progressive Loading**:
   - Load geometry first
   - Load textures second
   - Load animations third
   - Show preview as soon as possible

3. **Worker Threads**:
   - Parsing large files in Web Workers
   - Main thread only handles rendering

### 10.2 Memory Management

```typescript
class ModelCache {
  private cache: Map<string, Model> = new Map();
  private maxSize: number = 5; // Max cached models

  set(key: string, model: Model): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest
      const first = this.cache.keys().next().value;
      this.disposeModel(this.cache.get(first)!);
      this.cache.delete(first);
    }
    this.cache.set(key, model);
  }

  private disposeModel(model: Model): void {
    model.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
```

---

## 11. Error Handling

### 11.1 Format-Specific Errors

```typescript
interface FormatErrorHandler {
  handleGLError: (error: Error) => LoaderError;
  handleVRMError: (error: Error) => LoaderError;
  handleFBXError: (error: Error) => LoaderError;
  // ... etc
}

class ErrorHandler implements FormatErrorHandler {
  handleGLError(error: Error): LoaderError {
    if (error.message.includes('draco')) {
      return {
        type: 'RESOURCE_MISSING',
        message: 'This model uses Draco compression. Draco decoder not loaded.',
        details: error,
        format: 'glb'
      };
    }
    // ... more specific errors
  }

  handleVRMError(error: Error): LoaderError {
    if (error.message.includes('VRM 0.0')) {
      return {
        type: 'VERSION_UNSUPPORTED',
        message: 'VRM 0.0 detected. VRM 1.0 is recommended.',
        details: error,
        format: 'vrm'
      };
    }
    // ... more specific errors
  }
}
```

### 11.2 User-Friendly Messages

```typescript
const ERROR_MESSAGES = {
  'FILE_NOT_FOUND': (filename: string) =>
    `File "${filename}" not found. Please check the file path.`,

  'PARSE_ERROR': (format: string) =>
    `Failed to parse ${format.toUpperCase()} file. The file may be corrupted.`,

  'VERSION_UNSUPPORTED': (format: string) =>
    `This ${format.toUpperCase()} file uses an unsupported version.`,

  'RESOURCE_MISSING': (resource: string) =>
    `Missing resource: ${resource}. Some materials may not display correctly.`,
};
```

---

## 12. Next Steps

1. **Implement** ModelAnalyzer skeleton detection
2. **Create** format capability matrix
3. **Add** PMX loader
4. **Enhance** error handling
5. **Write** unit tests for LoaderManager
6. **Create** integration tests for loading flow

---

**Document Status**: ✅ Complete
**Next Task**: #13 - Implement GLTF/GLB as default loaders
**Last Updated**: 2025-01-25
