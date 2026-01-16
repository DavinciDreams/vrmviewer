/**
 * Animation Utilities
 * Utility functions for animation operations
 */

import * as THREE from 'three';
import { AnimationClip, KeyframeTrack, VectorKeyframeTrack, QuaternionKeyframeTrack, NumberKeyframeTrack } from 'three';
import { VRM } from '@pixiv/three-vrm';
import { VRMHumanoidBoneName } from '../constants/boneNames';

/**
 * Animation track type
 */
export type AnimationTrackType = 'position' | 'rotation' | 'scale';

/**
 * Animation keyframe
 */
export interface AnimationKeyframe {
  time: number;
  value: number | THREE.Vector3 | THREE.Quaternion;
}

/**
 * Animation track data
 */
export interface AnimationTrackData {
  name: string;
  type: AnimationTrackType;
  keyframes: AnimationKeyframe[];
}

/**
 * Animation clip data
 */
export interface AnimationClipData {
  name: string;
  duration: number;
  tracks: AnimationTrackData[];
}

/**
 * Create an animation clip from track data
 */
export function createAnimationClip(data: AnimationClipData): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  data.tracks.forEach((trackData) => {
    const keyframeTrack = createKeyframeTrack(trackData);
    if (keyframeTrack) {
      tracks.push(keyframeTrack);
    }
  });

  return new AnimationClip(data.name, data.duration, tracks);
}

/**
 * Create a keyframe track from track data
 */
export function createKeyframeTrack(data: AnimationTrackData): KeyframeTrack | null {
  const times: number[] = [];
  const values: number[] = [];

  data.keyframes.forEach((keyframe) => {
    times.push(keyframe.time);

    if (data.type === 'position' || data.type === 'scale') {
      const vector = keyframe.value as THREE.Vector3;
      values.push(vector.x, vector.y, vector.z);
    } else if (data.type === 'rotation') {
      const quaternion = keyframe.value as THREE.Quaternion;
      values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
  });

  if (data.type === 'position') {
    return new VectorKeyframeTrack(data.name, times, values);
  } else if (data.type === 'rotation') {
    return new QuaternionKeyframeTrack(data.name, times, values);
  } else if (data.type === 'scale') {
    return new VectorKeyframeTrack(data.name, times, values);
  }

  return null;
}

/**
 * Create a simple idle animation clip
 */
export function createIdleAnimationClip(vrm: VRM, duration: number = 3): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  // Get available bones
  const bones = ['spine', 'chest', 'upperChest'] as VRMHumanoidBoneName[];

  bones.forEach((boneName) => {
    const bone = vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (!bone) return;

    const times = [0, duration / 4, duration / 2, (3 * duration) / 4, duration];
    const values: number[] = [];

    // Subtle breathing motion
    times.forEach((time) => {
      const phase = (time / duration) * Math.PI * 2;
      const rotation = new THREE.Quaternion();
      rotation.setFromEuler(new THREE.Euler(0, 0, Math.sin(phase) * 0.02));
      values.push(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    const trackName = `${bone.name}.quaternion`;
    tracks.push(new QuaternionKeyframeTrack(trackName, times, values));
  });

  return new AnimationClip('idle', duration, tracks);
}

/**
 * Create a blinking animation clip
 */
export function createBlinkAnimationClip(vrm: VRM, duration: number = 0.15): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  if (!vrm.expressionManager) return new AnimationClip('blink', duration, tracks);

  const blinkShapes = ['blinkLeft', 'blinkRight'];

  blinkShapes.forEach((shapeName) => {
    if (!vrm.expressionManager!.hasExpression(shapeName)) return;

    const times = [0, duration * 0.5, duration];
    const values = [0, 1, 0];

    const trackName = `${shapeName}.value`;
    tracks.push(new NumberKeyframeTrack(trackName, times, values));
  });

  return new AnimationClip('blink', duration, tracks);
}

/**
 * Create a lip sync animation clip from visemes
 */
export function createLipSyncAnimationClip(
  vrm: VRM,
  visemes: Array<{ time: number; shape: string; weight: number }>,
  duration: number
): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  if (!vrm.expressionManager) return new AnimationClip('lipSync', duration, tracks);

  // Group by shape
  const shapeKeyframes: Map<string, Array<{ time: number; weight: number }>> = new Map();

  visemes.forEach((viseme) => {
    if (!shapeKeyframes.has(viseme.shape)) {
      shapeKeyframes.set(viseme.shape, []);
    }
    shapeKeyframes.get(viseme.shape)!.push({ time: viseme.time, weight: viseme.weight });
  });

  // Create tracks for each shape
  shapeKeyframes.forEach((keyframes, shapeName) => {
    if (!vrm.expressionManager!.hasExpression(shapeName)) return;

    const times = keyframes.map((kf) => kf.time).sort((a, b) => a - b);
    const values = times.map((time) => {
      const keyframe = keyframes.find((kf) => kf.time === time);
      return keyframe ? keyframe.weight : 0;
    });

    const trackName = `${shapeName}.value`;
    tracks.push(new NumberKeyframeTrack(trackName, times, values));
  });

  return new AnimationClip('lipSync', duration, tracks);
}

/**
 * Interpolate between two animation clips
 */
export function interpolateAnimationClips(
  clip1: AnimationClip,
  clip2: AnimationClip
): AnimationClip {
  const duration = Math.max(clip1.duration, clip2.duration);
  const tracks: KeyframeTrack[] = [];

  // Merge tracks from both clips
  const trackMap = new Map<string, KeyframeTrack[]>();

  clip1.tracks.forEach((track) => {
    if (!trackMap.has(track.name)) {
      trackMap.set(track.name, []);
    }
    trackMap.get(track.name)!.push(track);
  });

  clip2.tracks.forEach((track) => {
    if (!trackMap.has(track.name)) {
      trackMap.set(track.name, []);
    }
    trackMap.get(track.name)!.push(track);
  });

  // Interpolate tracks
  trackMap.forEach((tracks, name) => {
    if (tracks.length === 1) {
      // Only one clip has this track, use it as is
      tracks[0].name = name;
      tracks.push(tracks[0]);
    } else if (tracks.length === 2) {
      // Both clips have this track, interpolate
      const interpolatedTrack = interpolateKeyframeTracks(tracks[0]);
      if (interpolatedTrack) {
        interpolatedTrack.name = name;
        tracks.push(interpolatedTrack);
      }
    }
  });

  return new AnimationClip('interpolated', duration, tracks);
}

/**
 * Interpolate between two keyframe tracks
 */
function interpolateKeyframeTracks(
  track1: KeyframeTrack
): KeyframeTrack | null {
  // This is a simplified implementation
  // In practice, you'd need to handle different keyframe times and proper interpolation
  return track1.clone();
}

/**
 * Scale animation clip duration
 */
export function scaleAnimationDuration(clip: AnimationClip, scaleFactor: number): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  clip.tracks.forEach((track) => {
    const scaledTrack = track.clone();
    const times = scaledTrack.times;

    for (let i = 0; i < times.length; i++) {
      times[i] *= scaleFactor;
    }

    tracks.push(scaledTrack);
  });

  return new AnimationClip(clip.name, clip.duration * scaleFactor, tracks);
}

