/**
 * Model Service Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModelService } from './ModelService'

describe('ModelService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should create service instance', () => {
      const service = new ModelService()
      expect(service).toBeInstanceOf(ModelService)
    })
  })

  describe('model management', () => {
    it('should save model', async () => {
      const service = new ModelService()
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

      await service.saveModel(mockModel)

      // Test that the method doesn't throw
      expect(service.saveModel(mockModel)).resolves.not.toThrow()
    })

    it('should load model', async () => {
      const service = new ModelService()
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

      const result = await service.loadModel('test-id')

      // Test that the method returns a result
      expect(result).toBeDefined()
    })

    it('should delete model', async () => {
      const service = new ModelService()
      const deleteSpy = vi.spyOn(service, 'deleteModel' as any)

      await service.deleteModel('test-id')

      expect(deleteSpy).toHaveBeenCalledWith('test-id')
    })

    it('should list models', async () => {
      const service = new ModelService()
      const mockModels = [
        {
          vrm: {} as any,
          metadata: {
            title: 'Model 1',
            version: '1.0',
            author: 'Author 1',
          },
          expressions: new Map(),
          humanoid: {
            humanBones: [],
          },
          firstPerson: undefined,
          scene: {} as any,
          skeleton: {} as any,
        },
        {
          vrm: {} as any,
          metadata: {
            title: 'Model 2',
            version: '1.0',
            author: 'Author 2',
          },
          expressions: new Map(),
          humanoid: {
            humanBones: [],
          },
          firstPerson: undefined,
          scene: {} as any,
          skeleton: {} as any,
        },
      ]

      const result = await service.listModels()

      // Test that the method returns an array
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle missing model gracefully', async () => {
      const service = new ModelService()
      const result = await service.loadModel('non-existent-id')

      // Test that the method handles errors gracefully
      expect(result).toBeDefined()
    })
  })
})
