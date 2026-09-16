import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';

interface StopwatchProps {
  onRecord: (seconds: number) => void;
}

export function Stopwatch({ onRecord }: StopwatchProps) {
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
    <div className="flex items-center gap-3">
      <span className="tabular-nums text-lg font-semibold text-ink">{(elapsedMs / 1000).toFixed(1)}s</span>
      {!running ? (
        <Button variant="primary" size="md" onClick={start}>
          Start
        </Button>
      ) : (
        <Button variant="destructive" size="md" onClick={stop}>
          Stop
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={reset}
        onBlur={() => setConfirmingReset(false)}
      >
        {confirmingReset ? 'Confirm reset' : 'Reset'}
      </Button>
    </div>
  );
}
