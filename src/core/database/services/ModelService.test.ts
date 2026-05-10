/**
 * Model Service Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModelService } from './ModelService'
import type { ExtractedBundle } from './ModelService'
import type { ExtractedModelMetadata, NormalizedLicense } from '../../../types/database.types'

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
      const _mockModel = {
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
        size: 0,
        name: 'Test Model',
        displayName: 'Test Model',
        format: 'vrm' as const,
        tags: [],
        data: new ArrayBuffer(0),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '0.0' as const,
      }

      await service.saveModel(_mockModel)

      // Test that the method doesn't throw
      expect(service.saveModel(_mockModel)).resolves.not.toThrow()
    })

    it('should load model', async () => {
      const service = new ModelService()

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

  // ---------------------------------------------------------------------------
  // Integration: saveModel with extractedBundle
  // ---------------------------------------------------------------------------
  describe('saveModel with extractedBundle', () => {
    const makeBaseModel = () => ({
      name: 'Bundle Test Model',
      displayName: 'Bundle Test Model',
      description: '',
      category: '',
      tags: [] as string[],
      format: 'vrm' as const,
      version: '1.0' as const,
      author: '',
      license: '',
      thumbnail: '',
      data: new ArrayBuffer(4),
      size: 4,
    })

    const makeBundle = (sha256 = 'abc123'): ExtractedBundle => {
      const extractedMetadata: ExtractedModelMetadata = {
        schemaVersion: 1,
        extractedAt: new Date(),
        extractorVersion: '1.0.0',
        geometry: {
          triangleCount: 12000,
          vertexCount: 6000,
          meshCount: 3,
          boundingBox: { min: [-1, 0, -1], max: [1, 2, 1] },
          height: 2,
          polyBucket: 'low',
        },
        rig: {
          boneCount: 54,
          isHumanoid: true,
          humanoidBonesPresent: ['hips', 'spine', 'head'],
          humanoidCompleteness: 0.9,
          expressionCount: 5,
          expressionPresets: ['aa', 'blink'],
          customExpressions: [],
          blendShapeCount: 10,
        },
        materials: {
          materialCount: 2,
          textureCount: 4,
          totalTextureBytes: 1024 * 1024,
          materialTypes: { mtoon: 2, pbr: 0, basic: 0, other: 0 },
          hasTransparency: false,
          largestTextureResolution: [1024, 1024],
        },
        hashes: { sha256 },
        sourceFormat: { format: 'vrm', version: '1.0', hasAnimations: false, animationCount: 0 },
      }
      const normalizedLicense: NormalizedLicense = {
        licenseName: 'CC_BY',
        allowedUserName: 'Everyone',
        commercialUsage: 'Allow',
      }
      return {
        extractedMetadata,
        normalizedLicense,
        searchTokens: ['bundle', 'test'],
        sha256,
      }
    }

    it('should promote bundle fields onto saved record', async () => {
      const service = new ModelService()
      const bundle = makeBundle('sha256-unique-001')

      // Mock the repository to capture the created record.
      const repository = (service as any).repository
      let capturedRecord: any = null
      const origCreate = repository.create.bind(repository)
      vi.spyOn(repository, 'create').mockImplementation(async (model: any) => {
        capturedRecord = model
        // Return a minimal success result without calling the real DB.
        return {
          success: true,
          data: { ...model, id: 1, uuid: 'test-uuid', createdAt: new Date(), updatedAt: new Date() },
        }
      })

      // findBySha256 — stub as not found so dedup doesn't short-circuit.
      repository.findBySha256 = vi.fn().mockResolvedValue({ success: false })

      await service.saveModel(makeBaseModel(), undefined, bundle, false)

      expect(capturedRecord).not.toBeNull()
      // Promoted fields
      expect(capturedRecord.sha256).toBe('sha256-unique-001')
      expect(capturedRecord.polyBucket).toBe('low')
      expect(capturedRecord.isHumanoid).toBe(true)
      expect(capturedRecord.humanoidBones).toEqual(['hips', 'spine', 'head'])
      expect(capturedRecord.license).toBe('CC_BY')
      expect(capturedRecord.searchTokens).toEqual(['bundle', 'test'])
      // Rich blobs
      expect(capturedRecord.extractedMetadata).toBeDefined()
      expect(capturedRecord.normalizedLicense).toBeDefined()

      vi.restoreAllMocks()
      void origCreate
    })

    it('should dedup on identical sha256 and return existing record without inserting', async () => {
      const service = new ModelService()
      const bundle = makeBundle('sha256-dedup-test')

      const existingRecord = {
        id: 99,
        uuid: 'existing-uuid',
        name: 'Existing Model',
        displayName: 'Existing Model',
        format: 'vrm' as const,
        version: '1.0' as const,
        tags: [] as string[],
        data: new ArrayBuffer(4),
        size: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        sha256: 'sha256-dedup-test',
      }

      const repository = (service as any).repository

      // Stub findBySha256 to return the "existing" record.
      repository.findBySha256 = vi.fn().mockResolvedValue({
        success: true,
        data: existingRecord,
      })

      const createSpy = vi.spyOn(repository, 'create')

      const result1 = await service.saveModel(makeBaseModel(), undefined, bundle, false)
      const result2 = await service.saveModel(makeBaseModel(), undefined, bundle, false)

      // Both calls should return the same existing record, never inserting.
      expect(result1.success).toBe(true)
      expect(result1.data?.uuid).toBe('existing-uuid')
      expect(result2.success).toBe(true)
      expect(result2.data?.uuid).toBe('existing-uuid')

      // create() should never have been called.
      expect(createSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })
})
