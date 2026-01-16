/**
 * Naming Utilities Tests
 */

import {
  generateDescriptiveName,
  generateUniqueName,
  findNextAvailableNumber,
  hasNameConflict,
  suggestNames,
  sanitizeName,
  validateName,
  generateUUIDName,
  parseNameNumber,
  extractBaseName,
  generateSuggestedName,
  generateNameVariations,
  formatNameForDisplay,
  generateTimestampedName,
  createBackupName,
  areNamesSimilar,
  sortNamesByType,
  isAnimationName,
  isModelName,
  getNameSuggestions,
} from './namingUtils'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => '12345678-1234-1234-1234-123456789abc',
}))

describe('namingUtils', () => {
  describe('generateDescriptiveName', () => {
    it('should generate name from description with multiple keywords', () => {
      const name = generateDescriptiveName('A quick walk animation for character')
      expect(name).toBe('quickwalk')
    })

    it('should generate name from single keyword', () => {
      const name = generateDescriptiveName('walk')
      expect(name).toBe('walk')
    })

    it('should return fallback for short description', () => {
      const name = generateDescriptiveName('hi')
      expect(['animation', 'motion', 'action', 'pose']).toContain(name)
    })

    it('should handle empty description', () => {
      const name = generateDescriptiveName('')
      expect(['animation', 'motion', 'action', 'pose']).toContain(name)
    })
  })

  describe('generateUniqueName', () => {
    it('should generate unique name without conflicts', () => {
      const name = generateUniqueName('animation', [])
      expect(name).toBe('animation1')
    })

    it('should add number when conflict exists', () => {
      const name = generateUniqueName('animation', ['animation1', 'animation2'])
      expect(name).toBe('animation3')
    })

    it('should sanitize base name', () => {
      const name = generateUniqueName('test name!', [])
      expect(name).toBe('test_name1')
    })
  })

  describe('findNextAvailableNumber', () => {
    it('should return 1 for no existing names', () => {
      const number = findNextAvailableNumber('animation', [])
      expect(number).toBe(1)
    })

    it('should find next available number', () => {
      const number = findNextAvailableNumber('animation', ['animation1', 'animation2'])
      expect(number).toBe(3)
    })

    it('should skip gaps in numbering', () => {
      const number = findNextAvailableNumber('animation', ['animation1', 'animation3'])
      expect(number).toBe(2)
    })
  })

  describe('hasNameConflict', () => {
    it('should return true when name exists', () => {
      const hasConflict = hasNameConflict('animation1', ['animation1', 'animation2'])
      expect(hasConflict).toBe(true)
    })

    it('should return false when name does not exist', () => {
      const hasConflict = hasNameConflict('animation3', ['animation1', 'animation2'])
      expect(hasConflict).toBe(false)
    })

    it('should be case sensitive', () => {
      const hasConflict = hasNameConflict('Animation1', ['animation1'])
      expect(hasConflict).toBe(false)
    })
  })

  describe('suggestNames', () => {
    it('should suggest names based on pattern', () => {
      const suggestions = suggestNames('animation', 5)
      expect(suggestions).toEqual(['animation1', 'animation2', 'animation3', 'animation4', 'animation5'])
    })

    it('should use default count of 5', () => {
      const suggestions = suggestNames('test')
      expect(suggestions).toHaveLength(5)
    })

    it('should respect custom count', () => {
      const suggestions = suggestNames('test', 3)
      expect(suggestions).toHaveLength(3)
    })
  })

  describe('sanitizeName', () => {
    it('should replace special characters with underscores', () => {
      const name = sanitizeName('test@name#here!')
      expect(name).toBe('test_name_here_')
    })

    it('should remove consecutive underscores', () => {
      const name = sanitizeName('test___name')
      expect(name).toBe('test_name')
    })

    it('should remove leading/trailing underscores and hyphens', () => {
      const name = sanitizeName('_-test-name-_')
      expect(name).toBe('test-name')
    })

    it('should trim whitespace', () => {
      const name = sanitizeName('  test name  ')
      expect(name).toBe('test_name')
    })

    it('should return "unnamed" for empty result', () => {
      const name = sanitizeName('!!!')
      expect(name).toBe('unnamed')
    })

    it('should limit length to 100 characters', () => {
      const longName = 'a'.repeat(150)
      const sanitized = sanitizeName(longName)
      expect(sanitized.length).toBe(100)
    })

    it('should preserve alphanumeric characters', () => {
      const name = sanitizeName('TestName123')
      expect(name).toBe('TestName123')
    })

    it('should preserve hyphens and underscores', () => {
      const name = sanitizeName('test-name_here')
      expect(name).toBe('test-name_here')
    })
  })

  describe('validateName', () => {
    it('should validate valid name', () => {
      const result = validateName('test_name')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject empty name', () => {
      const result = validateName('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Name cannot be empty')
    })

    it('should reject whitespace-only name', () => {
      const result = validateName('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Name cannot be empty')
    })

    it('should reject name exceeding 100 characters', () => {
      const result = validateName('a'.repeat(101))
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Name cannot exceed 100 characters')
    })

    it('should reject Windows reserved names', () => {
      const result = validateName('con_test')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('invalid')
    })

    it('should reject name starting with dot', () => {
      const result = validateName('.hidden')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('invalid')
    })
  })

  describe('generateUUIDName', () => {
    it('should generate UUID-based name with prefix', () => {
      const name = generateUUIDName('item')
      expect(name).toMatch(/^item_[a-f0-9]{8}$/)
    })

    it('should use default prefix', () => {
      const name = generateUUIDName()
      expect(name).toMatch(/^item_[a-f0-9]{8}$/)
    })

    it('should use custom prefix', () => {
      const name = generateUUIDName('animation')
      expect(name).toMatch(/^animation_[a-f0-9]{8}$/)
    })
  })

  describe('parseNameNumber', () => {
    it('should parse numbered name', () => {
      const result = parseNameNumber('animation123')
      expect(result.baseName).toBe('animation')
      expect(result.number).toBe(123)
    })

    it('should handle name without number', () => {
      const result = parseNameNumber('animation')
      expect(result.baseName).toBe('animation')
      expect(result.number).toBeNull()
    })

    it('should parse name with multiple numbers', () => {
      const result = parseNameNumber('animation123test')
      expect(result.baseName).toBe('animation123test')
      expect(result.number).toBeNull()
    })
  })

  describe('extractBaseName', () => {
    it('should extract base name from numbered name', () => {
      const baseName = extractBaseName('animation123')
      expect(baseName).toBe('animation')
    })

    it('should return original name without number', () => {
      const baseName = extractBaseName('animation')
      expect(baseName).toBe('animation')
    })
  })

  describe('generateSuggestedName', () => {
    it('should generate name from description', () => {
      const name = generateSuggestedName('base', [], 'A quick walk')
      expect(name).toContain('quick')
    })

    it('should add number if conflict exists', () => {
      const name = generateSuggestedName('animation', ['animation'], 'walk')
      expect(name).toBe('animation1')
    })

    it('should use base name without description', () => {
      const name = generateSuggestedName('animation', [])
      expect(name).toBe('animation')
    })
  })

  describe('generateNameVariations', () => {
    it('should generate variations with prefixes', () => {
      const variations = generateNameVariations('walk')
      expect(variations).toContain('slowlywalk')
      expect(variations).toContain('quicklywalk')
    })

    it('should generate variations with suffixes', () => {
      const variations = generateNameVariations('walk')
      expect(variations).toContain('walkrun')
      expect(variations).toContain('walkjump')
    })

    it('should include base name', () => {
      const variations = generateNameVariations('walk')
      expect(variations).toContain('walk')
    })
  })

  describe('formatNameForDisplay', () => {
    it('should replace underscores with spaces', () => {
      const formatted = formatNameForDisplay('test_name_here')
      expect(formatted).toBe('test name here')
    })

    it('should handle name without underscores', () => {
      const formatted = formatNameForDisplay('testname')
      expect(formatted).toBe('testname')
    })
  })

  describe('generateTimestampedName', () => {
    it('should generate name with timestamp', () => {
      const name = generateTimestampedName('animation')
      expect(name).toMatch(/^animation_\d{8}$/)
    })

    it('should use base name', () => {
      const name = generateTimestampedName('test')
      expect(name).toContain('test_')
    })
  })

  describe('createBackupName', () => {
    it('should create backup name with timestamp', () => {
      const backupName = createBackupName('animation')
      expect(backupName).toMatch(/^animation_backup_\d{8}$/)
    })

    it('should preserve original name', () => {
      const backupName = createBackupName('test_animation')
      expect(backupName).toContain('test_animation')
    })
  })

  describe('areNamesSimilar', () => {
    it('should detect similar names with different numbers', () => {
      const similar = areNamesSimilar('animation1', 'animation2')
      expect(similar).toBe(true)
    })

    it('should detect similar names ignoring case', () => {
      const similar = areNamesSimilar('Animation1', 'animation2')
      expect(similar).toBe(true)
    })

    it('should detect different names', () => {
      const similar = areNamesSimilar('animation1', 'walk1')
      expect(similar).toBe(false)
    })

    it('should handle names without numbers', () => {
      const similar = areNamesSimilar('animation', 'animation')
      expect(similar).toBe(true)
    })
  })

  describe('sortNamesByType', () => {
    it('should sort names into animations and models', () => {
      const names = ['animation1', 'character', 'animation2', 'model']
      const sorted = sortNamesByType(names)

      expect(sorted.animations).toEqual(['animation1', 'animation2'])
      expect(sorted.models).toEqual(['character', 'model'])
    })

    it('should handle empty array', () => {
      const sorted = sortNamesByType([])

      expect(sorted.animations).toEqual([])
      expect(sorted.models).toEqual([])
    })
  })

  describe('isAnimationName', () => {
    it('should detect animation keywords', () => {
      expect(isAnimationName('walk_animation')).toBe(true)
      expect(isAnimationName('run_fast')).toBe(true)
      expect(isAnimationName('jump_high')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(isAnimationName('Walk')).toBe(true)
      expect(isAnimationName('DANCE')).toBe(true)
    })

    it('should reject non-animation names', () => {
      expect(isAnimationName('character')).toBe(false)
      expect(isAnimationName('model')).toBe(false)
    })
  })

  describe('isModelName', () => {
    it('should detect model keywords', () => {
      expect(isModelName('character_model')).toBe(true)
      expect(isModelName('avatar_skin')).toBe(true)
      expect(isModelName('outfit_clothing')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(isModelName('Character')).toBe(true)
      expect(isModelName('MODEL')).toBe(true)
    })

    it('should reject non-model names', () => {
      expect(isModelName('walk')).toBe(false)
      expect(isModelName('animation')).toBe(false)
    })
  })

  describe('getNameSuggestions', () => {
    it('should generate suggestions from input', () => {
      const suggestions = getNameSuggestions('walk', [], 10)
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0]).toContain('walk')
    })

    it('should include variations', () => {
      const suggestions = getNameSuggestions('test', [])
      expect(suggestions).toContain('test')
      expect(suggestions.some(s => s.includes('slowly'))).toBe(true)
    })

    it('should include numbered versions', () => {
      const suggestions = getNameSuggestions('test', [])
      expect(suggestions).toContain('test1')
      expect(suggestions).toContain('test2')
    })

    it('should respect max suggestions', () => {
      const suggestions = getNameSuggestions('test', [], 5)
      expect(suggestions.length).toBeLessThanOrEqual(5)
    })
  })
})
