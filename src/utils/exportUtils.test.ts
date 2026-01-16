/**
 * Export Utilities Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  downloadFile,
  createExportProgress,
  createExportResult,
  createExportError,
  formatFileSize,
  validateExportOptions,
  generateExportFilename,
  getExportQualityInfo,
  getExportCompressionInfo,
  calculateProgressPercentage,
  estimateExportTime,
  isExportSupported,
  getExportFormatExtension,
  validateBlobSize,
  getMimeTypeForFormat,
  sanitizeFilename,
  createExportSummary,
  ExportProgressTracker,
} from './exportUtils'

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

describe('exportUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('downloadFile', () => {
    it('should download file using saveAs', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })
      const filename = 'test.txt'

      downloadFile(blob, filename)

      // Test that function doesn't throw
      expect(() => downloadFile(blob, filename)).not.toThrow()
    })
  })

  describe('createExportProgress', () => {
    it('should create export progress object', () => {
      const progress = createExportProgress('PREPARING', 50, 'Preparing export', 2, 4)

      expect(progress.stage).toBe('PREPARING')
      expect(progress.progress).toBe(50)
      expect(progress.message).toBe('Preparing export')
      expect(progress.currentStep).toBe(2)
      expect(progress.totalSteps).toBe(4)
    })
  })

  describe('createExportResult', () => {
    it('should create successful export result', () => {
      const result = createExportResult(true, { filename: 'test.vrm' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ filename: 'test.vrm' })
      expect(result.error).toBeUndefined()
    })

    it('should create failed export result', () => {
      const error = { type: 'validation' as const, message: 'Invalid data' }
      const result = createExportResult(false, undefined, { type: 'INVALID_FORMAT' as any, message: 'Invalid data' })

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toEqual(error)
    })
  })

  describe('createExportError', () => {
    it('should create export error', () => {
      const error = createExportError('INVALID_FORMAT' as any, 'Invalid data', { field: 'name' }, 'PREPARING')

      expect(error.type).toBe('INVALID_FORMAT')
      expect(error.message).toBe('Invalid data')
      expect(error.details).toEqual({ field: 'name' })
      expect(error.stage).toBe('PREPARING')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
      expect(formatFileSize(500)).toBe('500 Bytes')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })
  })

  describe('validateExportOptions', () => {
    it('should validate valid options', () => {
      const options = {
        name: 'test',
        format: 'vrm',
        metadata: { title: 'Test', author: 'Author' },
      }
      const result = validateExportOptions(options)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should reject missing name', () => {
      const options = { format: 'vrm' }
      const result = validateExportOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('name')
      expect(result.errors[0].code).toBe('NAME_REQUIRED')
    })

    it('should reject empty name', () => {
      const options = { name: '', format: 'vrm' }
      const result = validateExportOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('NAME_REQUIRED')
    })

    it('should reject missing format', () => {
      const options = { name: 'test' }
      const result = validateExportOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors[0].field).toBe('format')
      expect(result.errors[0].code).toBe('FORMAT_REQUIRED')
    })

    it('should warn about incomplete metadata', () => {
      const options = {
        name: 'test',
        format: 'vrm',
        metadata: {},
      }
      const result = validateExportOptions(options)

      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].code).toBe('METADATA_INCOMPLETE')
    })
  })

  describe('generateExportFilename', () => {
    it('should generate filename with extension', () => {
      const filename = generateExportFilename('test model', 'vrm')
      expect(filename).toBe('test_model.vrm')
    })

    it('should generate filename with version', () => {
      const filename = generateExportFilename('test model', 'vrm', '1.0')
      expect(filename).toBe('test_model_1.0.vrm')
    })

    it('should sanitize filename', () => {
      const filename = generateExportFilename('test/model@name', 'vrm')
      expect(filename).toBe('test_model_name.vrm')
    })
  })

  describe('getExportQualityInfo', () => {
    it('should return low quality info', () => {
      const info = getExportQualityInfo('low')

      expect(info.name).toBe('Low')
      expect(info.compressionLevel).toBe(0.5)
      expect(info.textureQuality).toBe(512)
      expect(info.meshSimplification).toBe(0.8)
    })

    it('should return medium quality info', () => {
      const info = getExportQualityInfo('medium')

      expect(info.name).toBe('Medium')
      expect(info.compressionLevel).toBe(0.7)
      expect(info.textureQuality).toBe(1024)
    })

    it('should return high quality info', () => {
      const info = getExportQualityInfo('high')

      expect(info.name).toBe('High')
      expect(info.compressionLevel).toBe(0.85)
      expect(info.textureQuality).toBe(2048)
    })

    it('should return ultra quality info', () => {
      const info = getExportQualityInfo('ultra')

      expect(info.name).toBe('Ultra')
      expect(info.compressionLevel).toBe(1.0)
      expect(info.textureQuality).toBe(4096)
    })
  })

  describe('getExportCompressionInfo', () => {
    it('should return none compression info', () => {
      const info = getExportCompressionInfo('none')

      expect(info.name).toBe('None')
      expect(info.compressionRatio).toBe(1.0)
      expect(info.supportedFormats).toContain('vrm')
    })

    it('should return draco compression info', () => {
      const info = getExportCompressionInfo('draco')

      expect(info.name).toBe('Draco')
      expect(info.compressionRatio).toBe(0.6)
      expect(info.description).toContain('Draco')
    })

    it('should return meshopt compression info', () => {
      const info = getExportCompressionInfo('meshopt')

      expect(info.name).toBe('Meshopt')
      expect(info.compressionRatio).toBe(0.5)
    })
  })

  describe('calculateProgressPercentage', () => {
    it('should calculate progress percentage', () => {
      const percentage = calculateProgressPercentage(5, 10)
      expect(percentage).toBe(50)
    })

    it('should handle zero total steps', () => {
      const percentage = calculateProgressPercentage(5, 0)
      expect(percentage).toBe(0)
    })

    it('should handle completion', () => {
      const percentage = calculateProgressPercentage(10, 10)
      expect(percentage).toBe(100)
    })
  })

  describe('estimateExportTime', () => {
    it('should estimate export time for medium quality', () => {
      const time = estimateExportTime(1024 * 1024, 'medium') // 1MB
      expect(time).toBe(1)
    })

    it('should estimate longer time for low quality', () => {
      const time = estimateExportTime(1024 * 1024, 'low') // 1MB
      expect(time).toBe(2)
    })

    it('should estimate shorter time for high quality', () => {
      const time = estimateExportTime(1024 * 1024, 'high') // 1MB
      expect(time).toBe(0.5)
    })

    it('should estimate shortest time for ultra quality', () => {
      const time = estimateExportTime(1024 * 1024, 'ultra') // 1MB
      expect(time).toBe(0.25)
    })
  })

  describe('isExportSupported', () => {
    it('should support VRM format', () => {
      expect(isExportSupported('vrm')).toBe(true)
    })

    it('should support VRMA format', () => {
      expect(isExportSupported('vrma')).toBe(true)
    })

    it('should support GLTF format', () => {
      expect(isExportSupported('gltf')).toBe(true)
    })

    it('should support GLB format', () => {
      expect(isExportSupported('glb')).toBe(true)
    })

    it('should not support unknown format', () => {
      expect(isExportSupported('xyz')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isExportSupported('VRM')).toBe(true)
      expect(isExportSupported('VrMa')).toBe(true)
    })
  })

  describe('getExportFormatExtension', () => {
    it('should return extension for VRM', () => {
      expect(getExportFormatExtension('vrm')).toBe('vrm')
    })

    it('should return extension for VRMA', () => {
      expect(getExportFormatExtension('vrma')).toBe('vrma')
    })

    it('should return extension for GLTF', () => {
      expect(getExportFormatExtension('gltf')).toBe('gltf+json')
    })

    it('should return extension for GLB', () => {
      expect(getExportFormatExtension('glb')).toBe('glb')
    })

    it('should return bin for unknown format', () => {
      expect(getExportFormatExtension('unknown')).toBe('bin')
    })
  })

  describe('validateBlobSize', () => {
    it('should validate blob within size limit', () => {
      const blob = new Blob(['content'], { type: 'text/plain' })
      expect(validateBlobSize(blob, 1024)).toBe(true)
    })

    it('should reject blob exceeding size limit', () => {
      const largeContent = 'x'.repeat(1025)
      const blob = new Blob([largeContent], { type: 'text/plain' })
      expect(validateBlobSize(blob, 1024)).toBe(false)
    })

    it('should use default size limit', () => {
      const blob = new Blob(['content'], { type: 'text/plain' })
      expect(validateBlobSize(blob)).toBe(true) // Default 500MB
    })
  })

  describe('getMimeTypeForFormat', () => {
    it('should return MIME type for VRM', () => {
      expect(getMimeTypeForFormat('vrm')).toBe('application/octet-stream')
    })

    it('should return MIME type for VRMA', () => {
      expect(getMimeTypeForFormat('vrma')).toBe('application/octet-stream')
    })

    it('should return MIME type for GLTF', () => {
      expect(getMimeTypeForFormat('gltf')).toBe('model/gltf+json')
    })

    it('should return MIME type for GLB', () => {
      expect(getMimeTypeForFormat('glb')).toBe('model/gltf-binary')
    })

    it('should return default MIME type for unknown format', () => {
      expect(getMimeTypeForFormat('unknown')).toBe('application/octet-stream')
    })
  })

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      const sanitized = sanitizeFilename('test/file:name*?.txt')
      expect(sanitized).toBe('test_file_name__.txt')
    })

    it('should remove path traversal attempts', () => {
      const sanitized = sanitizeFilename('../etc/passwd')
      expect(sanitized).toBe('.._etc_passwd')
    })

    it('should remove control characters', () => {
      const sanitized = sanitizeFilename('test\x00file')
      expect(sanitized).toBe('testfile')
    })
  })

  describe('createExportSummary', () => {
    it('should create summary for successful export', () => {
      const result = {
        success: true,
        data: {
          filename: 'test.vrm',
          size: 1024 * 1024,
          format: 'vrm',
        },
      }
      const summary = createExportSummary(result)

      expect(summary).toContain('File: test.vrm')
      expect(summary).toContain('Format: vrm')
      expect(summary).toContain('Size: 1 MB')
    })

    it('should include duration if present', () => {
      const result = {
        success: true,
        data: {
          filename: 'test.vrma',
          size: 1024 * 1024,
          format: 'vrma',
          duration: 5.5,
        },
      }
      const summary = createExportSummary(result)

      expect(summary).toContain('Duration: 5.50s')
    })

    it('should return failure message for failed export', () => {
      const result = {
        success: false,
        error: { type: 'validation' as const, message: 'Invalid data' },
      }
      const summary = createExportSummary(result)

      expect(summary).toBe('Export failed')
    })
  })

  describe('ExportProgressTracker', () => {
    it('should track export progress', () => {
      const callback = vi.fn()
      const tracker = new ExportProgressTracker(callback)

      tracker.update({
        stage: 'preparing',
        progress: 50,
        message: 'Preparing',
        currentStep: 1,
        totalSteps: 2,
      })

      expect(callback).toHaveBeenCalled()
    })

    it('should throttle updates', () => {
      const callback = vi.fn()
      const tracker = new ExportProgressTracker(callback)

      // First update should trigger callback
      tracker.update({
        stage: 'preparing',
        progress: 25,
        message: 'Preparing',
        currentStep: 1,
        totalSteps: 4,
      })

      // Immediate second update should be throttled
      tracker.update({
        stage: 'preparing',
        progress: 50,
        message: 'Preparing',
        currentStep: 2,
        totalSteps: 4,
      })

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should complete tracking', () => {
      const callback = vi.fn()
      const tracker = new ExportProgressTracker(callback)

      tracker.complete()

      expect(callback).toHaveBeenCalledWith({
        stage: 'COMPLETE',
        progress: 100,
        message: 'Export complete',
        currentStep: 1,
        totalSteps: 1,
      })
    })

    it('should calculate time remaining', () => {
      const callback = vi.fn()
      const tracker = new ExportProgressTracker(callback)

      tracker.update({
        stage: 'preparing',
        progress: 50,
        message: 'Preparing',
        currentStep: 1,
        totalSteps: 2,
      })

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
      expect(lastCall.timeRemaining).toBeGreaterThanOrEqual(0)
    })
  })
})
