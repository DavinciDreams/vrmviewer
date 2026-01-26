# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VRM Viewer is a web-based 3D model viewer for VRM (VRoid Model) files with animation support, built with React, TypeScript, Three.js, and Zustand. The application features persistent storage via IndexedDB, drag-and-drop file handling, and comprehensive model/animation libraries.

**Tech Stack:**
- React 18.3 + TypeScript
- Vite 5 (build tool)
- Three.js 0.164 + @pixiv/three-vrm (3D rendering)
- Zustand 4.5 (state management)
- Dexie 3.2 (IndexedDB ORM)
- Tailwind CSS 3.4 (styling)
- Vitest (testing)

## Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload

# Building
npm run build           # TypeScript check + production build
npm run type-check      # Type check without building
npm run preview         # Preview production build

# Quality
npm run lint            # ESLint code quality checks

# Testing
npm run test            # Run tests in watch mode
npm run test:ui         # Run tests with UI
npm run test:coverage   # Generate coverage reports
npm run test:run        # Run tests once
```

## Architecture

### Layered Modular Design

```
src/
├── components/          # UI components (presentational)
│   ├── controls/       # Playback, model, camera controls
│   ├── database/       # Library UI (cards, editors)
│   ├── dragdrop/       # File drop zone
│   ├── layout/         # App layout
│   ├── ui/             # Reusable UI primitives
│   └── viewer/         # 3D viewer component
├── core/               # Business logic & infrastructure
│   ├── database/       # Persistence layer
│   └── three/          # 3D engine utilities
├── hooks/              # Custom React hooks (business logic)
├── store/              # Zustand state stores
├── types/              # TypeScript definitions
└── utils/              # Helper functions
```

### Key Architectural Patterns

**1. Service Layer Pattern**
- **Services** (`src/core/database/services/`) provide high-level CRUD operations
- Services directly access Dexie database (no repository layer)
- Handle validation, error handling, and business logic
- Example: `ModelService.saveModel()` → validates, handles thumbnails, persists to DB

**2. Zustand Store Pattern**
- Multiple focused stores (one per domain: models, animations, preferences, etc.)
- Each store combines state + actions in a single interface
- DevTools middleware for debugging
- Manual persistence through service calls (no automatic middleware)
- Exception: `preferencesStore` uses localStorage via `PreferencesService`

**3. Custom Hook Pattern**
- Domain-specific hooks encapsulate business logic
- Services injected into hooks (not directly into components)
- Examples: `useVRM`, `useAnimation`, `usePlayback`, `useDatabase`

**4. Camera Manager Singleton**
- `CameraManager` (`src/core/three/scene/CameraManager.ts`) manages Three.js camera state
- Auto-saves position to preferences on change
- Restores state on app load via `PreferencesService`

### Database Schema (IndexedDB via Dexie)

**Version 2** with 4 tables:
- `animations` - BVH/VRMA animations with metadata
- `models` - VRM/GLTF/GLB/FBX models with metadata
- `thumbnails` - Base64 image data linked by `targetUuid`
- `preferences` - JSON-stringified user settings

Key indexes: `uuid`, `name`, `createdAt`, `format`, `category`, `*tags` (multi-entry)

**CRITICAL**: All database operations must go through service layer, never directly to Dexie. Services handle:
- Validation and error handling
- Thumbnail management
- UUID generation
- Metadata extraction
- Bulk operations

### State Management Flow

```
Component → Custom Hook → Zustand Store → Service → Dexie → IndexedDB
```

**Note**: Stores do NOT have automatic persistence. Persistence is manual through service calls.

**Example**: Loading a model from library
1. User clicks model in `ModelLibrary`
2. `handleModelLoad()` in `App.tsx` calls `models.getByUuid()`
3. `ModelService` retrieves from DB, returns `ModelRecord`
4. `useVRM` hook's `loadModelFromFile()` loads into Three.js scene
5. Thumbnail auto-captured via `VRMViewer` callback

### Important File Locations

- `App.tsx` - Main app, orchestrates all hooks and components
- `core/database/DatabaseService.ts` - DB initialization, migrations, health checks
- `core/database/schemas/databaseSchema.ts` - Dexie schema definition
- `store/preferencesStore.ts` - User settings with localStorage persistence
- `core/three/scene/CameraManager.ts` - Camera state singleton
- `types/database.types.ts` - All DB entity types

### Working with Files

**File Format Support:**
- Models: VRM (0.x/1.0), GLTF, GLB, FBX
- Animations: BVH, VRMA

**File Loading Flow:**
1. Drag & drop → `handleDrop()` in `App.tsx`
2. File type detected via `getFileExtension()` → `getFileTypeFromExtension()`
3. Model files: Load via `useVRM.loadModelFromFile()`, store as unsaved
4. Animation files: Load via loaders, open `AnimationEditor` dialog
5. User must explicitly save to add to library

**Thumbnail Capture:**
- Auto-captured on model load via `VRMViewer.onThumbnailCaptured`
- Manual capture via `ThumbnailCapture` button
- Stored as base64 in `thumbnails` table, linked by `targetUuid`

### Export System

**Supported Export Formats:**
- **VRM 1.0** - Export loaded VRM models with custom metadata
- **VRMA** - Export animations with timing and metadata
- **GLB/GLTF** - Export standard 3D formats (TODO: planned)

**Export Architecture:**
- `src/core/three/export/` - Export implementations (VRMExporter, VRMAExporter)
- `src/store/exportStore.ts` - Export state and options management
- `src/hooks/useExport.ts` - Export hook for components
- `src/components/export/ExportDialog.tsx` - Export UI with quality settings

**Export Flow:**
1. User clicks Export button → Opens `ExportDialog`
2. Configure options (format, quality, metadata)
3. `useExport.exportVRM()` or `exportVRMA()` processes the model/animation
4. File generated and downloaded via `file-saver`
5. Export progress tracked in `exportStore`

**Key Files:**
- `VRMExporter.ts` - Handles VRM 1.0 export with validation
- `VRMAExporter.ts` - Converts animation clips to VRMA format
- Export options include: format, quality (low/medium/high), metadata (author, title, version)

**TODO**: Add export options for all supported formats (GLB, GLTF, FBX) and ensure drag-and-drop imports work for all formats.

### URL Configuration

Simple embedding via URL query parameters for external sites:
- `?model=URL` - Load model from URL
- `?animation=URL` - Load animation from URL
- `?autoplay=true` - Auto-play animation
- `?camera=preset` - Set camera preset

Handled by `useDAMIntegration` hook in `App.tsx`. This enables embedding the viewer in external sites with pre-loaded assets.

### Animation System

**Supported Animation Formats:**
- **BVH** - Motion capture data with skeletal hierarchy
- **VRMA** - VRoid Animation format with full metadata
- **GLTF Animations** - Embedded animations in GLTF/GLB files

**Animation Architecture:**
- `src/core/three/animation/` - Animation system core
- `src/core/three/loaders/` - BVHLoader, VRMALoader for file loading
- `src/hooks/useAnimation.ts` - Animation loading and playback state
- `src/hooks/usePlayback.ts` - Playback controls (play, pause, stop, seek, speed)
- `src/hooks/useIdleAnimation.ts` - Default idle animation when no animation loaded
- `src/hooks/useBlendShapes.ts` - Facial expression and blend shape controls

**Animation Features:**
- Real-time playback with speed control (0.1x to 2.0x)
- Loop mode toggle
- Timeline scrubbing with visual feedback
- Auto-preview during editing
- Thumbnail generation from animation frames
- Blend shape support for VRM models

**Animation Editor:**
- Inline name and description editing
- Duration display
- Format-specific metadata handling
- Save directly to library with thumbnails

**Key Gotcha**: Animations must be retargeted to the model's skeleton. Not all animations work with all models due to bone naming differences.

### Adding New Features

**New Store Pattern:**
```typescript
// 1. Define state & actions interfaces
interface MyFeatureState { ... }
interface MyFeatureActions { ... }

