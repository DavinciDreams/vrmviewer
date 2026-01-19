/**
 * File Utilities Tests
 */

import {
  readFileAsText,
  readFileAsArrayBuffer,
  readFileAsDataURL,
  getFileInfo,
  validateModelFile,
  validateAnimationFile,
  detectFileType,
  createObjectURL,
  revokeObjectURL,
} from './fileUtils'

// Mock the formats constants
vi.mock('../constants/formats', () => ({
  getFileExtension: (filename: string) => filename.split('.').pop()?.toLowerCase() || '',
  getFormatFromExtension: (ext: string) => ext,
  getFileTypeFromExtension: (ext: string) => {
    const modelFormats = ['vrm', 'gltf', 'glb', 'fbx']
    const animationFormats = ['vrma', 'bvh']
    if (modelFormats.includes(ext)) return 'model'
    if (animationFormats.includes(ext)) return 'animation'
    return 'unknown'
  },
  isFileSupported: (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const supportedFormats = ['vrm', 'gltf', 'glb', 'fbx', 'vrma', 'bvh']
    return supportedFormats.includes(ext)
  },
  validateFileSize: (file: File) => {
    const maxSize = 100 * 1024 * 1024 // 100MB
    return file.size <= maxSize
  },
  formatFileSize: (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },
}))

describe('fileUtils', () => {
  describe('readFileAsText', () => {
    it('should read file as text', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const result = await readFileAsText(file)
      expect(result).toBe('test content')
    })

    it('should handle empty file', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' })
      const result = await readFileAsText(file)
      expect(result).toBe('')
    })
  })

  describe('readFileAsArrayBuffer', () => {
    it('should read file as ArrayBuffer', async () => {
      const content = 'test content'
      const file = new File([content], 'test.txt', { type: 'text/plain' })
      const result = await readFileAsArrayBuffer(file)
      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBe(content.length)
    })
  })

  describe('readFileAsDataURL', () => {
    it('should read file as Data URL', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const result = await readFileAsDataURL(file)
      expect(result).toMatch(/^data:text\/plain;base64,/)
    })

    it('should handle file read error', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      // Mock FileReader to error
      vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
        setTimeout(() => {
          this.onerror?.({} as ProgressEvent<FileReader>)
        }, 0)
      })

      await expect(readFileAsDataURL(file)).rejects.toThrow()
    })
  })

  describe('getFileInfo', () => {
    it('should return file info for VRM file', () => {
      const file = new File(['content'], 'model.vrm', { type: 'application/octet-stream' })
      const info = getFileInfo(file)

      expect(info.name).toBe('model.vrm')
      expect(info.size).toBe(7) // 'content'.length
      expect(info.type).toBe('model')
      expect(info.format).toBe('vrm')
      expect(info.lastModified).toBeInstanceOf(Date)
    })

    it('should return file info for VRMA file', () => {
      const file = new File(['content'], 'animation.vrma', { type: 'application/octet-stream' })
      const info = getFileInfo(file)

      expect(info.name).toBe('animation.vrma')
      expect(info.type).toBe('animation')
      expect(info.format).toBe('vrma')
    })

    it('should return file info for GLB file', () => {
      const file = new File(['content'], 'model.glb', { type: 'application/octet-stream' })
      const info = getFileInfo(file)

      expect(info.name).toBe('model.glb')
      expect(info.type).toBe('model')
      expect(info.format).toBe('glb')
    })

    it('should return file info for BVH file', () => {
      const file = new File(['content'], 'animation.bvh', { type: 'text/plain' })
      const info = getFileInfo(file)

      expect(info.name).toBe('animation.bvh')
      expect(info.type).toBe('animation')
      expect(info.format).toBe('bvh')
    })
  })

  describe('validateModelFile', () => {
    it('should validate supported VRM file', () => {
      const file = new File(['content'], 'model.vrm', { type: 'application/octet-stream' })
      const result = validateModelFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate supported GLTF file', () => {
      const file = new File(['content'], 'model.gltf', { type: 'application/json' })
      const result = validateModelFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject unsupported file format', () => {
      const file = new File(['content'], 'model.xyz', { type: 'application/octet-stream' })
      const result = validateModelFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unsupported file format')
    })

    it('should reject file that exceeds size limit', () => {
      const largeContent = 'x'.repeat(101 * 1024 * 1024) // > 100MB
      const file = new File([largeContent], 'large.vrm', { type: 'application/octet-stream' })
      const result = validateModelFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('File size exceeds limit')
    })
  })

  describe('validateAnimationFile', () => {
    it('should validate supported VRMA file', () => {
      const file = new File(['content'], 'animation.vrma', { type: 'application/octet-stream' })
      const result = validateAnimationFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate supported BVH file', () => {
      const file = new File(['content'], 'animation.bvh', { type: 'text/plain' })
      const result = validateAnimationFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject unsupported animation format', () => {
      const file = new File(['content'], 'animation.xyz', { type: 'text/plain' })
      const result = validateAnimationFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unsupported file format')
    })

    it('should reject animation file that exceeds size limit', () => {
      const largeContent = 'x'.repeat(101 * 1024 * 1024) // > 100MB
      const file = new File([largeContent], 'large.vrma', { type: 'application/octet-stream' })
      const result = validateAnimationFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('File size exceeds limit')
    })
  })

  describe('detectFileType', () => {
    it('should detect GLB file from signature', async () => {
      const glbHeader = new Uint8Array([0x67, 0x6c, 0x54, 0x46]) // 'glTF'
      const arrayBuffer = glbHeader.buffer
      const result = await detectFileType(arrayBuffer)

      expect(result).toEqual({ format: 'glb', type: 'model' })
    })

    it('should detect FBX file from signature', async () => {
      const fbxHeader = new Uint8Array([0x4b, 0x61, 0x79, 0x64]) // 'Kayd'
      const arrayBuffer = fbxHeader.buffer
      const result = await detectFileType(arrayBuffer)

      expect(result).toEqual({ format: 'fbx', type: 'model' })
    })

    it('should detect BVH file from content', async () => {
      const bvhContent = 'HIERARCHY\nROOT Hips\n{'
      const encoder = new TextEncoder()
      const arrayBuffer = encoder.encode(bvhContent).buffer
      const result = await detectFileType(arrayBuffer)

      expect(result).toEqual({ format: 'bvh', type: 'animation' })
    })

    it('should return null for unknown file type', async () => {
      const unknownHeader = new Uint8Array([0x00, 0x00, 0x00, 0x00])
      const arrayBuffer = unknownHeader.buffer
      const result = await detectFileType(arrayBuffer)

      expect(result).toBeNull()
    })

    it('should handle case-insensitive BVH detection', async () => {
      const bvhContent = 'hierarchy\nROOT Hips\n{'
      const encoder = new TextEncoder()
      const arrayBuffer = encoder.encode(bvhContent).buffer
      const result = await detectFileType(arrayBuffer)

      expect(result).toEqual({ format: 'bvh', type: 'animation' })
    })
  })

  describe('createObjectURL', () => {
    it('should create object URL from file', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const url = createObjectURL(file)

      expect(url).toMatch(/^blob:/)
      expect(typeof url).toBe('string')
    })
  })

  describe('revokeObjectURL', () => {
    it('should revoke object URL', () => {
      const url = 'blob:http://localhost/test'
      expect(() => revokeObjectURL(url)).not.toThrow()
    })
  })
})
