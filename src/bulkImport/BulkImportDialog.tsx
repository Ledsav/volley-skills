import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { parseJsonArray } from './parseJsonArray';
import type { ValidationResult } from './types';

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    value != null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

interface BulkImportDialogProps<TInput> {
  title: string;
  hint?: string;
  exampleJson: string;
  validate: (rows: unknown[]) => ValidationResult<TInput> | Promise<ValidationResult<TInput>>;
  commit: (inputs: TInput[]) => Promise<number>;
  onClose: () => void;
  onImported: (count: number) => void;
}

export function BulkImportDialog<TInput>({
  title,
  hint,
  exampleJson,
  validate,
  commit,
  onClose,
  onImported,
}: BulkImportDialogProps<TInput>) {
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [ready, setReady] = useState<TInput[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const validationGen = useRef(0);

  function resetResults() {
    validationGen.current += 1;
    // Clear the in-flight spinner too: a superseded async validation's `.finally`
    // is generation-guarded and will not run, so without this the Validate button
    // would stay stuck (and disabled) until the dialog is reopened.
    setValidating(false);
    setParseError(null);
    setErrors([]);
    setReady(null);
    setCommitError(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    resetResults();
  }

  function applyResult(result: ValidationResult<TInput>) {
    if (result.errors.length > 0) setErrors(result.errors);
    else setReady(result.inputs);
  }

  function handleValidate() {
    resetResults();
    const parsed = parseJsonArray(text);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    // A stale async validation must not arm Import under superseded text: any
    // reset (textarea edit, file change, a fresh Validate click) bumps the
    // generation, and a completion whose captured generation no longer matches
    // is dropped.
    const gen = validationGen.current;
    // `validate` may be sync or async. A sync result is applied immediately so
    // the outcome is on screen before the click handler returns; an async one
    // is always awaited via Promise.resolve.
    try {
      const outcome = validate(parsed.rows);
      if (isPromiseLike(outcome)) {
        setValidating(true);
        Promise.resolve(outcome)
          .then((result) => {
            if (validationGen.current !== gen) return;
            applyResult(result);
          })
          .catch(() => {
            if (validationGen.current !== gen) return;
            setParseError('could not validate the data — please try again');
          })
          .finally(() => {
            if (validationGen.current !== gen) return;
            setValidating(false);
          });
      } else if (validationGen.current === gen) {
        applyResult(outcome);
      }
    } catch {
      if (validationGen.current === gen) {
        setParseError('could not validate the data — please try again');
      }
    }
  }

  async function handleImport() {
    if (!ready) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const count = await commit(ready);
      onImported(count);
    } catch {
      setCommitError('Could not import. Nothing was saved. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-1 text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {hint && <p className="mb-3 text-sm text-slate">{hint}</p>}

        <details className="mb-3 text-sm text-slate">
          <summary className="cursor-pointer select-none">Example format</summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded-md border border-border bg-bg p-3 text-xs text-ink">
            {exampleJson}
          </pre>
        </details>

        <label htmlFor="bulk-json" className="mb-1 block text-sm font-medium text-ink">
          Paste JSON
        </label>
        <Textarea
          id="bulk-json"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            resetResults();
          }}
          rows={10}
        />

        <label htmlFor="bulk-file" className="mt-3 block text-sm text-slate">
          …or choose a file
        </label>
        <input
          id="bulk-file"
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="mt-1 block text-sm text-slate"
        />

        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={handleValidate} disabled={validating || committing}>
            {validating ? 'Checking…' : 'Validate'}
          </Button>
        </div>

        {parseError && (
          <p role="alert" className="mt-3 text-sm text-red">
            {parseError}
          </p>
        )}

        {errors.length > 0 && (
          <ul role="alert" className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-red">
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        )}

        {ready && (
          <p className="mt-3 text-sm text-green">
            {ready.length} {ready.length === 1 ? 'entry' : 'entries'} ready to import.
          </p>
        )}

        {commitError && (
          <p role="alert" className="mt-3 text-sm text-red">
            {commitError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={committing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!ready || ready.length === 0 || committing}
          >
            {committing ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
