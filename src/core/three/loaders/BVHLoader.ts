/**
 * BVH Loader
 * Loads BVH motion capture files and converts them to Three.js animation format
 */

import * as THREE from 'three';
import {
  LoaderResult,
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
} from '../../../types/vrm.types';

/**
 * BVH Model
 */
export interface BVHModel {
  scene: THREE.Group;
  animation: THREE.AnimationClip;
  skeleton: THREE.Skeleton;
  hierarchy: BVHNode[];
}

/**
 * BVH Node
 */
export interface BVHNode {
  name: string;
  offset: THREE.Vector3;
  channels: string[];
  children: BVHNode[];
  parent?: BVHNode;
  index: number;
}

/**
 * BVH Loader Class
 */
export class BVHLoaderWrapper {
  /**
   * Load BVH from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<BVHModel>> {
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const text = await this.fetchText(url, options);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const model = this.parseAndConvert(text);
      
      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: model,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Load BVH from File
   */
  async loadFromFile(
    file: File,
    _options?: ModelLoadOptions
  ): Promise<LoaderResult<BVHModel>> {
    try {
      this.updateProgress(_options, 0, 100, 'INITIALIZING');

      const text = await file.text();
      const model = this.parseAndConvert(text);
      
      return {
        success: true,
        data: model,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Load BVH from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    _options?: ModelLoadOptions
  ): Promise<LoaderResult<BVHModel>> {
    try {
      this.updateProgress(_options, 0, 100, 'PARSING');

      const text = new TextDecoder().decode(arrayBuffer);
      const model = this.parseAndConvert(text);
      
      return {
        success: true,
        data: model,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Fetch text from URL
   */
  private async fetchText(
    url: string,
    _options?: ModelLoadOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch BVH file: ${response.statusText}`);
          }
          return response.text();
        })
        .then((text) => {
          resolve(text);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   * Parse and convert BVH to Three.js format
   */
  private parseAndConvert(text: string): BVHModel {
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    
    if (lines.length === 0) {
      throw new Error('Empty BVH file');
    }

    let lineIndex = 0;
    
    // Parse HIERARCHY section
    const hierarchy: BVHNode[] = [];
    const nodeMap = new Map<string, BVHNode>();
    
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      
      if (line.toUpperCase().startsWith('HIERARCHY')) {
        lineIndex++;
        while (lineIndex < lines.length) {
          const hierarchyLine = lines[lineIndex].trim();
          
          if (hierarchyLine.toUpperCase().startsWith('ROOT') || hierarchyLine.toUpperCase().startsWith('JOINT')) {
            const node = this.parseHierarchyLine(hierarchyLine);
            if (node) {
              hierarchy.push(node);
              nodeMap.set(node.name, node);
            }
            lineIndex++;
          } else if (hierarchyLine.toUpperCase().startsWith('MOTION') || hierarchyLine.toUpperCase().startsWith('}')) {
            break;
          } else {
            lineIndex++;
          }
        }
      } else if (line.toUpperCase().startsWith('MOTION')) {
        break;
      } else {
        lineIndex++;
      }
    }

    // Parse MOTION section
    const frames: THREE.Vector3[][] = [];
    const rotations: THREE.Quaternion[][] = [];
    
    // Parse Frames and Frame Time
    let frameTime = 0;
    
    if (lineIndex < lines.length && lines[lineIndex].toUpperCase().startsWith('MOTION')) {
      lineIndex++;
      
      while (lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        if (line.toUpperCase().startsWith('Frames:')) {
          const match = line.match(/Frames:\s*(\d+)/);
          if (match) {
            numFrames = parseInt(match[1], 10);
          }
        } else if (line.toUpperCase().startsWith('Frame Time:')) {
          const match = line.match(/Frame Time:\s*([\d.]+)/);
          if (match) {
            frameTime = parseFloat(match[1]);
          }
        } else if (line.match(/^\d+/)) {
          // This is a frame data line
          const frameData = this.parseFrameLine(line, hierarchy);
          if (frameData) {
            frames.push(frameData.positions);
            rotations.push(frameData.rotations);
          }
        }
        
        lineIndex++;
      }
    }

    // Build skeleton from hierarchy
    const bones: THREE.Bone[] = [];
    const boneInverses: THREE.Matrix4[] = [];
    
    hierarchy.forEach((node) => {
      const bone = new THREE.Bone();
      bone.name = node.name;
      bone.position.copy(node.offset);
      bones.push(bone);
      boneInverses.push(bone.matrixWorld.clone().invert());
      
      // Set up parent-child relationships
      if (node.parent) {
        const parentBone = bones.find((b) => b.name === node.parent?.name);
        if (parentBone) {
          bone.parent = parentBone;
        }
      }
    });

    const skeleton = new THREE.Skeleton(bones, boneInverses);

    // Create animation clip
    const animation = this.createAnimationClip(hierarchy, frames, rotations, frameTime);

    // Create scene with skeleton
    const scene = new THREE.Group();
    // Skeleton is not an Object3D, so we add bones to the scene instead
    bones.forEach(bone => scene.add(bone));

    return {
      scene,
      animation,
      skeleton,
      hierarchy,
    };
  }

  /**
   * Parse hierarchy line
   */
  private parseHierarchyLine(line: string): BVHNode | null {
    const parts = line.split(/\s+/);
    
    if (parts.length < 2) {
      return null;
    }

    const type = parts[0].toUpperCase();
    const name = parts[1];
    
    if (type === 'ROOT') {
      const offsetMatch = line.match(/OFFSET\s+([\d.-]+\s+[\d.-]+\s+[\d.-]+)/);
      const channelsMatch = line.match(/CHANNELS\s+(.+)/);
      
      if (!offsetMatch || !channelsMatch) {
        return null;
      }

      const offset = this.parseVector3(offsetMatch[1]);
      const channels = channelsMatch[1].split(/\s+/);
      
      return {
        name,
        offset,
        channels,
        children: [],
        index: 0,
      };
    } else if (type === 'JOINT') {
      const offsetMatch = line.match(/OFFSET\s+([\d.-]+\s+[\d.-]+\s+[\d.-]+)/);
      const channelsMatch = line.match(/CHANNELS\s+(.+)/);
      
      if (!offsetMatch || !channelsMatch) {
        return null;
      }

      const offset = this.parseVector3(offsetMatch[1]);
      const channels = channelsMatch[1].split(/\s+/);
      
      return {
        name,
        offset,
        channels,
        children: [],
        index: 0,
      };
    }

    return null;
  }

  /**
   * Parse vector3 from string
   */
  private parseVector3(str: string): THREE.Vector3 {
    const parts = str.split(/\s+/);
    return new THREE.Vector3(
      parseFloat(parts[0]),
      parseFloat(parts[1]),
      parseFloat(parts[2])
    );
  }

  /**
   * Parse frame line
   */
  private parseFrameLine(
    line: string,
    hierarchy: BVHNode[]
  ): { positions: THREE.Vector3[]; rotations: THREE.Quaternion[] } | null {
    const values = line.trim().split(/\s+/).map(parseFloat);
    
    if (values.length === 0) {
      return null;
    }

    const positions: THREE.Vector3[] = [];
    const rotations: THREE.Quaternion[] = [];
    
    let valueIndex = 0;
    hierarchy.forEach((node) => {
      const channels = node.channels;
      
      for (const channel of channels) {
        if (valueIndex >= values.length) {
          break;
        }

        const value = values[valueIndex];
        
        if (channel.includes('Xposition')) {
          if (node.index < positions.length) {
            positions[node.index] = positions[node.index] || new THREE.Vector3();
          }
          positions[node.index].x = value;
        } else if (channel.includes('Yposition')) {
          if (node.index < positions.length) {
            positions[node.index] = positions[node.index] || new THREE.Vector3();
          }
          positions[node.index].y = value;
        } else if (channel.includes('Zposition')) {
          if (node.index < positions.length) {
            positions[node.index] = positions[node.index] || new THREE.Vector3();
          }
          positions[node.index].z = value;
        } else if (channel.includes('Xrotation')) {
          if (node.index < rotations.length) {
            rotations[node.index] = rotations[node.index] || new THREE.Quaternion();
          }
          const euler = new THREE.Euler(value, 0, 0, 'XYZ');
          rotations[node.index].setFromEuler(euler);
        } else if (channel.includes('Yrotation')) {
          if (node.index < rotations.length) {
            rotations[node.index] = rotations[node.index] || new THREE.Quaternion();
          }
          const euler = new THREE.Euler(0, value, 0, 'XYZ');
          rotations[node.index].setFromEuler(euler);
        } else if (channel.includes('Zrotation')) {
          if (node.index < rotations.length) {
            rotations[node.index] = rotations[node.index] || new THREE.Quaternion();
          }
          const euler = new THREE.Euler(0, 0, value, 'XYZ');
          rotations[node.index].setFromEuler(euler);
        }
        
        valueIndex++;
      }
    });

    return { positions, rotations };
  }

  /**
   * Create animation clip from BVH data
   */
  private createAnimationClip(
    hierarchy: BVHNode[],
    frames: THREE.Vector3[][],
    rotations: THREE.Quaternion[][],
    frameTime: number
  ): THREE.AnimationClip {
    const numFrames = frames.length;
    const duration = numFrames * frameTime;
    
    // Create tracks for each bone
    const tracks: THREE.KeyframeTrack[] = [];
    
    hierarchy.forEach((node, index) => {
      if (!node.channels.includes('rotation')) {
        return;
      }

      const times: number[] = [];
      const values: number[] = [];
      
      for (let i = 0; i < numFrames; i++) {
        times.push(i * frameTime);
        
        const rotation = rotations[i][index];
        const euler = new THREE.Euler().setFromQuaternion(rotation);
        
        // Store rotation as XYZ Euler angles
        values.push(euler.x, euler.y, euler.z);
      }
      
      // QuaternionKeyframeTrack constructor: (name: string, times: number[], values: number[])
      const track = new THREE.QuaternionKeyframeTrack(
        node.name,
        times,
        values
      );
      
      tracks.push(track);
    });

    return new THREE.AnimationClip('bvh_animation', duration, tracks);
  }

  /**
   * Update progress
   */
  private updateProgress(
    options: ModelLoadOptions | undefined,
    loaded: number,
    total: number,
    stage: LoadingStage
  ): void {
    if (options?.progressCallback) {
      const percentage = total > 0 ? (loaded / total) * 100 : 0;
      options.progressCallback({
        loaded,
        total,
        percentage,
        stage,
      });
    }
  }

  /**
   * Handle error
   */
  private handleError(error: Error): LoaderError {
    const type: LoaderError['type'] = 'UNKNOWN';
    const message = error.message;

    if (message.includes('not found')) {
      return { type: 'FILE_NOT_FOUND', message, stack: error.stack };
    } else if (message.includes('parse') || message.includes('invalid')) {
      return { type: 'PARSE_ERROR', message, stack: error.stack };
    } else if (message.includes('version')) {
      return { type: 'VERSION_UNSUPPORTED', message, stack: error.stack };
    } else if (message.includes('network') || message.includes('fetch')) {
      return { type: 'NETWORK_ERROR', message, stack: error.stack };
    }

    return { type, message, stack: error.stack };
  }

  /**
   * Dispose loader resources
   */
  dispose(): void {
    // No resources to dispose
  }
}

/**
 * Create singleton instance
 */
export const bvhLoader = new BVHLoaderWrapper();
