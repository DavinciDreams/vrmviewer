/**
 * Select Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from './Select'

describe('Select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render select with options', () => {
      const options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' },
      ]

      render(<Select options={options} />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('should render select with label', () => {
      render(<Select label="Test Label" options={[]} />)

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
    })

    it('should render select with error', () => {
      render(<Select error="Invalid selection" options={[]} />)

      expect(screen.getByText('Invalid selection')).toBeInTheDocument()
    })

    it('should render select with helper text', () => {
      render(<Select helperText="Choose an option" options={[]} />)

      expect(screen.getByText('Choose an option')).toBeInTheDocument()
    })

    it('should render custom className', () => {
      render(<Select className="custom-class" options={[]} />)

      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('custom-class')
    })
  })

  describe('user interactions', () => {
    it('should allow selecting an option', () => {
      const handleChange = vi.fn()
      const options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ]

      render(<Select options={options} onChange={handleChange} />)

      const select = screen.getByRole('combobox')
      fireEvent.click(select)
      fireEvent.click(screen.getByText('Option 1'))

      expect(handleChange).toHaveBeenCalledWith('option1')
    })

    it('should not call onChange when disabled', () => {
      const handleChange = vi.fn()
      const options = [
        { value: 'option1', label: 'Option 1' },
      ]

      render(<Select options={options} onChange={handleChange} disabled />)

      const select = screen.getByRole('combobox')
      fireEvent.click(select)

      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have correct label association', () => {
      render(<Select label="Test Label" options={[]} />)

      const select = screen.getByRole('combobox')
      const label = screen.getByLabelText('Test Label')
      expect(select).toHaveAttribute('id', label.getAttribute('for'))
    })

    it('should be focusable', () => {
      render(<Select options={[]} />)

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('tabIndex', '0')
    })
  })
})
