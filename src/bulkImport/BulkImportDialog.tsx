import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { CodeBlock } from '../components/CodeBlock';
import { Dialog } from '../components/Dialog';
import { Textarea } from '../components/Input';
import { useT } from '../i18n/I18nProvider';
import { parseIssueText } from './importMessages';
import { parseJsonArray } from './parseJsonArray';
import type { ValidationResult } from './types';

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    value != null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

interface BulkImportDialogBaseProps<TInput, TIssue> {
  title: string;
  hint?: string;
  exampleJson: string;
  validate: (rows: unknown[]) => ValidationResult<TInput, TIssue> | Promise<ValidationResult<TInput, TIssue>>;
  commit: (inputs: TInput[]) => Promise<number>;
  onClose: () => void;
  onImported: (count: number) => void;
}

/**
 * A validator that returns `{ code, … }` issues needs a `formatIssue` to turn them into text;
 * only a validator whose issues are already strings may leave it out. Forgetting it fails `tsc`
 * instead of rendering "[object Object]".
 */
type BulkImportDialogProps<TInput, TIssue> = BulkImportDialogBaseProps<TInput, TIssue> &
  ([TIssue] extends [string]
    ? { formatIssue?: (issue: TIssue) => string }
    : { formatIssue: (issue: TIssue) => string });

export function BulkImportDialog<TInput, TIssue = string>({
  title,
  hint,
  exampleJson,
  validate,
  formatIssue,
  commit,
  onClose,
  onImported,
}: BulkImportDialogProps<TInput, TIssue>) {
  const t = useT();
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

  function applyResult(result: ValidationResult<TInput, TIssue>) {
    if (result.errors.length > 0) setErrors(result.errors.map((issue) => (formatIssue ? formatIssue(issue) : (issue as string))));
    else setReady(result.inputs);
  }

  function handleValidate() {
    resetResults();
    const parsed = parseJsonArray(text);
    if (!parsed.ok) {
      setParseError(parseIssueText(parsed.error, t));
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
            setParseError(t.common.couldNotValidate);
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
        setParseError(t.common.couldNotValidate);
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
      setCommitError(t.bulkImport.importError);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose} size="lg">
      <div>
        {hint && <p className="mb-3 text-sm text-slate">{hint}</p>}

        <details className="mb-3 text-sm text-slate">
          <summary className="cursor-pointer select-none">{t.bulkImport.exampleFormat}</summary>
          <div className="mt-2">
            <CodeBlock code={exampleJson} language="JSON" />
          </div>
        </details>

        <label htmlFor="bulk-json" className="mb-1 block text-sm font-medium text-ink">
          {t.bulkImport.pasteJson}
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
          {t.bulkImport.chooseFile}
        </label>
        <input
          id="bulk-file"
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="mt-1 block w-full min-w-0 text-sm text-slate"
        />

        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={handleValidate} disabled={validating || committing}>
            {validating ? t.bulkImport.checking : t.bulkImport.validate}
          </Button>
        </div>

        {parseError && (
          <p role="alert" className="mt-3 text-sm text-red-strong">
            {parseError}
          </p>
        )}

        {errors.length > 0 && (
          <ul role="alert" className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-red-strong">
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        )}

        {ready && (
          <p className="mt-3 text-sm text-green-strong">
            {t.bulkImport.ready(ready.length)}
          </p>
        )}

        {commitError && (
          <p role="alert" className="mt-3 text-sm text-red-strong">
            {commitError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={committing}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!ready || ready.length === 0 || committing}
          >
            {committing ? t.bulkImport.importing : t.bulkImport.import}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
