/**
 * Animation Utilities Tests
 */

import * as THREE from 'three'
import { AnimationClip, VectorKeyframeTrack, QuaternionKeyframeTrack } from 'three'
import {
  createAnimationClip,
  createKeyframeTrack,
  createIdleAnimationClip,
  createBlinkAnimationClip,
  createLipSyncAnimationClip,
  interpolateAnimationClips,
  scaleAnimationDuration,
  loopAnimationClip,
  reverseAnimationClip,
  getAnimationClipDuration,
  getAnimationClipKeyframeCount,
  getAnimationClipTrackCount,
  validateAnimationClip,
  formatTime,
  parseTime,
} from './animationUtils'

// Mock VRM
const mockVRM = {
  humanoid: {
    getNormalizedBoneNode: vi.fn(),
  },
  expressionManager: {
    hasExpression: vi.fn(),
  },
}

describe('animationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAnimationClip', () => {
    it('should create animation clip from data', () => {
      const data = {
        name: 'test',
        duration: 1,
        tracks: [
          {
            name: 'bone.position',
            type: 'position' as const,
            keyframes: [
              { time: 0, value: new THREE.Vector3(0, 0, 0) },
              { time: 1, value: new THREE.Vector3(1, 1, 1) },
            ],
          },
        ],
      }

      const clip = createAnimationClip(data)

      expect(clip).toBeInstanceOf(AnimationClip)
      expect(clip.name).toBe('test')
      expect(clip.duration).toBe(1)
      expect(clip.tracks).toHaveLength(1)
    })

    it('should create clip with multiple tracks', () => {
      const data = {
        name: 'test',
        duration: 1,
        tracks: [
          {
            name: 'bone.position',
            type: 'position' as const,
            keyframes: [{ time: 0, value: new THREE.Vector3(0, 0, 0) }],
          },
          {
            name: 'bone.rotation',
            type: 'rotation' as const,
            keyframes: [{ time: 0, value: new THREE.Quaternion() }],
          },
        ],
      }

      const clip = createAnimationClip(data)

      expect(clip.tracks).toHaveLength(2)
    })
  })

  describe('createKeyframeTrack', () => {
    it('should create position track', () => {
      const data = {
        name: 'bone.position',
        type: 'position' as const,
        keyframes: [
          { time: 0, value: new THREE.Vector3(0, 0, 0) },
          { time: 1, value: new THREE.Vector3(1, 1, 1) },
        ],
      }

      const track = createKeyframeTrack(data)

      expect(track).toBeInstanceOf(VectorKeyframeTrack)
      expect(track?.name).toBe('bone.position')
    })

    it('should create rotation track', () => {
      const data = {
        name: 'bone.rotation',
        type: 'rotation' as const,
        keyframes: [
          { time: 0, value: new THREE.Quaternion() },
          { time: 1, value: new THREE.Quaternion() },
        ],
      }

      const track = createKeyframeTrack(data)

      expect(track).toBeInstanceOf(QuaternionKeyframeTrack)
      expect(track?.name).toBe('bone.rotation')
    })

    it('should create scale track', () => {
      const data = {
        name: 'bone.scale',
        type: 'scale' as const,
        keyframes: [
          { time: 0, value: new THREE.Vector3(1, 1, 1) },
          { time: 1, value: new THREE.Vector3(2, 2, 2) },
        ],
      }

      const track = createKeyframeTrack(data)

      expect(track).toBeInstanceOf(VectorKeyframeTrack)
      expect(track?.name).toBe('bone.scale')
    })

    it('should return null for unknown track type', () => {
      const data = {
        name: 'bone.unknown',
        type: 'unknown' as 'position' | 'rotation' | 'scale',
        keyframes: [{ time: 0, value: new THREE.Vector3(0, 0, 0) }],
      }

      const track = createKeyframeTrack(data)

      expect(track).toBeNull()
    })
  })

  describe('createIdleAnimationClip', () => {
    it('should create idle animation clip', () => {
      const mockBone = new THREE.Object3D()
      mockBone.name = 'spine'
      mockVRM.humanoid.getNormalizedBoneNode.mockReturnValue(mockBone)

      const clip = createIdleAnimationClip(mockVRM as any, 3)

      expect(clip).toBeInstanceOf(AnimationClip)
      expect(clip.name).toBe('idle')
      expect(clip.duration).toBe(3)
    })

    it('should handle missing bones', () => {
      mockVRM.humanoid.getNormalizedBoneNode.mockReturnValue(null)

      const clip = createIdleAnimationClip(mockVRM as any, 3)

      expect(clip.tracks).toHaveLength(0)
    })
  })

  describe('createBlinkAnimationClip', () => {
    it('should create blink animation clip', () => {
      mockVRM.expressionManager.hasExpression.mockReturnValue(true)

      const clip = createBlinkAnimationClip(mockVRM as any, 0.15)

      expect(clip).toBeInstanceOf(AnimationClip)
      expect(clip.name).toBe('blink')
      expect(clip.duration).toBe(0.15)
    })

    it('should handle missing expression manager', () => {
      const clip = createBlinkAnimationClip({ expressionManager: null } as any, 0.15)

      expect(clip.tracks).toHaveLength(0)
    })

    it('should handle missing expressions', () => {
      mockVRM.expressionManager.hasExpression.mockReturnValue(false)

      const clip = createBlinkAnimationClip(mockVRM as any, 0.15)

      expect(clip.tracks).toHaveLength(0)
    })
  })

  describe('createLipSyncAnimationClip', () => {
    it('should create lip sync animation clip', () => {
      mockVRM.expressionManager.hasExpression.mockReturnValue(true)

      const visemes = [
        { time: 0, shape: 'aa', weight: 1 },
        { time: 0.5, shape: 'aa', weight: 0 },
      ]

      const clip = createLipSyncAnimationClip(mockVRM as any, visemes, 1)

      expect(clip).toBeInstanceOf(AnimationClip)
      expect(clip.name).toBe('lipSync')
      expect(clip.duration).toBe(1)
    })

    it('should handle missing expression manager', () => {
      const clip = createLipSyncAnimationClip({ expressionManager: null } as any, [], 1)

      expect(clip.tracks).toHaveLength(0)
    })
  })

  describe('interpolateAnimationClips', () => {
    it('should interpolate two clips', () => {
      const clip1 = new AnimationClip('clip1', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])
      const clip2 = new AnimationClip('clip2', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 2, 2, 2]),
      ])

      const interpolated = interpolateAnimationClips(clip1, clip2)

      expect(interpolated).toBeInstanceOf(AnimationClip)
      expect(interpolated.name).toBe('interpolated')
    })

    it('should handle clips with different durations', () => {
      const clip1 = new AnimationClip('clip1', 1, [])
      const clip2 = new AnimationClip('clip2', 2, [])

      const interpolated = interpolateAnimationClips(clip1, clip2)

      expect(interpolated.duration).toBe(2)
    })
  })

  describe('scaleAnimationDuration', () => {
    it('should scale animation duration', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])

      const scaled = scaleAnimationDuration(clip, 2)

      expect(scaled.duration).toBe(2)
      expect(scaled.tracks[0].times[0]).toBe(0)
      expect(scaled.tracks[0].times[1]).toBe(2)
    })

    it('should handle scale factor less than 1', () => {
      const clip = new AnimationClip('test', 2, [
        new VectorKeyframeTrack('bone.position', [0, 2], [0, 0, 0, 2, 2, 2]),
      ])

      const scaled = scaleAnimationDuration(clip, 0.5)

      expect(scaled.duration).toBe(1)
    })
  })

  describe('loopAnimationClip', () => {
    it('should loop animation clip', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])

      const looped = loopAnimationClip(clip, 2)

      expect(looped.duration).toBe(2)
      expect(looped.tracks[0].times.length).toBe(4)
    })

    it('should loop animation clip once by default', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])

      const looped = loopAnimationClip(clip)

      expect(looped.duration).toBe(1)
    })
  })

  describe('reverseAnimationClip', () => {
    it('should reverse animation clip', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])

      const reversed = reverseAnimationClip(clip)

      expect(reversed.duration).toBe(1)
      expect(reversed.tracks[0].times[0]).toBe(1)
      expect(reversed.tracks[0].times[1]).toBe(0)
    })

    it('should preserve track values order', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])

      const reversed = reverseAnimationClip(clip)

      expect(reversed.tracks[0].values[0]).toBe(0)
      expect(reversed.tracks[0].values[3]).toBe(1)
    })
  })

  describe('getAnimationClipDuration', () => {
    it('should return clip duration', () => {
      const clip = new AnimationClip('test', 5, [])
      const duration = getAnimationClipDuration(clip)

      expect(duration).toBe(5)
    })
  })

  describe('getAnimationClipKeyframeCount', () => {
    it('should return keyframe count', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1, 2], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
        new QuaternionKeyframeTrack('bone.rotation', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      ])
      const count = getAnimationClipKeyframeCount(clip)

      expect(count).toBe(5)
    })

    it('should return 0 for clip with no tracks', () => {
      const clip = new AnimationClip('test', 1, [])
      const count = getAnimationClipKeyframeCount(clip)

      expect(count).toBe(0)
    })
  })

  describe('getAnimationClipTrackCount', () => {
    it('should return track count', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0], [0, 0, 0]),
        new QuaternionKeyframeTrack('bone.rotation', [0], [0, 0, 0, 1]),
      ])
      const count = getAnimationClipTrackCount(clip)

      expect(count).toBe(2)
    })

    it('should return 0 for clip with no tracks', () => {
      const clip = new AnimationClip('test', 1, [])
      const count = getAnimationClipTrackCount(clip)

      expect(count).toBe(0)
    })
  })

  describe('validateAnimationClip', () => {
    it('should validate valid clip', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [0, 1], [0, 0, 0, 1, 1, 1]),
      ])
      const result = validateAnimationClip(clip)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject clip with negative duration', () => {
      const clip = new AnimationClip('test', -1, [])
      const result = validateAnimationClip(clip)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Animation clip duration must be positive')
    })

    it('should reject clip with no tracks', () => {
      const clip = new AnimationClip('test', 1, [])
      const result = validateAnimationClip(clip)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Animation clip must have at least one track')
    })

    it('should reject clip with track having no keyframes', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [], []),
      ])
      const result = validateAnimationClip(clip)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('has no keyframes')
    })

    it('should reject clip with negative times', () => {
      const clip = new AnimationClip('test', 1, [
        new VectorKeyframeTrack('bone.position', [-1, 0], [0, 0, 0, 1, 1, 1]),
      ])
      const result = validateAnimationClip(clip)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('negative time')
    })
  })

  describe('formatTime', () => {
    it('should format time in seconds', () => {
      const formatted = formatTime(5.5)
      expect(formatted).toBe('00:05.50')
    })

    it('should format time with minutes', () => {
      const formatted = formatTime(125.75)
      expect(formatted).toBe('02:05.75')
    })

    it('should format time with hours', () => {
      const formatted = formatTime(3661.25)
      expect(formatted).toBe('61:01.25')
    })

    it('should format zero time', () => {
      const formatted = formatTime(0)
      expect(formatted).toBe('00:00.00')
    })
  })

  describe('parseTime', () => {
    it('should parse time in MM:SS format', () => {
      const time = parseTime('02:30')
      expect(time).toBe(150)
    })

    it('should parse time in HH:MM:SS format', () => {
      const time = parseTime('01:02:30')
      expect(time).toBe(3750)
    })

    it('should parse time as seconds', () => {
      const time = parseTime('30')
      expect(time).toBe(30)
    })

    it('should parse decimal time', () => {
      const time = parseTime('30.5')
      expect(time).toBe(30.5)
    })
  })
})