/**
 * Loop animation clip
 */
export function loopAnimationClip(clip: AnimationClip, loops: number = 1): AnimationClip {
  const duration = clip.duration * loops;
  const tracks: KeyframeTrack[] = [];

  clip.tracks.forEach((track) => {
    const loopedTrack = track.clone();
    const originalTimes = track.times;
    const originalValues = track.values;

    const newTimes: number[] = [];
    const newValues: number[] = [];

    for (let i = 0; i < loops; i++) {
      const offset = i * clip.duration;

      for (let j = 0; j < originalTimes.length; j++) {
        newTimes.push(originalTimes[j] + offset);
      }

      for (let j = 0; j < originalValues.length; j++) {
        newValues.push(originalValues[j]);
      }
    }

    loopedTrack.times = new Float32Array(newTimes);
    loopedTrack.values = new Float32Array(newValues);
    tracks.push(loopedTrack);
  });

  return new AnimationClip(clip.name, duration, tracks);
}

/**
 * Reverse animation clip
 */
export function reverseAnimationClip(clip: AnimationClip): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  clip.tracks.forEach((track) => {
    const reversedTrack = track.clone();
    const times = reversedTrack.times;

    // Reverse times
    const reversedTimes = Array.from(times).reverse();
    const reversedValues: number[] = [];

    // Reverse values based on value stride
    const valueStride = track.values.length / times.length;

    for (let i = reversedTimes.length - 1; i >= 0; i--) {
      const startIndex = i * valueStride;
      for (let j = 0; j < valueStride; j++) {
        reversedValues.push(track.values[startIndex + j]);
      }
    }

    reversedTrack.times = new Float32Array(reversedTimes);
    reversedTrack.values = new Float32Array(reversedValues);
    tracks.push(reversedTrack);
  });

  return new AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Get animation clip duration
 */
export function getAnimationClipDuration(clip: AnimationClip): number {
  return clip.duration;
}

/**
 * Get animation clip keyframe count
 */
export function getAnimationClipKeyframeCount(clip: AnimationClip): number {
  let count = 0;
  clip.tracks.forEach((track) => {
    count += track.times.length;
  });
  return count;
}

/**
 * Get animation clip track count
 */
export function getAnimationClipTrackCount(clip: AnimationClip): number {
  return clip.tracks.length;
}

/**
 * Validate animation clip
 */
export function validateAnimationClip(clip: AnimationClip): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (clip.duration <= 0) {
    errors.push('Animation clip duration must be positive');
  }

  if (clip.tracks.length === 0) {
    errors.push('Animation clip must have at least one track');
  }

  clip.tracks.forEach((track, index) => {
    if (track.times.length === 0) {
      errors.push(`Track ${index} has no keyframes`);
    }

    if (track.times.length !== track.values.length / getValueStride(track)) {
      errors.push(`Track ${index} has mismatched times and values`);
    }

    // Check for negative times
    for (let i = 0; i < track.times.length; i++) {
      if (track.times[i] < 0) {
        errors.push(`Track ${index} has negative time at keyframe ${i}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get value stride for a keyframe track
 */
function getValueStride(track: KeyframeTrack): number {
  if (track instanceof VectorKeyframeTrack) {
    return 3;
  } else if (track instanceof QuaternionKeyframeTrack) {
    return 4;
  } else if (track instanceof NumberKeyframeTrack) {
    return 1;
  }
  return 1;
}

/**
 * Format time as MM:SS.ms
 */
export function formatTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time % 1) * 100);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

/**
 * Parse time string to seconds
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':');
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return parseFloat(timeString);
}