// 2. Create store with devtools
export const useMyFeatureStore = create<MyFeatureState & MyFeatureActions>()(
  devtools((set) => ({ ... }))
);

// 3. Add selectors for derived state
export const selectFilteredData = (state: MyFeatureState) => { ... };
```

**New Service Pattern:**
```typescript
// 1. Create service class in core/database/services/
export class MyService {
  async getItems(): Promise<DatabaseOperationResult<Item[]>> {
    // Implementation
  }
}

// 2. Export singleton
let instance: MyService | null = null;
export function getMyService(): MyService {
  if (!instance) instance = new MyService();
  return instance;
}
```

### Common Gotchas

1. **Unsaved Model State**: Models loaded via drag-drop are unsaved until user clicks "Save Model". Track with `unsavedModelFile`, `unsavedModelData`, `unsavedThumbnailData` in `App.tsx`.

2. **Camera Persistence**: Camera state auto-saves to `preferences` table via `CameraManager`. If modifying camera logic, ensure `saveCameraState()` is called.

3. **Thumbnail Management**: Thumbnails are automatically cleaned up when deleting parent entities via `ThumbnailService.deleteThumbnailByTarget()`. The thumbnail lifecycle: create → link via targetUuid → auto-delete on parent removal.

4. **UUID vs ID**: Records have auto-increment `id` (Dexie) and string `uuid` (application). Always use `uuid` for references and lookups.

5. **Path Alias**: `@/*` maps to `./src/*` in tsconfig. Use `@/components/...` instead of relative paths.

6. **Database Migrations**: When modifying schema, increment version in `databaseSchema.ts`. For simple schema changes (adding tables, indexes), Dexie auto-migrates. For data transformations:
```typescript
// Example: Migration with data transformation
this.version(3).stores({
  models: '++id, uuid, name, newField, createdAt'
}).upgrade(async (tx) => {
  // Transform existing data
  await tx.table('models').toCollection().modify(model => {
    model.newField = transformLegacyField(model.oldField);
  });
});
```
Test migrations by clearing database and reloading.

7. **Error Handling**: All DB operations return `DatabaseOperationResult<T>` with `{ success, data?, error? }`. Always check `success` before accessing `data`.

### Testing

- Unit tests for services and utilities in `src/**/*.test.ts`
- Store tests verify state transitions
- Component tests use React Testing Library
- Run `npm run test:coverage` before committing significant changes

**Testing Setup:**
- Vitest with happy-dom for DOM testing
- Coverage reports via vitest coverage
- Global test setup in `vitest.config.ts`

**Testing Guidelines:**
- Mock Dexie database operations in service tests
- Test stores by calling actions and verifying state changes
- Test hooks with `@testing-library/react-hooks`
- Component tests should test user interactions, not implementation

### Troubleshooting

**Database Issues:**
- **Quota Exceeded**: Clear database via browser DevTools → Application → IndexedDB → VRMViewerDB
- **Corrupt Data**: Use `DatabaseService.clearAll()` or `DatabaseService.delete()`
- **Inspect Database**: DevTools → Application → IndexedDB → VRMViewerDB

**Three.js Rendering Issues:**
- **Scene not rendering**: Check browser console for WebGL errors, verify canvas has valid dimensions
- **Camera position problems**: Use `CameraManager.resetCamera()` to reset to default
- **Model not visible**: Check model scale (may be too small/large), use wireframe mode to debug

**Thumbnail Capture Failures:**
- **Canvas not ready**: Ensure renderer is initialized before capturing
- **WebGL context loss**: Reload page to restore context
- **Black thumbnails**: Model may not be in camera view, check camera position

**File Loading Failures:**
- **CORS errors**: Files must be served from same origin or have proper CORS headers
- **Format issues**: Verify file format matches extension
- **VRM version mismatch**: VRM 0.x and 1.0 have different schemas

**Debugging Tools:**
- Zustand DevTools: Install Redux DevTools extension to inspect store state
- Three.js Inspector: Use `three-devtools` in development
- Console logging: Extensive logging already in place for debugging
