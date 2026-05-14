import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveModelDialog } from './SaveModelDialog';
import type { SaveModelDialogDefaults } from './SaveModelDialog';

function defaults(overrides: Partial<SaveModelDialogDefaults> = {}): SaveModelDialogDefaults {
  return {
    name: 'AutoModel',
    description: '',
    author: '',
    license: '',
    normalizedLicense: null,
    ...overrides,
  };
}

describe('SaveModelDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <SaveModelDialog
        isOpen={false}
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults()}
      />,
    );
    expect(screen.queryByText(/save to library/i)).not.toBeInTheDocument();
  });

  it('pre-populates name + description + author from defaults', () => {
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults({
          name: 'MyAvatar',
          description: 'My description',
          author: 'Author Name',
        })}
      />,
    );

    expect(screen.getByLabelText(/^name$/i)).toHaveValue('MyAvatar');
    expect(screen.getByLabelText(/^description$/i)).toHaveValue('My description');
    expect(screen.getByLabelText(/^author$/i)).toHaveValue('Author Name');
  });

  it('pre-populates license fields from extracted normalizedLicense', () => {
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults({
          normalizedLicense: {
            licenseName: 'CC_BY',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
            allowedUserName: 'Everyone',
            commercialUsage: 'Allow',
            violentUsage: 'Disallow',
            modification: 'AllowModification',
          },
        })}
      />,
    );

    expect(screen.getByLabelText(/license name/i)).toHaveValue('CC_BY');
    expect(screen.getByLabelText(/license url/i)).toHaveValue(
      'https://creativecommons.org/licenses/by/4.0/',
    );
    expect(screen.getByLabelText(/allowed users/i)).toHaveValue('Everyone');
    expect(screen.getByLabelText(/commercial use/i)).toHaveValue('Allow');
    expect(screen.getByLabelText(/violent use/i)).toHaveValue('Disallow');
    expect(screen.getByLabelText(/modification/i)).toHaveValue('AllowModification');
  });

  it('prefers top-level `license` over normalizedLicense.licenseName when both set', () => {
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults({
          license: 'OverrideLicense',
          normalizedLicense: { licenseName: 'AutoExtracted' },
        })}
      />,
    );

    expect(screen.getByLabelText(/license name/i)).toHaveValue('OverrideLicense');
  });

  it('save is disabled when name is empty', () => {
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults({ name: '' })}
      />,
    );

    const save = screen.getByRole('button', { name: /save to library/i });
    expect(save).toBeDisabled();
  });

  it('save passes user-edited values to onSave', () => {
    const onSave = vi.fn();
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={onSave}
        defaults={defaults()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Edited' } });
    fireEvent.change(screen.getByLabelText(/^author$/i), { target: { value: 'Me' } });
    fireEvent.change(screen.getByLabelText(/license name/i), {
      target: { value: 'CC0' },
    });
    fireEvent.change(screen.getByLabelText(/commercial use/i), {
      target: { value: 'PersonalProfit' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.name).toBe('Edited');
    expect(arg.author).toBe('Me');
    expect(arg.license).toBe('CC0');
    expect(arg.normalizedLicense.licenseName).toBe('CC0');
    expect(arg.normalizedLicense.commercialUsage).toBe('PersonalProfit');
  });

  it('clears empty string license fields to undefined in normalizedLicense', () => {
    const onSave = vi.fn();
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={onSave}
        defaults={defaults({
          normalizedLicense: {
            licenseName: 'CC_BY',
            commercialUsage: 'Allow',
          },
        })}
      />,
    );

    // User clears the licenseName and commercialUsage fields.
    fireEvent.change(screen.getByLabelText(/license name/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/commercial use/i), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

    const arg = onSave.mock.calls[0][0];
    expect(arg.normalizedLicense.licenseName).toBeUndefined();
    expect(arg.normalizedLicense.commercialUsage).toBeUndefined();
  });

  it('trims whitespace from text fields before save', () => {
    const onSave = vi.fn();
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={onSave}
        defaults={defaults()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: '  Padded  ' },
    });
    fireEvent.change(screen.getByLabelText(/^author$/i), {
      target: { value: '  Spaces  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

    const arg = onSave.mock.calls[0][0];
    expect(arg.name).toBe('Padded');
    expect(arg.author).toBe('Spaces');
  });

  it('cancel triggers onClose, not onSave', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SaveModelDialog
        isOpen
        onClose={onClose}
        onSave={onSave}
        defaults={defaults()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('save is suppressed when name is whitespace-only', () => {
    const onSave = vi.fn();
    render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={onSave}
        defaults={defaults()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: '    ' } });
    const save = screen.getByRole('button', { name: /save to library/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('re-syncs all fields when defaults.name changes (new model loaded)', () => {
    const { rerender } = render(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults({ name: 'First', license: 'CC_BY' })}
      />,
    );

    expect(screen.getByLabelText(/^name$/i)).toHaveValue('First');
    expect(screen.getByLabelText(/license name/i)).toHaveValue('CC_BY');

    rerender(
      <SaveModelDialog
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        defaults={defaults({
          name: 'Second',
          normalizedLicense: { licenseName: 'CC0' },
        })}
      />,
    );

    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Second');
    expect(screen.getByLabelText(/license name/i)).toHaveValue('CC0');
  });
});
