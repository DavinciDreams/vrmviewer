# VRM → GLTF/GLB Pivot Plan

## Executive Summary

Transition the VRM Viewer from a VRM-centric application to a universal 3D model viewer that prioritizes GLTF/GLB formats while supporting all major 3D formats including VRM, FBX, BVH, MMD, VRoid, and more.

**Goal**: Enable rigging, animation, and management of ANY 3D asset - humanoids, animals, creatures, props, environments - not just VRM humanoids.

## Business Rationale

**Current Limitations:**
- VRM format is humanoid-specific (VRoid standard)
- Cannot rig animals, creatures, or non-humanoid characters
- Limited export options (only VRM/VRMA)
- Not suitable for general 3D asset management
- Excludes users working with other formats

**Target Capabilities:**
- Support all 3D formats: GLB, GLTF, VRM, FBX, BVH, MMD, VRoid, PMX, etc.
- Rig and animate any skeleton type (quadrupeds, birds, creatures, props)
- Universal export to all supported formats
- Drag-and-drop import for all formats
- Format-agnostic UI and workflow
- Performance optimized for diverse assets

## Implementation Phases

### Phase 1: Analysis & Design (Tasks 11-12)
**Duration**: 1-2 weeks
- Inventory all VRM dependencies
- Design format-agnostic architecture
- Create migration strategy
- Define new interfaces and APIs

**Deliverables**:
- Dependency analysis report
- Architecture design document
- Migration guide for existing users

### Phase 2: Core Infrastructure (Tasks 13-17)
**Duration**: 3-4 weeks

#### 2.1 Model Loading System
- Implement GLTF/GLB as default loaders
- Create format-agnostic model interface
- Support all formats: GLB, GLTF, VRM, FBX, BVH, MMD, VRoid, PMX
- Universal drag-and-drop for all formats
- Multi-file handling (GLTF + bin + textures)

#### 2.2 Animation System
- Generic skeleton system (any bone structure)
- Auto-detect skeleton type (humanoid, quadruped, custom)
- Load and playback animations from all formats (BVH, VRMA, FBX, GLTF animations)
- Morph target system (replaces blend shapes)
- **Note**: Animation retargeting between different skeleton types is handled by a separate "mesh 2 motion" repository - this viewer focuses on loading and playing back animations

#### 2.3 Export System
- Export to ALL supported formats:
  - **Models**: GLB, GLTF, VRM, FBX
  - **Animations**: BVH, VRMA, FBX animations
- Batch export (multiple formats at once)
- Format-specific quality settings
- Performance-optimized export queue

#### 2.4 Database Schema
- Support diverse asset types (character, creature, prop, vehicle, etc.)
- Skeleton metadata storage
- Format capability tracking
- Migration from schema v2 → v3
- Backward compatibility maintained

**Deliverables**:
- Working GLTF/GLB loader
- Universal import/export system
- Updated database with migration
- All formats supported via drag-and-drop

### Phase 3: Enhanced Features (Tasks 18, 21)
**Duration**: 2-3 weeks

#### 3.1 Rigging Presets
- Animal presets: dog, horse, cat, cow, bird, dragon, fish, insect
- Prop presets: vehicle, mechanical, simple prop
- Auto-bone detection
- Rig quality validator
- Preset browser UI

#### 3.2 Performance Optimization
- Progressive loading for large files
- LOD (Level of Detail) system
- Memory management
- Mobile device optimization
- Performance profiler

**Deliverables**:
- 10+ rigging presets
- 50%+ performance improvement on large assets
- Works on mobile devices

### Phase 4: UI & Polish (Task 19)
**Duration**: 1-2 weeks
- Remove VRM-centric branding
- Format-agnostic UI
- Format badges for all types
- Asset type categorization
- Improved UX for diverse assets

**Deliverables**:
- Rebranded UI
- Better user experience for all formats
- Accessibility improvements

### Phase 5: Testing & Documentation (Tasks 20, 22-23)
**Duration**: 2-3 weeks

#### 5.1 Testing
- Test all supported formats
- Test diverse asset types
- Performance benchmarking
- Edge case coverage
- Mobile testing

#### 5.2 Documentation
- Migration guide for existing users
- User guide for new workflow
- Developer guide
- API documentation
- Examples and tutorials

**Deliverables**:
- Comprehensive test suite
- Complete documentation
- Video tutorials (optional)

## Technical Specifications

### Supported Formats (Import & Export)

**Model Formats:**
- GLB (binary glTF) - **PRIMARY FORMAT**
- GLTF (JSON-based glTF)
- VRM (VRoid Model 0.x, 1.0)
- FBX (Autodesk)
- PMX (MikuMikuDance)
- OBJ (geometry only)
- VRoid Studio format

**Animation Formats:**
- BVH (motion capture)
- VRMA (VRoid Animation)
- FBX animations
- GLTF animations (embedded)
- MMD animations (VMD)

### Format Capabilities Matrix

