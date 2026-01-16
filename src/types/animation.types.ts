/**
 * Animation Types
 * Defines types for animations, playback, and related structures
 */

import * as THREE from 'three';

/**
 * Animation Clip
 */
export interface AnimationClip {
  name: string;
  duration: number;
  tracks: AnimationTrack[];
  loop?: boolean;
  blendMode?: THREE.AnimationBlendMode;
}

/**
 * Animation Track
 */
export interface AnimationTrack {
  name: string;
  type: AnimationTrackType;
  times: number[];
  values: number[];
  interpolation?: AnimationInterpolation;
}

/**
 * Animation Track Type
 */
export type AnimationTrackType =
  | 'position'
  | 'quaternion'
  | 'scale'
  | 'weights'
  | 'morphTargetInfluences'
  | 'blendShapeWeights';

/**
 * Animation Interpolation
 */
export type AnimationInterpolation =
  | 'Linear'
  | 'Step'
  | 'Cubic'
  | 'CatmullRom';

/**
 * Animation State
 */
export interface AnimationState {
  isPlaying: boolean;
  isPaused: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  weight: number;
  fadeIn: number;
  fadeOut: number;
  blendMode: THREE.AnimationBlendMode;
}

/**
 * Animation Playback Options
 */
export interface AnimationPlaybackOptions {
  loop?: boolean;
  speed?: number;
  weight?: number;
  fadeIn?: number;
  fadeOut?: number;
  blendMode?: THREE.AnimationBlendMode;
  clampWhenFinished?: boolean;
  timeScale?: number;
}

/**
 * Animation Action
 */
export interface AnimationAction {
  clip: AnimationClip;
  state: AnimationState;
  mixer: THREE.AnimationMixer;
  root: THREE.Object3D;
  start: () => void;
  stop: () => void;
  pause: () => void;
  play: () => void;
  reset: () => void;
  setTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setLoop: (loop: boolean) => void;
  setSpeed: (speed: number) => void;
  setWeight: (weight: number) => void;
  setFadeIn: (fadeIn: number) => void;
  setFadeOut: (fadeOut: number) => void;
}

/**
 * Animation Library
 */
export interface AnimationLibrary {
  animations: Map<string, AnimationClip>;
  categories: Map<string, string[]>;
  metadata: Map<string, AnimationMetadata>;
}

/**
 * Animation Metadata
 */
export interface AnimationMetadata {
  name: string;
  displayName: string;
  description?: string;
  category: string;
  tags: string[];
  duration: number;
  fps?: number;
  frameCount?: number;
  author?: string;
  license?: string;
  thumbnail?: string;
  createdAt?: Date;
  updatedAt?: Date;
  format: AnimationFormat;
}

/**
 * Animation Format
 */
export type AnimationFormat = 'bvh' | 'vrma' | 'gltf' | 'fbx';

/**
 * Animation Transition
 */
export interface AnimationTransition {
  from: string;
  to: string;
  duration: number;
  easing?: TransitionEasing;
}

/**
 * Transition Easing
 */
export type TransitionEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'step';

/**
 * Animation Blend
 */
export interface AnimationBlend {
  animations: Map<string, number>;
  duration: number;
  easing?: TransitionEasing;
}

/**
 * Animation Event
 */
export interface AnimationEvent {
  time: number;
  type: AnimationEventType;
  data?: unknown;
}

/**
 * Animation Event Type
 */
export type AnimationEventType =
  | 'start'
  | 'end'
  | 'loop'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'custom';

/**
 * Animation Timeline
 */
export interface AnimationTimeline {
  currentTime: number;
  totalDuration: number;
  markers: TimelineMarker[];
  events: AnimationEvent[];
}

/**
 * Timeline Marker
 */
export interface TimelineMarker {
  id: string;
  name: string;
  time: number;
  color?: string;
  description?: string;
}

/**
 * Animation Layer
 */
export interface AnimationLayer {
  name: string;
  weight: number;
  blending: THREE.AnimationBlendMode;
  animations: Map<string, AnimationAction>;
}

/**
 * Animation Controller
 */
export interface AnimationController {
  layers: AnimationLayer[];
  currentLayer: string;
  currentAnimation: string;
  transitions: AnimationTransition[];
  blends: AnimationBlend[];
  play: (name: string, layer?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  transition: (to: string, duration?: number) => void;
  blend: (animations: Map<string, number>, duration?: number) => void;
  addLayer: (layer: AnimationLayer) => void;
  removeLayer: (name: string) => void;
  setLayerWeight: (name: string, weight: number) => void;
}

/**
 * Bone Mapping
 */
export interface BoneMapping {
  sourceBone: string;
  targetBone: string;
  offset?: THREE.Vector3;
  rotationOffset?: THREE.Euler;
  scaleOffset?: THREE.Vector3;
}

/**
 * Retargeting Options
 */
export interface RetargetingOptions {
  sourceSkeleton: THREE.Skeleton;
  targetSkeleton: THREE.Skeleton;
  boneMappings: BoneMapping[];
  scaleMode?: 'uniform' | 'proportional' | 'none';
  rotationMode?: 'preserve' | 'reset' | 'relative';
  positionMode?: 'preserve' | 'reset' | 'relative';
}

/**
 * Motion Capture Data
 */
export interface MotionCaptureData {
  hierarchy: MCBone[];
  frames: MCFrame[];
  frameTime: number;
  numFrames: number;
}

/**
 * MC Bone
 */
export interface MCBone {
  name: string;
  index: number;
  parent?: number;
  offset: THREE.Vector3;
  channels: string[];
}

/**
 * MC Frame
 */
export interface MCFrame {
  positions: THREE.Vector3[];
  rotations: THREE.Quaternion[];
}

/**
 * Animation Export Options
 */
export interface AnimationExportOptions {
  format: 'gltf' | 'fbx' | 'bvh';
  includeMorphTargets?: boolean;
  includeSkeleton?: boolean;
  includeMaterials?: boolean;
  binary?: boolean;
  pretty?: boolean;
  customExtensions?: boolean;
}

/**
 * Animation Import Options
 */
export interface AnimationImportOptions {
  format: AnimationFormat;
  targetSkeleton?: THREE.Skeleton;
  boneMappings?: BoneMapping[];
  scale?: number;
  offset?: THREE.Vector3;
  rotationOffset?: THREE.Euler;
  generateMipmaps?: boolean;
}
