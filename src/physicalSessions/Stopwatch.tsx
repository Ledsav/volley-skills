import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';

interface StopwatchProps {
  onRecord: (seconds: number) => void;
}

export function Stopwatch({ onRecord }: StopwatchProps) {
  const s = useT().physicalSessions.stopwatch;
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  function start() {
    startedAtRef.current = Date.now() - elapsedMs;
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    const finalMs = Date.now() - startedAtRef.current;
    onRecord(Math.round(finalMs) / 1000);
    setElapsedMs(0);
  }

  function reset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setRunning(false);
    setElapsedMs(0);
    setConfirmingReset(false);
  }

  return (
    <div className="w-full">
      <div className="mb-2 text-center text-display tabular-nums text-ink">
        {formatNumber(elapsedMs / 1000, 1)}s
      </div>
      {!running ? (
        <Button variant="primary" size="md" onClick={start} className="min-h-14 w-full">
          {s.start}
        </Button>
      ) : (
        <Button variant="destructive" size="md" onClick={stop} className="min-h-14 w-full">
          {s.stop}
        </Button>
      )}
      <div className="mt-2 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          onBlur={() => setConfirmingReset(false)}
        >
          {confirmingReset ? s.confirmReset : s.reset}
        </Button>
      </div>
    </div>
  );
}
