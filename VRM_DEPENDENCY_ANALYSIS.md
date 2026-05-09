# VRM Dependency Analysis & Pivot Strategy

**Date**: 2025-01-25
**Status**: Task #11 In Progress
**Purpose**: Comprehensive inventory of VRM-specific code and pivot strategy

## Executive Summary

The codebase has **significant VRM coupling** but also has a **solid foundation** for multi-format support. The pivot to GLTF/GLB-first architecture is feasible but requires careful refactoring of 17 VRM-specific files.

**Key Finding**: `useVRM` hook and `LoaderManager` already have format-agnostic logic - we're closer to universal support than initially expected!

---

## 1. Package Dependencies

### VRM-Specific Packages
```json
{
  "@pixiv/three-vrm": "^2.1.0",
  "@pixiv/three-vrm-animation": "^2.1.0"
}
```

**Impact**: These will remain as optional dependencies for VRM file support. Not removed, just demoted from primary to optional.

### Non-VRM Dependencies Already Present
- `three: ^0.164.1` - Core 3D engine
- GLTFLoader (from three/examples)
- FBXLoader (already implemented)
- BVHLoader (already implemented)
- VRMALoader (already implemented)

**Good News**: We already have loaders for all major formats!

---

## 2. VRM-Specific Files Inventory

### 2.1 Core VRM Files (High Priority Refactoring)

| File | Lines | VRM Dependencies | Refactoring Priority |
|------|-------|-----------------|---------------------|
| `src/hooks/useVRM.ts` | 230 | VRMModel type, vrmLoader | **CRITICAL** - Rename to `useModel.ts` |
| `src/types/vrm.types.ts` | 348 | ALL VRM types | **CRITICAL** - Extract generic types |
| `src/store/vrmStore.ts` | 85 | VRMModel state | **HIGH** - Rename to `modelStore.ts` |
| `src/components/viewer/VRMViewer.tsx` | ~400 | VRM rendering, blend shapes | **HIGH** - Rename to `ModelViewer.tsx` |

### 2.2 VRM Loaders & Helpers (Medium Priority)

| File | Purpose | Strategy |
|------|---------|----------|
| `src/core/three/loaders/VRMLoader.ts` | 434 lines - VRM loading | Keep as-is, make optional |
| `src/core/three/loaders/VRMALoader.ts` | VRMA animation loading | Keep as-is, make optional |
| `src/core/three/vrm/VRMHelper.ts` | VRM utilities | Keep for VRM support |
| `src/core/three/loaders/LoaderManager.ts` | 484 lines - Unified loading | **ENHANCE** - Already format-agnostic! |

### 2.3 Animation & Blend Shapes (High Complexity)

| File | Purpose | Refactoring Needed |
|------|---------|-------------------|
| `src/core/three/animation/BlendShapeManager.ts` | 299 lines - VRM expressions | **REFACTOR** - Support generic morph targets |
| `src/core/three/animation/IdleAnimationController.ts` | VRM idle animations | Make format-agnostic |
| `src/hooks/useBlendShapes.ts` | VRM blend shapes hook | Rename to `useMorphTargets.ts` |
| `src/constants/blendShapes.ts` | VRM expression presets | Keep for VRM, add generic morph targets |

### 2.4 Export System (Already Multi-Format)

| File | Purpose | Status |
|------|---------|--------|
| `src/core/three/export/VRMExporter.ts` | VRM export | Keep for VRM format |
| `src/core/three/export/VRMAExporter.ts` | VRMA export | Keep for VRMA format |
| `src/hooks/useExport.ts` | Export hook | Already supports multiple formats |
| `src/store/exportStore.ts` | Export state | Format-agnostic |

### 2.5 UI Components (Branding Changes)

| File | Purpose | Change Needed |
|------|---------|---------------|
| `src/components/layout/Header.tsx` | App header | Remove VRM branding |
| `src/components/dragdrop/DropZone.tsx` | File drop UI | Show all formats equally |
| `src/components/dragdrop/FilePreview.tsx` | File preview | Format-agnostic |

### 2.6 Utilities & Constants (Low Priority)

| File | Purpose | Strategy |
|------|---------|----------|
| `src/utils/animationUtils.ts` | Animation utilities | Already format-agnostic |
| `src/constants/boneNames.ts` | VRM bone names | Keep for VRM humanoid detection |
| `src/constants/formats.ts` | File format detection | Already supports all formats! |

---

