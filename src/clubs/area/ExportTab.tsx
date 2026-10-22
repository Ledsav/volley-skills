import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../components/Button';
import { useNotify } from '../../components/Notice';
import { downloadBlob } from '../../export/exportJson';
import { buildClubExportFiles, clubExportFileName, zipClubExport } from '../export/clubExport';
import { loadClubExportData } from '../export/clubExportApi';

/** The club's self-service data export (spec §7.2): one ZIP, built in the browser. */
export function ExportTab() {
  const notify = useNotify();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = progress !== null;

  async function run() {
    setError(null);
    setProgress('Starting');
    try {
      const data = await loadClubExportData(setProgress);
      const now = new Date();
      const zip = zipClubExport(buildClubExportFiles(data, now));
      downloadBlob(clubExportFileName(data.club, now), new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
      notify('Export downloaded');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Export failed: ${message.replace(/\.$/, '')}. Nothing was downloaded.`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Export your club&apos;s data</h2>
        <p className="mt-1 text-sm text-slate">
          One ZIP file with everything your club has stored: teams, players, physical tests, matches with every
          scouting event, the library, guides and access lists. README.txt inside explains each file. It holds
          minors&apos; personal data, so keep it somewhere safe.
        </p>
      </div>
      <div>
        <Button variant="primary" onClick={() => void run()} disabled={running}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Download export
        </Button>
      </div>
      {running && <p role="status" className="text-sm text-slate">{progress}</p>}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </section>
  );
}
