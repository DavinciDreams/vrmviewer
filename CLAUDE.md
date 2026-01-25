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
- **Repositories** handle direct Dexie database access
- Clean separation between business logic and data access
- Example: `ModelService.saveModel()` → validates, handles thumbnails, persists to DB

**2. Zustand Store Pattern**
- Multiple focused stores (one per domain: models, animations, preferences, etc.)
- Each store combines state + actions in a single interface
- DevTools middleware for debugging
- Automatic IndexedDB persistence through services

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
Component → Custom Hook → Zustand Store → Service → Repository → Dexie → IndexedDB
```

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

### DAM Integration

Backend-driven embedding via URL query parameters:
- `?model=URL` - Load model from URL
- `?animation=URL` - Load animation from URL
- `?autoplay=true` - Auto-play animation
- `?camera=preset` - Set camera preset

Handled by `useDAMIntegration` hook in `App.tsx`.

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

3. **Thumbnail Orphaning**: When deleting models/animations, old thumbnails aren't auto-deleted. Use `ThumbnailService.deleteThumbnailByTarget()` before deletion.

4. **UUID vs ID**: Records have auto-increment `id` (Dexie) and string `uuid` (application). Always use `uuid` for references and lookups.

5. **Path Alias**: `@/*` maps to `./src/*` in tsconfig. Use `@/components/...` instead of relative paths.

6. **Database Migrations**: When modifying schema, increment version in `databaseSchema.ts` and add migration logic to `DatabaseService.runMigrations()`.

7. **Error Handling**: All DB operations return `DatabaseOperationResult<T>` with `{ success, data?, error? }`. Always check `success` before accessing `data`.

### Testing

- Unit tests for services and utilities in `src/**/*.test.ts`
- Store tests verify state transitions
- Component tests use React Testing Library
- Run `npm run test:coverage` before committing significant changes
