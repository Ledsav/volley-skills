import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BulkImportDialog } from './BulkImportDialog';
import { LIMITS } from '../types/limits';
import type { ValidationResult } from './types';

type Row = { v: number };

function setup() {
  const validate = vi.fn((rows: unknown[]): ValidationResult<Row> => ({ inputs: rows.map((_, i) => ({ v: i })), errors: [] }));
  render(
    <BulkImportDialog<Row>
      title="Import things"
      exampleJson="[]"
      validate={validate}
      commit={vi.fn().mockResolvedValue(0)}
      onClose={vi.fn()}
      onImported={vi.fn()}
    />,
  );
}

/** A file that reports `size` bytes; `text` is a spy, so a test can tell whether it was read. */
function fileOf(size: number, body = '[1]') {
  const file = new File([body], 'rows.json', { type: 'application/json' });
  Object.defineProperty(file, 'size', { value: size });
  const text = vi.fn().mockResolvedValue(body);
  Object.defineProperty(file, 'text', { value: text });
  return { file, text };
}

function choose(file: File) {
  fireEvent.change(screen.getByLabelText('…or choose a file'), { target: { files: [file] } });
}

describe('BulkImportDialog file size', () => {
  it('refuses a file over the byte bound without reading it', async () => {
    setup();
    const { file, text } = fileOf(LIMITS.importText * 4 + 1);
    choose(file);
    expect(await screen.findByRole('alert')).toHaveTextContent('the text is too long to import (more than 1,000,000 characters)');
    expect(text).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Paste JSON')).toHaveValue('');
  });

  it('reads a file at the byte bound into the text box', async () => {
    setup();
    const { file, text } = fileOf(LIMITS.importText * 4);
    choose(file);
    await waitFor(() => expect(screen.getByLabelText('Paste JSON')).toHaveValue('[1]'));
    expect(text).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
