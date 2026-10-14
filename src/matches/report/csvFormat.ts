import type { CsvFormat } from './reportCsv';

const CSV_FORMAT_KEY = 'vcb.report.csvFormat';

/** Per-device preference, default EU (the club's Excel). Storage can throw (private mode, blocked site data). */
export function readCsvFormat(): CsvFormat {
  try {
    return window.localStorage.getItem(CSV_FORMAT_KEY) === 'en' ? 'en' : 'eu';
  } catch {
    return 'eu';
  }
}

export function writeCsvFormat(format: CsvFormat): void {
  try {
    window.localStorage.setItem(CSV_FORMAT_KEY, format);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
}