## 3. Current Architecture Assessment

### 3.1 What Works Well ✅

1. **LoaderManager** (`src/core/three/loaders/LoaderManager.ts`):
   - **Already format-agnostic** with switch statement for all formats
   - Supports: VRM, GLTF, GLB, FBX, BVH, VRMA
   - Provides unified `UnifiedLoadResult` interface
   - Excellent foundation - just needs enhancement

2. **Format Detection** (`src/constants/formats.ts`):
   - Already handles all major formats
   - File type validation working
   - No changes needed!

3. **Export System**:
   - Already supports VRM, VRMA export
   - Ready to add GLB, GLTF, FBX export
   - Format options already configurable

4. **Database Schema**:
   - ModelRecord already has `format` field
   - Supports 'vrm' | 'gltf' | 'glb' | 'fbx'
   - Just needs asset type field addition

### 3.2 What Needs Refactoring ⚠️

1. **VRMModel Type** (CRITICAL):
   ```typescript
   // Current: VRM-specific
   interface VRMModel {
     vrm: VRMType;              // VRM-specific
     humanoid: VRMHumanoid;      // VRM-specific
     expressions: Map<string, unknown>; // VRM-specific
     firstPerson: unknown;       // VRM-specific
     scene: THREE.Group;
     skeleton: THREE.Skeleton;
   }

   // Target: Format-agnostic
   interface Model {
     scene: THREE.Group;
     format: ModelFormat;
     skeleton?: THREE.Skeleton;
     metadata: ModelMetadata;
     // Optional VRM-specific fields
     vrm?: VRMType;
     humanoid?: VRMHumanoid;
     expressions?: Map<string, unknown>;
   }
   ```

2. **useVRM Hook** (CRITICAL):
   - Already handles non-VRM files (creates "VRM-like" structures)
   - Just needs renaming and type cleanup
   - Logic is 80% there!

3. **BlendShapeManager** (HIGH):
   - Tightly coupled to VRM expression system
   - Needs to support generic morph targets
   - VRM expressions become one "profile"

4. **VRMViewer Component** (HIGH):
   - Needs renaming to `ModelViewer`
   - Remove VRM assumptions
   - Make VRM features conditional

### 3.3 What's Already Great 🎉

1. **Non-VRM loaders exist and work**:
   - `GLTFLoader.ts` - Functional
   - `FBXLoader.ts` - Functional with morph target support
   - `BVHLoader.ts` - Functional
   - `VRMALoader.ts` - Functional

2. **Multi-format support partially implemented**:
   - LoaderManager routes to correct loader
   - File type detection works
   - Database stores all formats

3. **Code organization is clean**:
   - Clear separation of concerns
   - Services, stores, hooks properly separated
   - Easy to extend

---

## 4. Breaking Changes & Migration Strategy

### 4.1 Breaking Changes for Existing Code

| Change | Impact | Migration Path |
|--------|--------|----------------|
| `useVRM` → `useModel` | All hooks imported | Simple find-rename |
| `VRMModel` → `Model` | Type definitions | Type alias transition |
| `VRMViewer` → `ModelViewer` | Component import | Simple rename |
| `vrmStore` → `modelStore` | Store imports | Simple rename |
| BlendShape API changes | Expression system | Add generic wrapper |
| VRM-specific features | Optional fields | Conditional rendering |

### 4.2 Backward Compatibility Strategy

**Phase 1**: Add type aliases (no breaking changes)
```typescript
// Backward compatibility
export type VRMModel = Model;
export const useVRM = useModel;
export const VRMViewer = ModelViewer;
```

**Phase 2**: Deprecation warnings
```typescript
/**
 * @deprecated Use useModel instead
 */
export const useVRM = useModel;
```

**Phase 3**: Remove deprecated code (major version bump)

---

## 5. Refactoring Priority Matrix

### High Priority, High Impact (Do First)

1. ✅ **Create generic Model type** (Week 1, Days 1-2)
   - Extract from VRMModel
   - Make VRM fields optional
   - Add format field

2. ✅ **Rename useVRM → useModel** (Week 1, Days 2-3)
   - Already 80% format-agnostic
   - Just needs cleanup
   - Add type safety

3. ✅ **Enhance LoaderManager** (Week 1, Days 3-4)
   - Already excellent foundation
   - Add PMX, MMD support
   - Improve error handling

### High Priority, Medium Impact (Do Second)