| Format | Models | Animations | Skeleton | Morph Targets | Metadata |
|--------|--------|------------|----------|---------------|----------|
| GLB    | ✅     | ✅         | ✅       | ✅            | ✅       |
| GLTF   | ✅     | ✅         | ✅       | ✅            | ✅       |
| VRM    | ✅     | ✅         | ✅       | ✅            | ✅       |
| FBX    | ✅     | ✅         | ✅       | ✅            | ✅       |
| BVH    | ❌     | ✅         | ✅       | ❌            | ⚠️       |
| PMX    | ✅     | ✅         | ✅       | ✅            | ✅       |
| OBJ    | ✅     | ❌         | ❌       | ❌            | ❌       |

### Architecture Changes

**Before (VRM-centric):**
```
User → Drag VRM → VRMLoader → VRMViewer → VRM-specific features
```

**After (Universal):**
```
User → Drag Any File → FormatDetector → AppropriateLoader → ModelViewer → Universal Features
                              ↓
                         (GLB/GLTF default)
```

### New Component Hierarchy

```
ModelViewer (format-agnostic)
├── ModelLoader (auto-detects format)
│   ├── GLTFLoader (default)
│   ├── GLBLoader (default)
│   ├── VRMLoader (for .vrm)
│   ├── FBXLoader
│   ├── PMXLoader
│   └── Other loaders...
├── SkeletonAnalyzer (auto-detect skeleton type)
├── AnimationMapper (retarget animations)
├── MorphTargetManager (replaces blend shapes)
└── ExportManager (export to any format)
```

### Database Schema Changes

**Schema v2 (Current):**
```typescript
ModelRecord {
  format: 'vrm' | 'gltf' | 'glb' | 'fbx'
  version: '0.0' | '1.0' // VRM-specific
  // ... VRM-centric metadata
}
```

**Schema v3 (New):**
```typescript
ModelRecord {
  format: 'glb' | 'gltf' | 'vrm' | 'fbx' | 'pmx' | 'obj'
  assetType: 'character' | 'creature' | 'prop' | 'vehicle' | 'environment' | 'effect'
  skeleton: {
    type: 'humanoid' | 'quadruped' | 'biped' | 'avian' | 'fish' | 'custom' | 'none'
    boneCount: number
    hasMorphTargets: boolean
  }
  capabilities: {
    supportsAnimations: boolean
    supportsMorphTargets: boolean
    supportsMaterials: boolean
  }
}
```

## Backward Compatibility

**Guarantees:**
- ✅ Existing VRM models continue to work
- ✅ No data loss for current users
- ✅ VRM export remains available
- ✅ Database auto-migrates
- ✅ Existing features preserved

**Migration Path:**
1. User updates to new version
2. Database auto-migrates (v2 → v3)
3. Existing VRM models tagged as `assetType: 'character'`
4. All features continue working
5. New features become available

## Performance Targets

**Loading Performance:**
- GLB file (50MB): <2 seconds
- GLTF with textures (100MB): <3 seconds
- Complex FBX (200MB): <5 seconds
- Initial render: <1 second

**Runtime Performance:**
- 60 FPS on desktop (single model)
- 30 FPS on mobile (single model)
- Support for 10,000+ bones
- Support for 50+ morph targets
- Memory: <500MB for typical scene

## Success Criteria

**Phase 1 Complete:**
- [x] Architecture designed
- [x] Dependencies analyzed
- [x] Migration strategy defined

**Phase 2 Complete:**
- [ ] GLTF/GLB load successfully
- [ ] All formats import via drag-and-drop
- [ ] Export to all formats works
- [ ] Database migrated to v3

**Phase 3 Complete:**
- [ ] 10+ rigging presets available
- [ ] Performance targets met
- [ ] Mobile devices supported

**Phase 4 Complete:**
- [ ] UI is format-agnostic
- [ ] VRM branding removed
- [ ] All asset types supported

**Phase 5 Complete:**
- [ ] Test suite passes
- [ ] Documentation complete
- [ ] Migration guide published

## Risks & Mitigations

**Risk 1: Breaking existing VRM workflows**
- Mitigation: Maintain VRM loader, ensure backward compatibility
- Testing: Extensive VRM model testing

**Risk 2: Performance degradation**
- Mitigation: Performance optimization phase, benchmarking
- Testing: Load testing with large files

**Risk 3: User confusion**
- Mitigation: Migration guide, clear communication
- Testing: User testing with existing users

**Risk 4: Format support bugs**
- Mitigation: Comprehensive test suite, edge case testing
- Testing: Test with diverse asset library

## Timeline

**Total Duration**: 9-14 weeks

**Milestones:**
- Week 2: Design complete
- Week 6: Core infrastructure working
- Week 9: Enhanced features complete
- Week 11: UI polished
- Week 14: Testing complete, documentation ready

**Dependencies:**
- Three.js ecosystem (loaders, exporters)
- Community feedback on formats
- Test asset acquisition

## Next Steps

1. Review and approve this plan
2. Begin Phase 1: Analysis & Design
3. Set up regular progress reviews
4. Gather test assets
5. Set up CI/CD for testing

---

**Document Version**: 1.0
**Last Updated**: 2025-01-25
**Status**: Draft for Review
