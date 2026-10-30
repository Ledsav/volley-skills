/**
 * `TIssue` is whatever a validator reports for a row. Validators that have been
 * converted return `{ code, … }` objects the UI maps to text; the rest still
 * return ready-made English strings (the default).
 */
export interface ValidationResult<TInput, TIssue = string> {
  /** Parsed + normalised rows, order preserved. Empty when `errors` is non-empty. */
  inputs: TInput[];
  /** One issue per problem, 1-indexed rows. Empty on success. */
  errors: TIssue[];
}

/** A row's text field or list over its size cap (src/types/limits.ts); shared by every import. */
export type SizeIssue =
  | { code: 'tooLong'; row: number; field: string; max: number }
  | { code: 'listTooLong'; row: number; field: string; max: number };
