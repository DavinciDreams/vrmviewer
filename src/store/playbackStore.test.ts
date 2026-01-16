/**
 * Playback Store Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { usePlaybackStore } from './playbackStore'

describe('playbackStore', () => {
  beforeEach(() => {
    // Reset store before each test
    usePlaybackStore.getState().reset()
  })

  afterEach(() => {
    // Clean up after each test
    usePlaybackStore.getState().reset()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = usePlaybackStore.getState()

      expect(state.isPlaying).toBe(false)
      expect(state.isPaused).toBe(false)
      expect(state.isStopped).toBe(true)
      expect(state.currentTime).toBe(0)
      expect(state.duration).toBe(0)
      expect(state.speed).toBe(1)
      expect(state.loop).toBe(true)
      expect(state.currentAnimationId).toBeNull()
      expect(state.currentAnimationName).toBeNull()
    })
  })

  describe('play', () => {
    it('should start playback', () => {
      usePlaybackStore.getState().play()

      const state = usePlaybackStore.getState()
      expect(state.isPlaying).toBe(true)
      expect(state.isPaused).toBe(false)
      expect(state.isStopped).toBe(false)
    })
  })

  describe('pause', () => {
    it('should pause playback', () => {
      usePlaybackStore.getState().play()
      usePlaybackStore.getState().pause()

      const state = usePlaybackStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.isPaused).toBe(true)
      expect(state.isStopped).toBe(false)
    })
  })

  describe('stop', () => {
    it('should stop playback', () => {
      usePlaybackStore.getState().play()
      usePlaybackStore.getState().stop()

      const state = usePlaybackStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.isPaused).toBe(false)
      expect(state.isStopped).toBe(true)
      expect(state.currentTime).toBe(0)
    })
  })

  describe('seek', () => {
    it('should seek to time', () => {
      usePlaybackStore.getState().setDuration(10)
      usePlaybackStore.getState().seek(5)

      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(5)
    })

    it('should clamp to duration', () => {
      usePlaybackStore.getState().setDuration(10)
      usePlaybackStore.getState().seek(15)

      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(10)
    })

    it('should not go below zero', () => {
      usePlaybackStore.getState().setDuration(10)
      usePlaybackStore.getState().seek(-5)

      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(0)
    })
  })

  describe('setSpeed', () => {
    it('should set playback speed', () => {
      usePlaybackStore.getState().setSpeed(2)

      const state = usePlaybackStore.getState()
      expect(state.speed).toBe(2)
    })

    it('should clamp minimum speed', () => {
      usePlaybackStore.getState().setSpeed(0)

      const state = usePlaybackStore.getState()
      expect(state.speed).toBe(0.1)
    })

    it('should clamp maximum speed', () => {
      usePlaybackStore.getState().setSpeed(10)

      const state = usePlaybackStore.getState()
      expect(state.speed).toBe(5)
    })
  })

  describe('setLoop', () => {
    it('should set loop state', () => {
      usePlaybackStore.getState().setLoop(false)

      const state = usePlaybackStore.getState()
      expect(state.loop).toBe(false)
    })
  })

  describe('setCurrentAnimation', () => {
    it('should set current animation', () => {
      usePlaybackStore.getState().setCurrentAnimation('test-id', 'Test Animation')

      const state = usePlaybackStore.getState()
      expect(state.currentAnimationId).toBe('test-id')
      expect(state.currentAnimationName).toBe('Test Animation')
      expect(state.currentTime).toBe(0)
      expect(state.isPlaying).toBe(false)
      expect(state.isPaused).toBe(false)
      expect(state.isStopped).toBe(true)
    })
  })

  describe('clearCurrentAnimation', () => {
    it('should clear current animation', () => {
      usePlaybackStore.getState().setCurrentAnimation('test-id', 'Test Animation')
      usePlaybackStore.getState().clearCurrentAnimation()

      const state = usePlaybackStore.getState()
      expect(state.currentAnimationId).toBeNull()
      expect(state.currentAnimationName).toBeNull()
      expect(state.currentTime).toBe(0)
    })
  })

  describe('updateCurrentTime', () => {
    it('should update current time', () => {
      usePlaybackStore.getState().setDuration(10)
      usePlaybackStore.getState().updateCurrentTime(5)

      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(5)
    })

    it('should clamp to duration', () => {
      usePlaybackStore.getState().setDuration(10)
      usePlaybackStore.getState().updateCurrentTime(15)

      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(10)
    })

    it('should not go below zero', () => {
      usePlaybackStore.getState().setDuration(10)
      usePlaybackStore.getState().updateCurrentTime(-5)

      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(0)
    })
  })

  describe('setDuration', () => {
    it('should set duration', () => {
      usePlaybackStore.getState().setDuration(10)

      const state = usePlaybackStore.getState()
      expect(state.duration).toBe(10)
    })

    it('should not allow negative duration', () => {
      usePlaybackStore.getState().setDuration(-5)

      const state = usePlaybackStore.getState()
      expect(state.duration).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset to initial state', () => {
      usePlaybackStore.getState().setSpeed(2)
      usePlaybackStore.getState().setLoop(false)
      usePlaybackStore.getState().setCurrentAnimation('test-id', 'Test Animation')

      usePlaybackStore.getState().reset()

      const state = usePlaybackStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.isPaused).toBe(false)
      expect(state.isStopped).toBe(true)
      expect(state.currentTime).toBe(0)
      expect(state.duration).toBe(0)
      expect(state.speed).toBe(1)
      expect(state.loop).toBe(true)
      expect(state.currentAnimationId).toBeNull()
      expect(state.currentAnimationName).toBeNull()
    })
  })
})
