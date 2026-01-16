/**
 * VRM Store Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useVRMStore } from './vrmStore'

describe('vrmStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useVRMStore.getState().clearModel()
    useVRMStore.getState().clearError()
  })

  afterEach(() => {
    // Clean up after each test
    useVRMStore.getState().clearModel()
    useVRMStore.getState().clearError()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useVRMStore.getState()

      expect(state.currentModel).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.metadata).toBeNull()
    })
  })

  describe('setModel', () => {
    it('should set current model', () => {
      const mockModel = {
        vrm: {} as any,
        metadata: {
          title: 'Test Model',
          version: '1.0',
          author: 'Test Author',
        },
        expressions: new Map(),
        humanoid: {
          humanBones: [],
        },
        firstPerson: undefined,
        scene: {} as any,
        skeleton: {} as any,
      }

      useVRMStore.getState().setModel(mockModel)

      const state = useVRMStore.getState()
      expect(state.currentModel).toEqual(mockModel)
    })

    it('should clear error when setting model', () => {
      useVRMStore.getState().setError('Previous error')

      const mockModel = {
        vrm: {} as any,
        metadata: {
          title: 'Test Model',
          version: '1.0',
          author: 'Test Author',
        },
        expressions: new Map(),
        humanoid: {
          humanBones: [],
        },
        firstPerson: undefined,
        scene: {} as any,
        skeleton: {} as any,
      }

      useVRMStore.getState().setModel(mockModel)

      const state = useVRMStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      useVRMStore.getState().setLoading(true)

      const state = useVRMStore.getState()
      expect(state.isLoading).toBe(true)
    })

    it('should clear error when setting loading', () => {
      useVRMStore.getState().setError('Previous error')
      useVRMStore.getState().setLoading(true)

      const state = useVRMStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Failed to load model'

      useVRMStore.getState().setError(errorMessage)

      const state = useVRMStore.getState()
      expect(state.error).toBe(errorMessage)
    })

    it('should preserve other state when setting error', () => {
      const mockModel = {
        vrm: {} as any,
        metadata: {
          title: 'Test Model',
          version: '1.0',
          author: 'Test Author',
        },
        expressions: new Map(),
        humanoid: {
          humanBones: [],
        },
        firstPerson: undefined,
        scene: {} as any,
        skeleton: {} as any,
      }

      useVRMStore.getState().setModel(mockModel)
      useVRMStore.getState().setError('Error message')

      const state = useVRMStore.getState()
      expect(state.currentModel).toEqual(mockModel)
      expect(state.error).toBe('Error message')
    })
  })

  describe('clearError', () => {
    it('should clear error message', () => {
      useVRMStore.getState().setError('Error message')

      useVRMStore.getState().clearError()

      const state = useVRMStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setMetadata', () => {
    it('should set metadata', () => {
      const metadata = {
        name: 'Test Model',
        version: '1.0',
        author: 'Test Author',
      }

      useVRMStore.getState().setMetadata(metadata)

      const state = useVRMStore.getState()
      expect(state.metadata).toEqual(metadata)
    })

    it('should preserve other state when setting metadata', () => {
      const mockModel = {
        vrm: {} as any,
        metadata: {
          title: 'Test Model',
          version: '1.0',
          author: 'Test Author',
        },
        expressions: new Map(),
        humanoid: {
          humanBones: [],
        },
        firstPerson: undefined,
        scene: {} as any,
        skeleton: {} as any,
      }

      useVRMStore.getState().setModel(mockModel)

      const metadata = {
        name: 'Test Model',
        version: '1.0',
        author: 'Test Author',
      }

      useVRMStore.getState().setMetadata(metadata)

      const state = useVRMStore.getState()
      expect(state.currentModel).toEqual(mockModel)
      expect(state.metadata).toEqual(metadata)
    })
  })

  describe('clearModel', () => {
    it('should clear model and metadata', () => {
      const mockModel = {
        vrm: {} as any,
        metadata: {
          title: 'Test Model',
          version: '1.0',
          author: 'Test Author',
        },
        expressions: new Map(),
        humanoid: {
          humanBones: [],
        },
        firstPerson: undefined,
        scene: {} as any,
        skeleton: {} as any,
      }

      useVRMStore.getState().setModel(mockModel)
      useVRMStore.getState().clearModel()

      const state = useVRMStore.getState()
      expect(state.currentModel).toBeNull()
      expect(state.metadata).toBeNull()
    })

    it('should clear error when clearing model', () => {
      useVRMStore.getState().setError('Error message')
      useVRMStore.getState().clearModel()

      const state = useVRMStore.getState()
      expect(state.error).toBeNull()
    })
  })
})
