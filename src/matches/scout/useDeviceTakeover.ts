import { useCallback, useEffect, useState } from 'react';
import { isLockedByOther } from '../deviceLock';
import { claimDevice, subscribeMatch } from '../matchesApi';

const HEARTBEAT_MS = 60_000;

interface Options {
  teamId: string;
  matchId: string;
  deviceId: string;
  /** The match is loaded and this device holds the lock. */
  active: boolean;
}

/**
 * Owns this device's claim on the match while scouting: it keeps the heartbeat
 * going and watches the match doc, so a device that took over (heartbeat under
 * two minutes old) is noticed. The heartbeat stops on takeover and on unmount.
 */
export function useDeviceTakeover({ teamId, matchId, deviceId, active }: Options): { takenOver: boolean; takeBack: () => void } {
  const [takenOver, setTakenOver] = useState(false);

  useEffect(() => {
    if (!active) return;
    // Listener errors are ignored: scouting carries on.
    return subscribeMatch(
      teamId,
      matchId,
      (m) => {
        if (m && isLockedByOther(m.activeDevice, deviceId, Date.now())) setTakenOver(true);
      },
      () => undefined,
    );
  }, [active, teamId, matchId, deviceId]);

  useEffect(() => {
    if (!active || takenOver) return;
    const t = window.setInterval(() => void claimDevice(teamId, matchId, deviceId).catch(() => undefined), HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [active, takenOver, teamId, matchId, deviceId]);

  const takeBack = useCallback(() => {
    void claimDevice(teamId, matchId, deviceId).catch(() => undefined);
    setTakenOver(false);
  }, [teamId, matchId, deviceId]);

  return { takenOver, takeBack };
}
