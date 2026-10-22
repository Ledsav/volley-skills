// Backup file names and retention (backup design §3.4). Pruning goes by the date in
// the name, so copying a file (which changes its mtime) never changes when it expires.

/** Days a backup is kept: the DPA's backup window. */
export const RETENTION_DAYS = 35;

const NAME = /^volley-skills-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.vsbackup$/;

/** `volley-skills-YYYY-MM-DDTHH-MM-SSZ.vsbackup` (UTC). */
export function backupFileName(date) {
  const iso = date.toISOString().slice(0, 19).replace(/:/g, '-');
  return `volley-skills-${iso}Z.vsbackup`;
}

/** The time in a backup's name, or null when the name is not a backup's. */
export function backupDate(name) {
  const m = NAME.exec(name);
  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.000Z`) : null;
}

/** The backups among `names` older than RETENTION_DAYS at `now`. Other files are never listed. */
export function backupsToPrune(names, now) {
  const limit = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return names.filter((name) => {
    const date = backupDate(name);
    return date !== null && date.getTime() < limit;
  });
}
