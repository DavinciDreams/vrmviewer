# VRM Viewer

A modern, web-based VRM (VRoid Model) viewer with animation support, built with React, Three.js, and TypeScript.

## Features

- **Drag and Drop Support**: Simply drag and drop model files (VRM, GLB, GLTF, FBX) and animation files (BVH, VRMA) to load them
- **DAM Integration**: Load models and animations directly from URLs via query parameters for backend-driven embedding
- **URL Configuration**: Control viewer behavior through URL parameters (autoplay, camera, speed, etc.)
- **Idle Animations**: Automatic breathing and blinking animations when no active animation is playing
- **Animation Playback**: Full playback controls including play, pause, stop, speed adjustment, and loop toggle
- **Blend Shape Support**: Control facial expressions and blend shapes
- **VRM1 Export**: Export your models in VRM1.0 format
- **VRMA Export**: Export animations in VRMA format for use with VRM models
- **Animation Database**: Save and manage your animations with user descriptions
- **Model Library**: Save and manage your models
- **Numerical Identifiers**: Automatic file renaming with descriptive names and numerical identifiers
- **Clean Interface**: Modern, dark-themed UI with intuitive controls
- **Responsive Design**: Works on desktop and tablet devices

## Supported File Formats

### Models
- **VRM** (.vrm) - VRoid Model format (0.x and 1.0)
- **glTF** (.gltf) - GL Transmission Format
- **GLB** (.glb) - Binary glTF
- **FBX** (.fbx) - Autodesk FBX format

### Animations
- **BVH** (.bvh) - Motion capture animation format
- **VRMA** (.vrma) - VRM Animation format

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd vrmviewer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Optional: start the server-side asset library API in a second terminal:
```bash
npm run server
```

When the API is available at `/api`, the model library uses server-side
persistence for saved model files and metadata. If the API is unavailable, the
viewer falls back to browser IndexedDB.

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Loading Models

1. Drag and drop a model file (VRM, GLB, GLTF, or FBX) onto the viewer
2. The model will automatically load and be displayed in the 3D viewer
3. Use the model controls to adjust visibility and wireframe mode

**Method 2: URL Query Parameters (DAM Integration)**

Load models directly from URLs by adding query parameters:

```html
<!-- Load a model from URL -->
https://your-viewer-url.com/?model=https://your-dam.com/model.vrm

<!-- Load model with animation and autoplay -->
https://your-viewer-url.com/?model=https://your-dam.com/model.vrm&animation=https://your-dam.com/anim.vrma&autoplay=true

<!-- Full configuration example -->
https://your-viewer-url.com/?model=https://your-dam.com/model.vrm&animation=https://your-dam.com/anim.vrma&autoplay=true&loop=true&camera=preset:front&speed=1.5
```

**Supported URL Parameters:**
- `model` - URL of model file (VRM, GLB, GLTF, FBX)
- `animation` - URL of animation file (VRMA, BVH)
- `autoplay` - Automatically start playback (true/false)
- `loop` - Enable loop mode (true/false)
- `camera` - Camera position or preset (e.g., `preset:front` or `0,1.5,3`)
- `speed` - Playback speed (number)
- `background` - Background color (hex)
- `lighting` - Lighting configuration
- `wireframe` - Enable wireframe mode (true/false)
- `visible` - Model visibility (true/false)

See [`docs/DAM_INTEGRATION.md`](docs/DAM_INTEGRATION.md) for complete DAM integration documentation.

### Loading Animations

1. Drag and drop an animation file (BVH or VRMA) onto the viewer
2. A dialog will appear asking for a description
3. Enter a description and save - the animation will be automatically named with a descriptive name and numerical identifier
4. The animation will be added to your animation library

### Playback Controls

- **Play/Pause**: Start or pause the current animation
- **Stop**: Stop the animation and reset to the beginning
- **Speed**: Adjust playback speed (0.1x to 3.0x)
- **Loop**: Toggle loop mode on/off
- **Timeline**: Scrub through the animation timeline

### Idle Animations

When no animation is playing, the model will automatically:
- **Breathe**: Subtle chest expansion and shoulder movement
- **Blink**: Random blinking at natural intervals

These idle animations are automatically disabled when an animation is loaded and playing.

### Exporting

1. Click the Export button in the sidebar
2. Choose your export format (VRM or VRMA)
3. Configure export options
4. Download the exported file

