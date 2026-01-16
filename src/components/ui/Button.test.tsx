/**
 * Button Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Button', () => {
  describe('rendering', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Click me')
    })

    it('should render primary variant', () => {
      render(<Button variant="primary">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-blue-600')
    })

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-gray-600')
    })

    it('should render danger variant', () => {
      render(<Button variant="danger">Delete</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-red-600')
    })

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Cancel</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-transparent')
    })

    it('should render small size', () => {
      render(<Button size="sm">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-3 py-1.5 text-sm')
    })

    it('should render medium size', () => {
      render(<Button size="md">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-4 py-2 text-base')
    })

    it('should render large size', () => {
      render(<Button size="lg">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-6 py-3 text-lg')
    })

    it('should render loading state', () => {
      render(<Button loading>Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('disabled:opacity-50')
      expect(button).toBeDisabled()
    })

    it('should render disabled state', () => {
      render(<Button disabled>Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:opacity-50')
    })

    it('should render custom className', () => {
      render(<Button className="custom-class">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('interactions', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn()
      render(<Button loading onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should be focusable', () => {
      render(<Button>Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('tabIndex', '0')
    })

    it('should not be focusable when disabled', () => {
      render(<Button disabled>Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })
  })
})
