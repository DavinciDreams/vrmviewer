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
**Duration**: 5-6 weeks (increased due to retargeting complexity)

#### 2.1 Model Loading System
- Implement GLTF/GLB as default loaders
- Create format-agnostic model interface
- Support all formats: GLB, GLTF, VRM, FBX, BVH, MMD, VRoid, PMX
- Universal drag-and-drop for all formats
- Multi-file handling (GLTF + bin + textures)

#### 2.2 Animation & Retargeting System
- Generic skeleton system (any bone structure)
- Auto-detect skeleton type (humanoid, quadruped, custom)
- **UNIVERSAL ANIMATION RETARGETING** (Core Feature):
  - Convert animations between ANY skeleton types
  - Humanoid ↔ Quadruped ↔ Biped ↔ Custom
  - Auto-bone mapping with heuristics
  - Manual mapping editor with visual feedback
  - Preserve motion quality and personality
  - IK solver for foot placement (optional)
  - Save mapping presets for reuse
  - **Critical for non-humanoid assets**
- Morph target system (replaces blend shapes)
- Support all animation formats: BVH, VRMA, FBX animations, GLTF animations
- **Note**: External mesh2motion solutions are inadequate, so we're building robust retargeting directly into the viewer

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
├── AnimationRetargeter (UNIVERSAL RETARGETING)
│   ├── AutoBoneMapper (heuristic-based mapping)
│   ├── ManualMappingEditor (visual UI)
│   ├── ForwardKinematicsRetargeter
│   ├── InverseKinematicsRetargeter
│   ├── IKSolver (foot placement, etc.)
│   └── MappingPresets (reusable mappings)
├── MorphTargetManager (replaces blend shapes)
└── ExportManager (export to any format)
```

### Animation Retargeting System

**Why Build It?**
- External solutions (mesh2motion) are inadequate
- Critical for non-humanoid assets (animals, creatures)
- Enables vast animation libraries for any model
- Unique competitive advantage

**Supported Retargeting:**
```
Humanoid animation + Dog model → Walking dog
Horse run + Cat skeleton → Running cat
BVH mocap + Dragon rig → Flying dragon
Human dance + Quadruped → Creative motion
```

**Retargeting Methods:**
1. **Forward Kinematics (FK)**:
   - Preserve joint rotations
   - Good for similar skeletons
   - Fast computation
   - May have foot sliding

2. **Inverse Kinematics (IK)**:
   - Preserve end effector positions
   - Better for different skeletons
   - Prevents foot sliding
   - Computationally expensive

3. **Hybrid Approach**:
   - FK for spine/upper body
   - IK for legs/arms (end effectors)
   - Best of both worlds
   - Default method

**Bone Mapping Strategies:**
1. **Name-Based**: Match standard names (Hips → mixamorigHips)
2. **Position-Based**: Match by relative 3D positions
3. **Semantic**: AI learns bone correspondences
4. **Manual**: User creates visual mappings
5. **Preset**: Pre-made mappings for common types

**Quality Metrics:**
- Motion preservation (style, personality)
- Foot placement accuracy
- Smoothness (no jitter)
- Natural motion (no artifacts)

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
- [ ] **Animation retargeting works between skeleton types**
  - [ ] Humanoid → Quadruped (walk cycle)
  - [ ] Quadruped → Humanoid
  - [ ] Between different quadrupeds
  - [ ] Manual mapping editor functional
  - [ ] Auto-mapping success rate >70%

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

**Total Duration**: 11-16 weeks (increased due to animation retargeting complexity)

**Milestones:**
- Week 2: Design complete
- Week 8: Core infrastructure working (including retargeting)
- Week 11: Enhanced features complete
- Week 13: UI polished
- Week 16: Testing complete, documentation ready

**Critical Path**: Animation Retargeting System (2.5-3 weeks)
- This is the most complex and high-value feature
- Requires careful algorithm design and testing
- May require R&D time for bone mapping heuristics
- Success depends on quality of retargeting results

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
