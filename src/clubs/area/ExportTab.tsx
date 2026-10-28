import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../components/Button';
import { useNotify } from '../../components/Notice';
import { downloadBlob } from '../../export/exportJson';
import { buildClubExportFiles, clubExportFileName, zipClubExport } from '../export/clubExport';
import { loadClubExportData } from '../export/clubExportApi';
import { useT } from '../../i18n/I18nProvider';

/** The club's self-service data export (spec §7.2): one ZIP, built in the browser. */
export function ExportTab() {
  const notify = useNotify();
  const e = useT().clubs.export;
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = progress !== null;

  async function run() {
    setError(null);
    setProgress(e.starting);
    try {
      const data = await loadClubExportData(setProgress);
      const now = new Date();
      const zip = zipClubExport(buildClubExportFiles(data, now));
      downloadBlob(clubExportFileName(data.club, now), new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
      notify(e.downloaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(e.failed(message.replace(/\.$/, '')));
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{e.title}</h2>
        <p className="mt-1 text-sm text-slate">
          {e.description}
        </p>
      </div>
      <div>
        <Button variant="primary" onClick={() => void run()} disabled={running}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          {e.download}
        </Button>
      </div>
      {running && <p role="status" className="text-sm text-slate">{progress}</p>}
      {error && <p role="alert" className="text-sm text-red-strong">{error}</p>}
    </section>
  );
}