4. ✅ **Create MorphTargetManager** (Week 1, Days 4-5)
   - Refactor BlendShapeManager
   - Support generic morph targets
   - VRM as one profile

5. ✅ **Rename VRMViewer → ModelViewer** (Week 2, Days 1-2)
   - Remove VRM assumptions
   - Make VRM features conditional
   - Update all imports

6. ✅ **Rename vrmStore → modelStore** (Week 2, Days 2-3)
   - Simple rename
   - Update all references

### Medium Priority (Do Later)

7. Add GLB/GLTF exporters (Week 2-3)
8. Add FBX exporter (Week 3)
9. Update UI branding (Week 3)
10. Add rigging presets (Week 4-5)

---

## 6. File-by-File Refactoring Plan

### Phase 1: Core Types (1-2 days)

**File**: `src/types/vrm.types.ts` → `src/types/model.types.ts`

Actions:
1. Create new `Model` interface (format-agnostic)
2. Keep `VRMModel` as subtype
3. Add `ModelFormat` union type
4. Add `SkeletonType` enum
5. Create `ModelMetadata` (generic)
6. Type alias for backward compatibility

```typescript
// New generic type
export interface Model {
  scene: THREE.Group;
  format: ModelFormat;
  metadata: ModelMetadata;
  skeleton?: THREE.Skeleton;
  animations?: THREE.AnimationClip[];
  morphTargets?: Map<string, THREE.MorphTarget[]>;
  // Optional VRM-specific
  vrm?: VRMType;
  humanoid?: VRMHumanoid;
  expressions?: Map<string, unknown>;
}

// Backward compatibility
export type VRMModel = Model;
```

### Phase 2: Hook Refactoring (2-3 days)

**File**: `src/hooks/useVRM.ts` → `src/hooks/useModel.ts`

Actions:
1. Rename file
2. Update all type references
3. Remove VRM assumptions
4. Keep existing logic (already handles non-VRM)
5. Add format detection
6. Export as `useModel` with `useVRM` alias

### Phase 3: Store Refactoring (1 day)

**File**: `src/store/vrmStore.ts` → `src/store/modelStore.ts`

Actions:
1. Rename file
2. Update type from `VRMModel` to `Model`
3. Update store name in devtools
4. Add export alias

### Phase 4: Component Refactoring (2-3 days)

**File**: `src/components/viewer/VRMViewer.tsx` → `src/components/viewer/ModelViewer.tsx`

Actions:
1. Rename component
2. Add format detection logic
3. Conditional VRM features:
   ```typescript
   {isVRM && <BlendShapeControls />}
   {hasMorphTargets && <MorphTargetControls />}
   ```
4. Update props interface
5. Remove VRM branding

### Phase 5: Manager Refactoring (3-4 days)

**File**: `src/core/three/animation/BlendShapeManager.ts`

Actions:
1. Rename to `MorphTargetManager.ts`
2. Extract generic morph target logic
3. Create VRM profile:
   ```typescript
   const VRM_PROFILE = {
     getMorphTargets: (vrm: VRM) => { /* ... */ },
     setMorphTarget: (vrm: VRM, name, value) => { /* ... */ }
   };
   ```
4. Support multiple profiles (VRM, FBX, generic)

---

## 7. Testing Strategy

### Unit Tests Needed

1. **Type System Tests**:
   - Verify Model type works for all formats
   - Test VRMModel backward compatibility
   - Test format detection

2. **Loader Tests**:
   - Test each loader independently
   - Test LoaderManager routing
   - Test error handling

3. **Hook Tests**:
   - Test useModel with each format
   - Test state management
   - Test error cases

### Integration Tests Needed

1. **File Loading**:
   - Load each format via drag-drop
   - Verify correct loader used
   - Verify model displays correctly

2. **Animation Playback**:
   - Test animation on different skeleton types
   - Test retargeting (when implemented)

3. **Export**:
   - Export to each format
   - Verify exported files are valid

### Test Assets Needed

- [ ] VRM 0.x model (humanoid)
- [ ] VRM 1.0 model (humanoid)
- [ ] GLB model (humanoid)
- [ ] GLB model (quadruped)
- [ ] GLTF with external textures
- [ ] FBX model (with morph targets)
- [ ] FBX model (without skeleton)
- [ ] BVH animation
- [ ] VRMA animation

---

## 8. Risk Assessment

### High Risk Areas

