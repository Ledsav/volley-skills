export interface ValidationResult<TInput> {
  /** Parsed + normalised rows, order preserved. Empty when `errors` is non-empty. */
  inputs: TInput[];
  /** Human-readable, 1-indexed messages. Empty on success. */
  errors: string[];
}
