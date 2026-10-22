// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { backupDate, backupFileName, backupsToPrune, RETENTION_DAYS } from './backupFiles.mjs';

const NOW = new Date('2026-12-01T10:00:00.000Z');
const daysAgo = (d) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

describe('backup file names', () => {
  it('names a backup by its UTC time', () => {
    expect(backupFileName(new Date('2026-10-22T09:05:07.123Z'))).toBe('volley-skills-2026-10-22T09-05-07Z.vsbackup');
  });

  it('reads the date back from the name', () => {
    expect(backupDate('volley-skills-2026-10-22T09-05-07Z.vsbackup')?.toISOString()).toBe('2026-10-22T09:05:07.000Z');
    expect(backupDate('notes.txt')).toBeNull();
    expect(backupDate('volley-skills-2026-10-22T09-05-07Z.vsbackup.bak')).toBeNull();
  });
});

describe('backupsToPrune', () => {
  it('keeps 35 days and prunes older backups', () => {
    expect(RETENTION_DAYS).toBe(35);
    const keep = backupFileName(daysAgo(35));
    const old = backupFileName(daysAgo(36));
    expect(backupsToPrune([keep, old], NOW)).toEqual([old]);
  });

  it('never touches files that are not backups by name', () => {
    const names = ['README.txt', 'volley-skills-old.vsbackup', 'other-2020-01-01T00-00-00Z.vsbackup', 'private-key.pem'];
    expect(backupsToPrune(names, NOW)).toEqual([]);
  });
});
