import { useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useNotify } from '../../components/Notice';
import { useT } from '../../i18n/I18nProvider';
import type { Gender } from '../../i18n/catalog';
import type { Player } from '../../types/player';
import { loadTeamRoster } from '../matchesApi';
import { decodeDvw } from './decodeDvw';
import { dvwMessageText } from './dvwMessage';
import { discardImport, findImportedMatch, runImport, startImport, type ImportJob } from './dvwImportApi';
import type { DvwPlan } from './mapDvw';
import { parseDvw } from './parseDvw';
import { sha256OfBytes } from './sha256';
import type { DvwFile } from './types';
import { DvwReview } from './DvwReview';

const MAX_BYTES = 2 * 1024 * 1024;

function readBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

interface DvwImportDialogProps {
  teamId: string;
  teamName: string;
  /** For gendered role labels in the review; mixed when unknown. */
  gender?: Gender;
  onClose: () => void;
  onImported: (matchId: string) => void;
}

interface Loaded {
  file: DvwFile;
  fileName: string;
  sha: string;
  players: Player[];
  duplicate: { id: string; date: string; opponent: string } | null;
}

interface Running {
  plan: DvwPlan;
  job: ImportJob;
}

export function DvwImportDialog({ teamId, teamName, gender, onClose, onImported }: DvwImportDialogProps) {
  const t = useT();
  const d = t.dvw.dialog;
  const { firebaseUser, club } = useAuth();
  const notify = useNotify();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<Running | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  /** Bumped after an error: a fresh file input fires change again for the same file. */
  const [pickerKey, setPickerKey] = useState(0);
  const attempt = useRef(0);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setError(null);
    const fail = (message: string) => {
      setError(message);
      setPickerKey((k) => k + 1);
    };
    if (picked.size > MAX_BYTES) {
      fail(d.tooLarge);
      return;
    }
    setBusy(true);
    try {
      const bytes = await readBytes(picked);
      const parsed = parseDvw(decodeDvw(bytes));
      if ('error' in parsed) {
        fail(dvwMessageText(parsed.error, t));
        return;
      }
      const sha = await sha256OfBytes(bytes);
      const [players, duplicate] = await Promise.all([loadTeamRoster(teamId), findImportedMatch(teamId, sha)]);
      setLoaded({ file: parsed, fileName: picked.name, sha, players, duplicate });
    } catch {
      fail(d.readError);
    } finally {
      setBusy(false);
    }
  }

  async function run(r: Running) {
    const id = ++attempt.current;
    setFailed(false);
    try {
      await runImport(teamId, r.plan, r.job, (done, total) => {
        if (attempt.current === id) setProgress({ done, total });
      });
      notify(d.imported);
      onImported(r.job.matchId);
    } catch {
      if (attempt.current === id) setFailed(true);
    }
  }

  function startRun(plan: DvwPlan) {
    if (!loaded || !firebaseUser) return;
    const warnings = loaded.file.warnings.length + plan.issues.filter((i) => i.kind === 'warning').length;
    const job = startImport(
      teamId,
      plan,
      { fileName: loaded.fileName, fileSha256: loaded.sha, generator: loaded.file.generator, warnings },
      firebaseUser.uid,
    );
    const r = { plan, job };
    setRunning(r);
    setProgress({ done: 0, total: plan.events.length });
    void run(r);
  }

  async function discard() {
    setDiscardError(null);
    if (running) {
      try {
        await discardImport(teamId, running.job.matchId);
      } catch {
        setDiscardError(d.discardError);
        return;
      }
    }
    onClose();
  }

  /** Closing with a failed job must not leave the partial match behind. */
  function handleClose() {
    if (running && failed) void discard();
    else onClose();
  }

  return (
    <Sheet title={d.title} onClose={handleClose} size="lg" detent="large" dirty={!!running}>
      {running ? (
        <div className="flex flex-col gap-3">
          <p className="text-callout text-ink tabular-nums" role="status">
            {d.importing(progress?.done ?? 0, progress?.total ?? 0)}
          </p>
          {failed && (
            <>
              <p role="alert" className="text-callout text-red-strong">{d.notFinished}</p>
              {discardError && <p role="alert" className="text-callout text-red-strong">{discardError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => void discard()}>{d.discard}</Button>
                <Button variant="primary" onClick={() => void run(running)}>{d.retry}</Button>
              </div>
            </>
          )}
        </div>
      ) : loaded ? (
        <DvwReview
          teamId={teamId}
          file={loaded.file}
          fileName={loaded.fileName}
          players={loaded.players}
          appNames={[club?.name ?? '', teamName]}
          duplicate={loaded.duplicate}
          gender={gender}
          onCancel={onClose}
          onImport={startRun}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-callout font-semibold text-ink">
            {d.fileLabel}
            <input key={pickerKey} type="file" accept=".dvw" onChange={(e) => void handleFile(e)} disabled={busy} className="rounded-md bg-surface-2 p-2 text-callout text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-callout file:font-semibold file:text-ink" />
          </label>
          <p className="text-callout text-ink-2">{d.help}</p>
          {busy && <p className="text-callout text-ink-2">{d.reading}</p>}
          {error && <p role="alert" className="text-callout text-red-strong">{error}</p>}
          <p className="text-footnote text-ink-2">{d.disclaimer}</p>
        </div>
      )}
    </Sheet>
  );
}