### Animation Library

- Browse all saved animations in the Animations tab
- Search animations by name or description
- Play animations directly from the library
- Edit animation names and descriptions
- Delete animations

### Model Library

- Browse all saved models in the Models tab
- Search models by name or description
- Load models directly from the library
- Edit model names and descriptions
- Delete models

### Server-Side Persistence

The model library can persist assets through the bundled Node API:

```bash
npm run server
```

Default API settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ASSET_LIBRARY_HOST` | `127.0.0.1` | API bind address |
| `ASSET_LIBRARY_PORT` | `3100` | API port |
| `ASSET_LIBRARY_DATA_DIR` | `./data/asset-library` | Model metadata and binary storage |
| `ASSET_LIBRARY_STATIC_DIR` | unset | Optional built frontend directory to serve from the same Node process |
| `ASSET_LIBRARY_MAX_BODY_MB` | `512` | Maximum JSON upload body size |

The Vite dev server proxies `/api` to `http://127.0.0.1:3100`, so no client
configuration is needed for local development. Set `VITE_ASSET_LIBRARY_MODE=local`
to force browser-only IndexedDB persistence. Set `VITE_ASSET_LIBRARY_API_URL` to
an explicit API URL when the asset API is hosted separately.

### Docker / Coolify

The included `Dockerfile` builds the Vite frontend and serves it with the
asset-library API from one container:

```bash
docker build -t vrmviewer .
docker run --rm -p 3000:3000 -v vrmviewer-data:/data/asset-library vrmviewer
```

Coolify settings:

- Exposed port: `3000`
- Persistent volume: `/data/asset-library`
- Health check path: `/api/health`

Optional host mounts for the full Hill catalog/control-surface workflow:

- `/tank/3d:/tank/3d`
- `/home/ms/hill:/home/ms/hill`
- `/tank/comfy:/tank/comfy`

Without those optional mounts, the app still runs with server-side persistence,
but Hill generation, file-backed catalog scans, and marketplace packaging will
only see files stored in `/data/asset-library`.

## File Naming

When you save animations or models, they are automatically renamed using:
1. A descriptive name based on your description
2. A numerical identifier to ensure uniqueness
3. Example: `walking_animation_1`, `happy_expression_2`

## Architecture

The application follows a modular architecture:

- **Components**: Reusable UI components for controls, dialogs, and displays
- **Hooks**: Custom React hooks for state management and business logic
- **Stores**: Zustand stores for global state management
- **Core**: Three.js utilities for 3D rendering, animation, and file loading
- **Database**: IndexedDB browser cache plus optional server-side model persistence
- **Utils**: Helper functions for file naming, validation, and export

See [`plans/vrm-viewer-architecture.md`](plans/vrm-viewer-architecture.md) for detailed architecture documentation.

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run server` - Start server-side asset library API
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality checks
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
vrmviewer/
├── public/              # Static assets
├── server/              # Server-side asset library API
├── src/
│   ├── components/      # React components
│   │   ├── controls/    # Playback and model controls
│   │   ├── database/    # Library components
│   │   ├── dragdrop/    # Drag and drop components
│   │   ├── export/      # Export dialogs
│   │   ├── layout/      # Layout components
│   │   ├── ui/          # UI components
│   │   └── viewer/      # 3D viewer components
│   ├── constants/        # Constants and enums
│   ├── core/            # Core utilities
│   │   ├── database/    # Database services
│   │   └── three/       # Three.js utilities
│   │       ├── animation/  # Animation system
│   │       ├── export/      # Export utilities
│   │       ├── loaders/     # File loaders
│   │       └── scene/       # Scene management
│   ├── hooks/           # Custom React hooks
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── index.html           # HTML template
├── package.json         # Project dependencies
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── tailwind.config.js    # Tailwind CSS configuration
```

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Known Limitations

- Animations are still persisted in browser IndexedDB only
- Server-side persistence currently covers model assets and model metadata
- Export functionality is a placeholder implementation
- Thumbnail capture is not fully implemented
- Camera controls are limited
- Only VRM files are fully supported for model loading (other formats may have limited support)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is open source and available under the MIT License.

## Credits

Built with:
- React
- Three.js
- @pixiv/three-vrm
- Vite
- TypeScript
- Tailwind CSS
- Zustand
