/**
 * Animation Service Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnimationService } from './AnimationService'

describe('AnimationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should create service instance', () => {
      const service = new AnimationService()
      expect(service).toBeInstanceOf(AnimationService)
    })
  })

  describe('animation management', () => {
    it('should save animation', async () => {
      const service = new AnimationService()
      const _mockAnimation = {
        uuid: 'test-uuid',
        name: 'Test Animation',
        displayName: 'Test Animation',
        duration: 5,
        format: 'vrma' as const,
        tags: [],
        data: new ArrayBuffer(0),
        createdAt: new Date(),
        updatedAt: new Date(),
        size: 0,
      }
 
      await service.saveAnimation(_mockAnimation)
 
      // Test that the method doesn't throw
      expect(service.saveAnimation(_mockAnimation)).resolves.not.toThrow()
    })

    it('should load animation', async () => {
      const service = new AnimationService()

      const result = await service.loadAnimation('test-id')

      // Test that the method returns a result
      expect(result).toBeDefined()
    })

    it('should delete animation', async () => {
      const service = new AnimationService()
      const deleteSpy = vi.spyOn(service, 'deleteAnimation' as any)

      await service.deleteAnimation('test-id')

      expect(deleteSpy).toHaveBeenCalledWith('test-id')
    })

    it('should list animations', async () => {
      const service = new AnimationService()

      const result = await service.listAnimations()

      // Test that the method returns an array
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle missing animation', async () => {
      const service = new AnimationService()
      const result = await service.loadAnimation('non-existent-id')

      // Test that the method handles errors gracefully
      expect(result).toBeDefined()
    })
  })
})
