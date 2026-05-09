# Migration Guide: VRM-Centric to Universal Format Support

## Overview

This guide helps you migrate your codebase from VRM-centric model handling to universal 3D format support. The migration enables support for GLB, GLTF, FBX, BVH, PMX, OBJ, VMD, and VRMA formats in addition to VRM.

## What Changed

### Database Schema (Version 3)

**New Fields:**
- `assetType`: Categorizes models as character, creature, prop, vehicle, environment, effect, or other
- `skeletonType`: Identifies skeleton as humanoid, quadruped, biped, avian, fish, custom, or none
- `skeletonMetadata`: Bone count and structure information for retargeting
- Extended `format` field: Now supports all model/animation formats

**Breaking Changes:**
None! All changes are backward compatible.

## Migration Steps

### Step 1: Update Database Types

No action required - types are automatically extended.

**Old code still works:**
```typescript
const model: ModelRecord = {
  format: 'vrm',
  // ... other fields
};
```

**New code supports more formats:**
```typescript
const model: ModelRecord = {
  format: 'glb',  // NEW: GLB format support
  assetType: AssetType.CHARACTER,  // NEW: Asset categorization
  skeletonMetadata: {
    type: SkeletonType.HUMANOID,
    boneCount: 55,
  },
  // ... other fields
};
```

### Step 2: Update Service Layer

Services automatically use the new extended schema. No code changes required for basic functionality.

**Optional: Use new query filters:**
```typescript
// NEW: Filter by asset type
const characters = await modelService.query({
  assetType: AssetType.CHARACTER
});

// NEW: Filter by skeleton type
const bipeds = await modelService.query({
  skeletonType: SkeletonType.BIPED
});

// NEW: Filter by specific format
const fbxModels = await modelService.query({
  format: 'fbx'
});
```

### Step 3: Update Components (Optional)

Components that assume VRM-only can now handle any format:

**Before (VRM-centric):**
```typescript
const { currentModel } = useVRM();
if (currentModel?.vrm) {
  // Handle VRM model
}
```

**After (Format-agnostic):**
```typescript
const { currentModel, format, assetType } = useModel();
if (currentModel) {
  // Handle any format
  switch (format) {
    case 'vrm':
      // VRM-specific handling
      break;
    case 'glb':
    case 'gltf':
      // GLTF-specific handling
      break;
    case 'fbx':
      // FBX-specific handling
      break;
  }
}

// NEW: Asset-type-aware handling
switch (assetType) {
  case AssetType.CHARACTER:
    // Character-specific features
    break;
  case AssetType.CREATURE:
    // Creature-specific features (IK, rigging, etc.)
    break;
}
```

### Step 4: Add Asset Type Detection (Optional)

Models can be automatically categorized when saved:

```typescript
import { AssetType } from '@/core/database/schemas/databaseSchema';

async function saveModelWithAssetType(file: File, data: ArrayBuffer) {
  const format = detectFormat(file.name);
  let assetType = AssetType.OTHER;

  // Auto-detect asset type based on format and metadata
  if (format === 'vrm') {
    assetType = AssetType.CHARACTER;  // VRM is typically humanoid
  } else if (format === 'glb' || format === 'gltf') {
    // Analyze model metadata for asset type
    const metadata = await extractMetadata(data);
    assetType = detectAssetTypeFromMetadata(metadata);
  }

  await modelService.create({
    name: file.name,
    format,
    assetType,  // NEW: Asset categorization
    data,
    // ... other fields
  });
}
```

### Step 5: Use Rig Presets (Optional)

For creature/animal models, use rig presets for automatic bone mapping:

```typescript
import { getRigPresetManager } from '@/core/database/schemas/rigPresets';

// Detect rig preset from model bones
const presetManager = getRigPresetManager();
const preset = presetManager.detectPreset(boneNames);

if (preset) {
  console.log(`Detected rig: ${preset.displayName}`);

  // Create bone mapping for retargeting
  const mapping = presetManager.createBoneMapping(sourceBones, preset);

  // Use mapping for animation retargeting
  await retargetAnimation(animation, mapping);
}
```

## Backward Compatibility

All existing VRM-centric code continues to work:

1. **Existing VRM models** work without changes
2. **VRM-specific fields** (`vrm` metadata) are preserved
3. **Old queries** continue to work
4. **No data migration required** - new fields have defaults

## Data Migration (Optional)

While not required, you can enhance existing data:

```typescript
// Add asset type to existing models
await db.models.toCollection().modify((model: any) => {
  if (!model.assetType) {
    model.assetType = model.format === 'vrm'
      ? AssetType.CHARACTER
      : AssetType.OTHER;
  }
});

// Add skeleton metadata to existing models
await db.models.toCollection().modify((model: any) => {
  if (!model.skeletonMetadata) {
    model.skeletonMetadata = {
      type: SkeletonType.UNKNOWN,
      boneCount: 0,
    };
  }
});
```

## Testing Checklist

- [ ] Existing VRM models still load correctly
- [ ] Can load new GLB/GLTF models
- [ ] Can filter by asset type
- [ ] Can filter by skeleton type
- [ ] Database migrations run successfully
- [ ] No data loss occurs during migration

## Rollback Plan

If issues occur, you can rollback:

```typescript
// Downgrade database schema
await db.close();
await Dexie.delete('VRMViewerDB');
// IndexedDB will recreate with previous schema on next init
```

**Note:** This will delete all local data. Ensure database is backed up before testing migration.

## Support

For issues or questions:
1. Check TypeScript errors: `npm run type-check`
2. Review database logs in browser DevTools → Application → IndexedDB
3. See `databaseMigrations.ts` for migration details
4. See `rigPresets.ts` for skeleton configuration

## Summary

| Change | Type | Action Required |
|--------|------|----------------|
| Extended format support | Feature | Optional - use new formats as needed |
| Asset type categorization | Feature | Optional - filter/group by asset type |
| Skeleton metadata | Feature | Optional - enable retargeting features |
| Database schema v3 | Migration | Automatic - handled by Dexie |
| New query filters | Feature | Optional - use for enhanced filtering |

**All changes are backward compatible. No immediate action required.**
