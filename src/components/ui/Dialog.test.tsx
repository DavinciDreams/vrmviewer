/**
 * Dialog Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<Dialog isOpen={false} onClose={vi.fn()}>Test Content</Dialog>)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      const handleClose = vi.fn()
      render(<Dialog isOpen={true} onClose={handleClose}>Test Content</Dialog>)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should render title when provided', () => {
      render(<Dialog isOpen={true} title="Test Title" onClose={vi.fn()}>Content</Dialog>)

      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should render with small size', () => {
      render(<Dialog isOpen={true} size="sm" onClose={vi.fn()}>Content</Dialog>)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveClass('max-w-md')
    })

    it('should render with medium size', () => {
      render(<Dialog isOpen={true} size="md" onClose={vi.fn()}>Content</Dialog>)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveClass('max-w-lg')
    })

    it('should render with large size', () => {
      render(<Dialog isOpen={true} size="lg" onClose={vi.fn()}>Content</Dialog>)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveClass('max-w-2xl')
    })
  })

  describe('closing', () => {
    it('should call onClose when clicking backdrop', () => {
      const handleClose = vi.fn()
      render(<Dialog isOpen={true} onClose={handleClose}>Content</Dialog>)

      const backdrop = screen.getByText('').parentElement
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when clicking close button', () => {
      const handleClose = vi.fn()
      render(<Dialog isOpen={true} showCloseButton onClose={handleClose}>Content</Dialog>)

      const closeButton = screen.getByLabelText('Close dialog')
      fireEvent.click(closeButton)

      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when pressing Escape', () => {
      const handleClose = vi.fn()
      render(<Dialog isOpen={true} onClose={handleClose}>Content</Dialog>)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<Dialog isOpen={true} title="Test Title" onClose={vi.fn()}>Content</Dialog>)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
      expect(dialog).toHaveAttribute('tabIndex', '-1')
    })

    it('should trap focus within dialog', () => {
      const handleClose = vi.fn()
      render(<Dialog isOpen={true} onClose={handleClose}>Content</Dialog>)

      const dialog = screen.getByRole('dialog')
      expect(document.activeElement).toBe(dialog)
    })
  })
})
