import { plural } from '../plural';

export const bulkImport = {
  issues: {
    blank: 'paste or upload some JSON first',
    invalidJson: (message: string) => `that is not valid JSON: ${message}`,
    notArray: 'the top level must be a JSON array (square brackets)',
    empty: 'the array is empty — nothing to import',
    tooMany: (max: number) => `import is limited to ${max} entries at a time; split the file into smaller batches`,
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
