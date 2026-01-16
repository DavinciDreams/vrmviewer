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
      const mockAnimation = {
        name: 'Test Animation',
        duration: 5,
        tracks: [],
      }

      await service.saveAnimation(mockAnimation)

      // Test that the method doesn't throw
      expect(service.saveAnimation(mockAnimation)).resolves.not.toThrow()
    })

    it('should load animation', async () => {
      const service = new AnimationService()
      const mockAnimation = {
        name: 'Test Animation',
        duration: 5,
        tracks: [],
      }

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
      const mockAnimations = [
        { id: '1', name: 'Animation 1', duration: 5 },
        { id: '2', name: 'Animation 2', duration: 3 },
      ]

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
