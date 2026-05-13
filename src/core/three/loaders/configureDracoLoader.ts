import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const DRACO_DECODER_PATH = '/draco/gltf/';

let sharedDracoLoader: DRACOLoader | null = null;

export function getSharedDracoLoader(): DRACOLoader {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    sharedDracoLoader.setDecoderConfig({ type: 'wasm' });
    sharedDracoLoader.preload();
  }

  return sharedDracoLoader;
}

export function configureDracoLoader(gltfLoader: GLTFLoader): GLTFLoader {
  gltfLoader.setDRACOLoader(getSharedDracoLoader());
  return gltfLoader;
}

