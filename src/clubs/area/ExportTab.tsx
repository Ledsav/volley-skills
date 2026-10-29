import { useState } from 'react';
import { Download } from 'lucide-react';
import { usePublishPageChrome } from '../../layout/PageChrome';
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
  const pageTitle = useT().clubs.area.pageTitle;

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

  usePublishPageChrome({
    title: pageTitle,
    mainAction: { label: e.download, icon: Download, onSelect: () => void run(), disabled: running },
  });

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-lg bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-title-3 text-ink">{e.title}</h2>
        <p className="mt-1 text-callout text-ink-2">
          {e.description}
        </p>
      </div>
      {running && <p role="status" className="text-footnote text-ink-2">{progress}</p>}
      {error && <p role="alert" className="text-footnote text-red-strong">{error}</p>}
    </section>
  );
}
