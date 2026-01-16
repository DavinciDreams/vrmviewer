/**
 * Input Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from './Input'

describe('Input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render input with label', () => {
      render(<Input label="Test Label" />)

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
    })

    it('should render input with error', () => {
      render(<Input error="Invalid input" />)

      expect(screen.getByText('Invalid input')).toBeInTheDocument()
    })

    it('should render input with helper text', () => {
      render(<Input helperText="Enter your name" />)

      expect(screen.getByText('Enter your name')).toBeInTheDocument()
    })

    it('should render custom className', () => {
      render(<Input className="custom-class" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')
    })
  })

  describe('user interactions', () => {
    it('should allow typing', () => {
      render(<Input />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'test value' } })

      expect(input).toHaveValue('test value')
    })

    it('should show error when provided', () => {
      render(<Input error="This field is required" />)

      const error = screen.getByText('This field is required')
      expect(error).toBeInTheDocument()
    })

    it('should show helper text when provided', () => {
      render(<Input helperText="Enter at least 3 characters" />)

      const helper = screen.getByText('Enter at least 3 characters')
      expect(helper).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have correct label association', () => {
      render(<Input label="Test Label" />)

      const input = screen.getByRole('textbox')
      const label = screen.getByLabelText('Test Label')
      expect(input).toHaveAttribute('id')
      expect(label).toHaveAttribute('for', input.getAttribute('id'))
    })

    it('should be focusable', () => {
      render(<Input />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('tabIndex', '0')
    })
  })
})
