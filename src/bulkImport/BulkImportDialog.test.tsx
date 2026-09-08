import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkImportDialog } from './BulkImportDialog';
import type { ValidationResult } from './types';

type Row = { v: number };

function setup(overrides: Partial<Parameters<typeof BulkImportDialog<Row>>[0]> = {}) {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const validate = vi.fn(
    (rows: unknown[]): ValidationResult<Row> => ({ inputs: rows.map((_, i) => ({ v: i })), errors: [] })
  );
  const commit = vi.fn().mockResolvedValue(2);
  render(
    <BulkImportDialog<Row>
      title="Import things"
      exampleJson="[]"
      validate={validate}
      commit={commit}
      onClose={onClose}
      onImported={onImported}
      {...overrides}
    />
  );
  return { onClose, onImported, validate, commit };
}

function paste(text: string) {
  fireEvent.change(screen.getByLabelText('Paste JSON'), { target: { value: text } });
}

describe('BulkImportDialog', () => {
  it('shows a parse error and keeps Import disabled', () => {
    setup();
    paste('{bad}');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/not valid JSON/i);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('lists validator errors and keeps Import disabled', () => {
    const validate = vi.fn((): ValidationResult<Row> => ({ inputs: [], errors: ['row 1: bad', 'row 2: worse'] }));
    setup({ validate });
    paste('[1,2]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByText('row 1: bad')).toBeInTheDocument();
    expect(screen.getByText('row 2: worse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('enables Import after a clean validate and commits the parsed inputs', async () => {
    const { commit, onImported } = setup();
    paste('[1,2,3]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('3 entries ready to import.');
    const importBtn = screen.getByRole('button', { name: 'Import' });
    expect(importBtn).toBeEnabled();
    fireEvent.click(importBtn);
    await waitFor(() => expect(commit).toHaveBeenCalledWith([{ v: 0 }, { v: 1 }, { v: 2 }]));
    expect(onImported).toHaveBeenCalledWith(2);
  });

  it('surfaces a commit failure and does not call onImported', async () => {
    const commit = vi.fn().mockRejectedValue(new Error('boom'));
    const { onImported } = setup({ commit });
    paste('[1]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('1 entry ready to import.');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByText(/nothing was saved/i);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('awaits an async validator', async () => {
    const validate = vi.fn(
      async (): Promise<ValidationResult<Row>> => ({ inputs: [{ v: 0 }], errors: [] })
    );
    setup({ validate });
    paste('[1]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('1 entry ready to import.');
  });

  it('drops a stale async validation when the textarea changes before it resolves', async () => {
    let resolveValidation: (result: ValidationResult<Row>) => void = () => {};
    const validate = vi.fn(
      () =>
        new Promise<ValidationResult<Row>>((resolve) => {
          resolveValidation = resolve;
        })
    );
    setup({ validate });
    paste('[1]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    // Supersede the in-flight validation with new text.
    paste('[1,2]');
    resolveValidation({ inputs: [{ v: 0 }], errors: [] });
    await waitFor(() => expect(validate).toHaveBeenCalled());

    expect(screen.queryByText(/ready to import/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('keeps Import disabled when a clean validation yields zero rows', async () => {
    const validate = vi.fn((): ValidationResult<Row> => ({ inputs: [], errors: [] }));
    setup({ validate });
    paste('[1]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('0 entries ready to import.');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});
