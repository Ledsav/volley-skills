import { useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { useNotify } from '../../components/Notice';
import type { Player } from '../../types/player';
import { loadTeamRoster } from '../matchesApi';
import { decodeDvw } from './decodeDvw';
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

export function DvwImportDialog({ teamId, teamName, onClose, onImported }: DvwImportDialogProps) {
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
      fail('This file is larger than 2 MB.');
      return;
    }
    setBusy(true);
    try {
      const bytes = await readBytes(picked);
      const parsed = parseDvw(decodeDvw(bytes));
      if ('error' in parsed) {
        fail(parsed.error);
        return;
      }
      const sha = await sha256OfBytes(bytes);
      const [players, duplicate] = await Promise.all([loadTeamRoster(teamId), findImportedMatch(teamId, sha)]);
      setLoaded({ file: parsed, fileName: picked.name, sha, players, duplicate });
    } catch {
      fail('Could not read this file. Check your connection and try again.');
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
      notify('Match imported.');
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
        setDiscardError('Could not discard the partial import. Check your connection and try again.');
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
    <Dialog title="Import from DataVolley (.dvw)" onClose={handleClose} size="lg" mobileSheet dirty={!!running}>
      {running ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink tabular-nums" role="status">
            Importing… {progress?.done ?? 0}/{progress?.total ?? 0}
          </p>
          {failed && (
            <>
              <p role="alert" className="text-sm text-red">The import did not finish. Retry, or discard what was written.</p>
              {discardError && <p role="alert" className="text-sm text-red">{discardError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => void discard()}>Discard</Button>
                <Button variant="primary" onClick={() => void run(running)}>Retry</Button>
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
          onCancel={onClose}
          onImport={startRun}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            DVW file
            <input key={pickerKey} type="file" accept=".dvw" onChange={(e) => void handleFile(e)} disabled={busy} className="text-sm" />
          </label>
          <p className="text-sm text-slate">
            Pick a DataVolley scout file (up to 2 MB). It is read on this device; the player names in it are only shown
            while you review. Also works with Click&amp;Scout and VolleyStation .dvw exports.
          </p>
          {busy && <p className="text-sm text-slate">Reading the file…</p>}
          {error && <p role="alert" className="text-sm text-red">{error}</p>}
          <p className="text-xs text-slate">
            Not affiliated with Data Project or Genius Sports. DataVolley is a trademark of its owner.
          </p>
        </div>
      )}
    </Dialog>
  );
}
