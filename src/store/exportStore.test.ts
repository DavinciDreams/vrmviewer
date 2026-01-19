/**
 * Export Store Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useExportStore, getQualitySettings, getFormatExtension, getFormatMimeType } from './exportStore'

describe('exportStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useExportStore.getState().reset()
  })

  afterEach(() => {
    // Clean up after each test
    useExportStore.getState().reset()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useExportStore.getState()

      expect(state.options.format).toBe('glb')
      expect(state.options.quality).toBe('high')
      expect(state.options.includeAnimations).toBe(true)
      expect(state.options.includeBlendShapes).toBe(true)
      expect(state.options.includeMaterials).toBe(true)
      expect(state.options.includeTextures).toBe(true)
      expect(state.options.compressTextures).toBe(true)
      expect(state.options.textureQuality).toBe(80)
      expect(state.options.optimizeMesh).toBe(true)
      expect(state.options.mergeMeshes).toBe(false)
      expect(state.options.removeUnusedBones).toBe(true)
      expect(state.options.bakeAnimations).toBe(false)
      expect(state.options.animationSampleRate).toBe(30)
      expect(state.isExporting).toBe(false)
      expect(state.progress).toBe(0)
      expect(state.currentStep).toBe('')
      expect(state.error).toBeNull()
      expect(state.exportedFile).toBeNull()
      expect(state.exportedUrl).toBeNull()
    })
  })

  describe('setOptions', () => {
    it('should set export options', () => {
      const newOptions = {
        format: 'vrm' as const,
        quality: 'ultra' as const,
        includeAnimations: false,
        includeBlendShapes: false,
        includeMaterials: false,
        includeTextures: false,
        compressTextures: false,
        textureQuality: 50,
        optimizeMesh: false,
        mergeMeshes: true,
        removeUnusedBones: false,
        bakeAnimations: true,
        animationSampleRate: 60,
      }

      useExportStore.getState().setOptions(newOptions)

      const state = useExportStore.getState()
      expect(state.options).toEqual(newOptions)
    })

    it('should merge with existing options', () => {
      const existingOptions = {
        format: 'glb' as const,
        quality: 'high' as const,
        includeAnimations: true,
        includeBlendShapes: true,
        includeMaterials: true,
        includeTextures: true,
        compressTextures: true,
        textureQuality: 80,
        optimizeMesh: true,
        mergeMeshes: false,
        removeUnusedBones: true,
        bakeAnimations: false,
        animationSampleRate: 30,
      }

      useExportStore.getState().setOptions(existingOptions)

      const newOptions = {
        format: 'vrm' as const,
        quality: 'ultra' as const,
      }

      useExportStore.getState().setOptions(newOptions)

      const state = useExportStore.getState()
      expect(state.options.format).toBe('vrm')
      expect(state.options.quality).toBe('ultra')
      expect(state.options.includeAnimations).toBe(true) // Preserved
      expect(state.options.includeBlendShapes).toBe(true) // Preserved
      expect(state.options.includeMaterials).toBe(true) // Preserved
      expect(state.options.includeTextures).toBe(true) // Preserved
      expect(state.options.compressTextures).toBe(true) // Preserved
      expect(state.options.textureQuality).toBe(80) // Preserved
      expect(state.options.optimizeMesh).toBe(true) // Preserved
      expect(state.options.mergeMeshes).toBe(false) // Preserved
      expect(state.options.removeUnusedBones).toBe(true) // Preserved
      expect(state.options.bakeAnimations).toBe(false) // Preserved
      expect(state.options.animationSampleRate).toBe(30) // Preserved
    })
  })

  describe('resetOptions', () => {
    it('should reset to default options', () => {
      const customOptions = {
        format: 'vrm' as const,
        quality: 'low' as const,
      }

      useExportStore.getState().setOptions(customOptions)
      useExportStore.getState().resetOptions()

      const state = useExportStore.getState()
      expect(state.options.format).toBe('glb')
      expect(state.options.quality).toBe('high')
    })
  })

  describe('setExporting', () => {
    it('should set exporting state', () => {
      useExportStore.getState().setExporting(true)

      const state = useExportStore.getState()
      expect(state.isExporting).toBe(true)
      expect(state.progress).toBe(0)
      expect(state.error).toBeNull()
    })

    it('should reset progress when starting export', () => {
      useExportStore.getState().setProgress(50)
      useExportStore.getState().setExporting(true)

      const state = useExportStore.getState()
      expect(state.isExporting).toBe(true)
      expect(state.progress).toBe(0)
    })
  })

  describe('setProgress', () => {
    it('should set progress', () => {
      useExportStore.getState().setProgress(75)

      const state = useExportStore.getState()
      expect(state.progress).toBe(75)
    })

    it('should clamp to 100', () => {
      useExportStore.getState().setProgress(150)

      const state = useExportStore.getState()
      expect(state.progress).toBe(100)
    })

    it('should not go below 0', () => {
      useExportStore.getState().setProgress(-10)

      const state = useExportStore.getState()
      expect(state.progress).toBe(0)
    })
  })

  describe('setCurrentStep', () => {
    it('should set current step', () => {
      const step = 'Processing model'

      useExportStore.getState().setCurrentStep(step)

      const state = useExportStore.getState()
      expect(state.currentStep).toBe(step)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Export failed: Invalid format'

      useExportStore.getState().setError(errorMessage)

      const state = useExportStore.getState()
      expect(state.error).toBe(errorMessage)
    })

    it('should stop exporting when error is set', () => {
      useExportStore.getState().setExporting(true)
      useExportStore.getState().setError('Error message')

      const state = useExportStore.getState()
      expect(state.isExporting).toBe(false)
      expect(state.progress).toBe(0)
    })
  })

  describe('setExportedFile', () => {
    it('should set exported file', () => {
      const mockFile = new File(['content'], 'export.vrm')

      useExportStore.getState().setExportedFile(mockFile)

      const state = useExportStore.getState()
      expect(state.exportedFile).toEqual(mockFile)
      expect(state.isExporting).toBe(false)
      expect(state.progress).toBe(100)
    })
  })

  describe('setExportedUrl', () => {
    it('should set exported URL', () => {
      const mockUrl = 'blob:http://test-url'

      useExportStore.getState().setExportedUrl(mockUrl)

      const state = useExportStore.getState()
      expect(state.exportedUrl).toBe(mockUrl)
    })
  })

  describe('reset', () => {
    it('should reset to initial state', () => {
      const customOptions = {
        format: 'vrm' as const,
        quality: 'low' as const,
      }

      useExportStore.getState().setOptions(customOptions)
      useExportStore.getState().setProgress(50)
      useExportStore.getState().setError('Error message')

      useExportStore.getState().reset()

      const state = useExportStore.getState()
      expect(state.options.format).toBe('glb')
      expect(state.options.quality).toBe('high')
      expect(state.isExporting).toBe(false)
      expect(state.progress).toBe(0)
      expect(state.currentStep).toBe('')
      expect(state.error).toBeNull()
      expect(state.exportedFile).toBeNull()
      expect(state.exportedUrl).toBeNull()
    })
  })

  describe('getQualitySettings', () => {
    it('should return low quality settings', () => {
      const settings = getQualitySettings('low')

      expect(settings.textureQuality).toBe(50)
      expect(settings.meshOptimization).toBe(true)
    })

    it('should return medium quality settings', () => {
      const settings = getQualitySettings('medium')

      expect(settings.textureQuality).toBe(70)
      expect(settings.meshOptimization).toBe(true)
    })

    it('should return high quality settings', () => {
      const settings = getQualitySettings('high')

      expect(settings.textureQuality).toBe(80)
      expect(settings.meshOptimization).toBe(true)
    })

    it('should return ultra quality settings', () => {
      const settings = getQualitySettings('ultra')

      expect(settings.textureQuality).toBe(95)
      expect(settings.meshOptimization).toBe(false)
    })
  })

  describe('getFormatExtension', () => {
    it('should return extension for gltf', () => {
      const extension = getFormatExtension('gltf')
      expect(extension).toBe('.gltf')
    })

    it('should return extension for glb', () => {
      const extension = getFormatExtension('glb')
      expect(extension).toBe('.glb')
    })

    it('should return extension for vrm', () => {
      const extension = getFormatExtension('vrm')
      expect(extension).toBe('.vrm')
    })

    it('should return extension for fbx', () => {
      const extension = getFormatExtension('fbx')
      expect(extension).toBe('.fbx')
    })

    it('should return extension for bvh', () => {
      const extension = getFormatExtension('bvh')
      expect(extension).toBe('.bvh')
    })

    it('should return default extension for unknown format', () => {
      const extension = getFormatExtension('unknown' as any)
      expect(extension).toBe('.glb')
    })
  })

  describe('getFormatMimeType', () => {
    it('should return MIME type for gltf', () => {
      const mimeType = getFormatMimeType('gltf')
      expect(mimeType).toBe('model/gltf+json')
    })

    it('should return MIME type for glb', () => {
      const mimeType = getFormatMimeType('glb')
      expect(mimeType).toBe('model/gltf-binary')
    })

    it('should return MIME type for vrm', () => {
      const mimeType = getFormatMimeType('vrm')
      expect(mimeType).toBe('model/vrm')
    })

    it('should return MIME type for fbx', () => {
      const mimeType = getFormatMimeType('fbx')
      expect(mimeType).toBe('application/octet-stream')
    })

    it('should return MIME type for bvh', () => {
      const mimeType = getFormatMimeType('bvh')
      expect(mimeType).toBe('application/octet-stream')
    })

    it('should return default MIME type for unknown format', () => {
      const mimeType = getFormatMimeType('unknown' as any)
      expect(mimeType).toBe('model/gltf-binary')
    })
  })
})
