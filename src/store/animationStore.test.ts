/**
 * Animation Store Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { useAnimationStore } from './animationStore'

describe('animationStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAnimationStore.getState().clearAnimation()
    useAnimationStore.getState().clearError()
  })

  afterEach(() => {
    // Clean up after each test
    useAnimationStore.getState().clearAnimation()
    useAnimationStore.getState().clearError()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAnimationStore.getState()

      expect(state.currentAnimation).toBeNull()
      expect(state.animations).toBeInstanceOf(Map)
      expect(state.animations.size).toBe(0)
      expect(state.playbackState.isPlaying).toBe(false)
      expect(state.playbackState.isPaused).toBe(false)
      expect(state.playbackState.isLooping).toBe(false)
      expect(state.playbackState.currentTime).toBe(0)
      expect(state.playbackState.duration).toBe(0)
      expect(state.playbackState.speed).toBe(1)
      expect(state.playbackState.weight).toBe(1)
      expect(state.playbackState.fadeIn).toBe(0)
      expect(state.playbackState.fadeOut).toBe(0)
      expect(state.error).toBeNull()
      expect(state.metadata).toBeNull()
      expect(state.animationManager).toBeNull()
      expect(state.blendShapeManager).toBeNull()
      expect(state.idleAnimationController).toBeNull()
    })
  })

  describe('setAnimation', () => {
    it('should set current animation', () => {
      const mockAnimation = {
        name: 'test-animation',
        duration: 5,
        tracks: [],
      } as any

      useAnimationStore.getState().setAnimation(mockAnimation)

      const state = useAnimationStore.getState()
      expect(state.currentAnimation).toEqual(mockAnimation)
    })

    it('should clear error when setting animation', () => {
      useAnimationStore.getState().setError('Previous error')

      const mockAnimation = {
        name: 'test-animation',
        duration: 5,
        tracks: [],
      } as any

      useAnimationStore.getState().setAnimation(mockAnimation)

      const state = useAnimationStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setAnimations', () => {
    it('should set animations map', () => {
      const animations = new Map([
        ['anim1', { name: 'Animation 1', duration: 5, tracks: [] } as any],
        ['anim2', { name: 'Animation 2', duration: 3, tracks: [] } as any],
      ])

      useAnimationStore.getState().setAnimations(animations)

      const state = useAnimationStore.getState()
      expect(state.animations).toEqual(animations)
      expect(state.animations.size).toBe(2)
    })
  })

  describe('setPlaybackState', () => {
    it('should set playback state', () => {
      const playbackState = {
        isPlaying: true,
        isPaused: false,
        isLooping: true,
        currentTime: 2.5,
        duration: 5,
        speed: 1.5,
        weight: 1,
        fadeIn: 0.5,
        fadeOut: 0.5,
        blendMode: THREE.NormalAnimationBlendMode,
      }

      useAnimationStore.getState().setPlaybackState(playbackState)

      const state = useAnimationStore.getState()
      expect(state.playbackState).toEqual(playbackState)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Failed to load animation'

      useAnimationStore.getState().setError(errorMessage)

      const state = useAnimationStore.getState()
      expect(state.error).toBe(errorMessage)
    })

    it('should preserve other state when setting error', () => {
      const mockAnimation = {
        name: 'test-animation',
        duration: 5,
        tracks: [],
      } as any

      useAnimationStore.getState().setAnimation(mockAnimation)
      useAnimationStore.getState().setError('Error message')

      const state = useAnimationStore.getState()
      expect(state.currentAnimation).toEqual(mockAnimation)
      expect(state.error).toBe('Error message')
    })
  })

  describe('clearError', () => {
    it('should clear error message', () => {
      useAnimationStore.getState().setError('Error message')

      useAnimationStore.getState().clearError()

      const state = useAnimationStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setMetadata', () => {
    it('should set metadata', () => {
      const metadata = {
        name: 'Test Animation',
        format: 'vrma',
        duration: 5,
      }

      useAnimationStore.getState().setMetadata(metadata)

      const state = useAnimationStore.getState()
      expect(state.metadata).toEqual(metadata)
    })

    it('should preserve other state when setting metadata', () => {
      const mockAnimation = {
        name: 'test-animation',
        duration: 5,
        tracks: [],
      } as any

      useAnimationStore.getState().setAnimation(mockAnimation)

      const metadata = {
        name: 'Test Animation',
        format: 'vrma',
        duration: 5,
      }

      useAnimationStore.getState().setMetadata(metadata)

      const state = useAnimationStore.getState()
      expect(state.currentAnimation).toEqual(mockAnimation)
      expect(state.metadata).toEqual(metadata)
    })
  })

  describe('clearAnimation', () => {
    it('should clear animation and metadata', () => {
      const mockAnimation = {
        name: 'test-animation',
        duration: 5,
        tracks: [],
      } as any

      useAnimationStore.getState().setAnimation(mockAnimation)
      useAnimationStore.getState().clearAnimation()

      const state = useAnimationStore.getState()
      expect(state.currentAnimation).toBeNull()
      expect(state.metadata).toBeNull()
    })

    it('should clear error when clearing animation', () => {
      useAnimationStore.getState().setError('Error message')
      useAnimationStore.getState().clearAnimation()

      const state = useAnimationStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('manager actions', () => {
    it('should set animation manager', () => {
      const mockManager = { dispose: vi.fn() } as any

      useAnimationStore.getState().setAnimationManager(mockManager)

      const state = useAnimationStore.getState()
      expect(state.animationManager).toEqual(mockManager)
    })

    it('should set blend shape manager', () => {
      const mockManager = { dispose: vi.fn() } as any

      useAnimationStore.getState().setBlendShapeManager(mockManager)

      const state = useAnimationStore.getState()
      expect(state.blendShapeManager).toEqual(mockManager)
    })

    it('should set idle animation controller', () => {
      const mockController = { dispose: vi.fn() } as any

      useAnimationStore.getState().setIdleAnimationController(mockController)

      const state = useAnimationStore.getState()
      expect(state.idleAnimationController).toEqual(mockController)
    })

    it('should initialize managers', () => {
      const mockVRM = {} as any
      const mockManager = { initialize: vi.fn() } as any
      const mockBlendManager = { initialize: vi.fn() } as any
      const mockController = { initialize: vi.fn() } as any

      useAnimationStore.getState().setAnimationManager(mockManager)
      useAnimationStore.getState().setBlendShapeManager(mockBlendManager)
      useAnimationStore.getState().setIdleAnimationController(mockController)

      useAnimationStore.getState().initializeManagers(mockVRM)

      expect(mockManager.initialize).toHaveBeenCalledWith(mockVRM)
      expect(mockBlendManager.initialize).toHaveBeenCalledWith(mockVRM)
      expect(mockController.initialize).toHaveBeenCalledWith(mockVRM, mockBlendManager)
    })

    it('should dispose managers', () => {
      const mockManager = { dispose: vi.fn() } as any
      const mockBlendManager = { dispose: vi.fn() } as any
      const mockController = { dispose: vi.fn() } as any

      useAnimationStore.getState().setAnimationManager(mockManager)
      useAnimationStore.getState().setBlendShapeManager(mockBlendManager)
      useAnimationStore.getState().setIdleAnimationController(mockController)

      useAnimationStore.getState().disposeManagers()

      expect(mockManager.dispose).toHaveBeenCalled()
      expect(mockBlendManager.dispose).toHaveBeenCalled()
      expect(mockController.dispose).toHaveBeenCalled()

      const state = useAnimationStore.getState()
      expect(state.animationManager).toBeNull()
      expect(state.blendShapeManager).toBeNull()
      expect(state.idleAnimationController).toBeNull()
    })
  })
})
