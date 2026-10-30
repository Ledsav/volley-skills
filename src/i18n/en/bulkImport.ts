import { plural } from '../plural';

export const bulkImport = {
  issues: {
    blank: 'paste or upload some JSON first',
    invalidJson: (message: string) => `that is not valid JSON: ${message}`,
    notArray: 'the top level must be a JSON array (square brackets)',
    empty: 'the array is empty — nothing to import',
    tooMany: (max: number) => `import is limited to ${max} entries at a time; split the file into smaller batches`,
    tooLarge: (max: number) => `the text is too long to import (more than ${max.toLocaleString('en')} characters); split it into smaller batches`,
    /** A row's text field over its size cap (src/types/limits.ts). */
    fieldTooLong: (row: number, field: string, max: number) => `row ${row}: "${field}" is longer than ${max.toLocaleString('en')} characters`,
    /** A row's list over its size cap. */
    listTooLong: (row: number, field: string, max: number) => `row ${row}: "${field}" has more than ${max} entries`,
  },
  exampleFormat: 'Example format',
  pasteJson: 'Paste JSON',
  chooseFile: '…or choose a file',
  validate: 'Validate',
  checking: 'Checking…',
  ready: (n: number) => `${n} ${plural('en', n, { one: 'entry', other: 'entries' })} ready to import.`,
  importError: 'Could not import. Nothing was saved. Please try again.',
  import: 'Import',
  importing: 'Importing…',
};