1. **VRM Expression System**:
   - Risk: Breaking existing VRM blend shapes
   - Mitigation: Comprehensive VRM testing
   - Rollback: Keep BlendShapeManager for VRM

2. **Type System Changes**:
   - Risk: TypeScript errors cascade
   - Mitigation: Incremental type changes, use aliases
   - Rollback: Revert type definitions

3. **Database Migration**:
   - Risk: Existing user data inaccessible
   - Mitigation: Schema v3 with backward compatibility
   - Rollback: Keep v2 schema support

### Medium Risk Areas

1. **Component Renaming**:
   - Risk: Import paths break
   - Mitigation: Export aliases, gradual migration
   - Rollback: Simple git revert

2. **Hook Refactoring**:
   - Risk: State management breaks
   - Mitigation: Keep existing logic, just rename
   - Rollback: Simple file revert

### Low Risk Areas

1. **Loader Enhancements**:
   - Risk: New loaders have bugs
   - Mitigation: Isolated loader testing
   - Rollback: Remove new loaders

2. **UI Branding Changes**:
   - Risk: User confusion
   - Mitigation: Clear communication
   - Rollback: Revert UI changes

---

## 9. Success Criteria

### Phase 1 Complete (Week 1)
- [x] Generic `Model` type created
- [ ] `useModel` hook working (with `useVRM` alias)
- [ ] All existing tests passing
- [ ] No TypeScript errors
- [ ] VRM models still load correctly

### Phase 2 Complete (Week 2)
- [ ] GLB/GLTF models load and display
- [ ] FBX models load and display
- [ ] All formats show in library
- [ ] Format badges working
- [ ] Morph targets working for non-VRM

### Phase 3 Complete (Week 3-4)
- [ ] Retargeting system functional
- [ ] Export to all formats working
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Phase 4 Complete (Week 5-6)
- [ ] Rigging presets available
- [ ] UI rebranded
- [ ] Migration guide published
- [ ] User testing complete

---

## 10. Next Steps

### Immediate (This Week)

1. **Create branch**: `feature/universal-model-support`
2. **Start refactoring**: Begin with Phase 1 (types)
3. **Set up testing**: Get test assets ready
4. **Document progress**: Update this document daily

### This Sprint

1. Complete Phase 1: Core Types
2. Complete Phase 2: Hook Refactoring
3. Complete Phase 3: Store Refactoring
4. Begin Phase 4: Component Refactoring

### Next Sprint

1. Complete Phase 4: Component Refactoring
2. Implement retargeting system
3. Add GLB/GLTF exporters
4. Start UI rebranding

---

## 11. Code Examples

### Before: VRM-Centric

```typescript
// Current
import { useVRM } from '@/hooks/useVRM';
import { VRMModel } from '@/types/vrm.types';

function MyComponent() {
  const { currentModel, loadFromFile } = useVRM();
  // Only works well with VRM
}
```

### After: Format-Agnostic

```typescript
// New
import { useModel } from '@/hooks/useModel';
import { Model, ModelFormat } from '@/types/model.types';

function MyComponent() {
  const { currentModel, loadFromFile } = useModel();
  // Works with VRM, GLB, GLTF, FBX, etc.

  const format = currentModel?.format; // 'vrm' | 'glb' | 'gltf' | 'fbx'

  // Conditional features
  if (format === 'vrm' && currentModel.vrm) {
    // VRM-specific features
    currentModel.vrm.expressionManager.setValue('happy', 1.0);
  }

  if (currentModel.morphTargets) {
    // Generic morph targets (any format)
    // Apply morph target...
  }
}
```

---

## 12. Conclusion

The codebase is **surprisingly well-positioned** for this pivot. Key findings:

1. ✅ **Multi-format loaders already exist** - not starting from scratch
2. ✅ **LoaderManager is format-agnostic** - excellent foundation
3. ✅ **useVRM already handles non-VRM** - just needs renaming
4. ⚠️ **VRM types need refactoring** - but can use aliases
5. ⚠️ **BlendShapeManager needs work** - extract generic logic
6. ✅ **Database schema flexible** - just add fields

**Estimated Effort**: 4-6 weeks for full pivot (less than expected!)

**Risk Level**: Medium (good foundation, incremental changes possible)

**Recommendation**: Proceed with pivot as planned. Start with Phase 1 (types) and work through phases incrementally.

---

**Document Status**: ✅ Complete
**Next Task**: #12 - Design format-agnostic model loading system
**Last Updated**: 2025-01-25
