# VRM Viewer

A modern, web-based VRM (VRoid Model) viewer with animation support, built with React, Three.js, and TypeScript.

## Features

- **Drag and Drop Support**: Simply drag and drop model files (VRM, GLB, GLTF, FBX) and animation files (BVH, VRMA) to load them
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

4. Open your browser and navigate to:
```
http://localhost:5173
```

## Usage

### Loading Models

1. Drag and drop a model file (VRM, GLB, GLTF, or FBX) onto the viewer
2. The model will automatically load and be displayed in the 3D viewer
3. Use the model controls to adjust visibility and wireframe mode

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
- **Database**: IndexedDB-based storage for animations and models
- **Utils**: Helper functions for file naming, validation, and export

See [`plans/vrm-viewer-architecture.md`](plans/vrm-viewer-architecture.md) for detailed architecture documentation.

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality checks
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
vrmviewer/
├── public/              # Static assets
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

- Database operations are currently in-memory (not persisted to IndexedDB yet)
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
