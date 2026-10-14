import { MAX_CUSTOM_AWARDS, type AwardId, type AwardPick, type AwardsInput } from '../types/awards';
import type { PrepareAction } from './AwardsPrepare';

function setPick(cfg: AwardsInput, key: string, patch: Partial<AwardPick>): AwardsInput {
  const prev = cfg.picks[key as AwardId] ?? { playerId: null, hidden: false };
  const next = { ...prev, ...patch };
  const picks = { ...cfg.picks };
  if (next.playerId === null && !next.hidden) delete picks[key as AwardId];
  else picks[key as AwardId] = next;
  return { ...cfg, picks };
}

/** `ordered` is the current resolved order (what the coach sees). */
export function applyPrepareAction(cfg: AwardsInput, a: PrepareAction, ordered: string[], newId: () => string): AwardsInput {
  switch (a.type) {
    case 'pick':
      return setPick(cfg, a.key, { playerId: a.playerId });
    case 'hide':
      return setPick(cfg, a.key, { hidden: a.hidden });
    case 'move': {
      const order = [...ordered];
      const i = order.indexOf(a.key);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= order.length) return { ...cfg, order };
      [order[i], order[j]] = [order[j], order[i]];
      return { ...cfg, order };
    }
    case 'addCustom': {
      if (cfg.custom.length >= MAX_CUSTOM_AWARDS) return cfg;
      const id = newId();
      const order = [...ordered];
      const mvpAt = order.indexOf('mvp');
      order.splice(mvpAt < 0 ? order.length : mvpAt, 0, id);
      return { ...cfg, custom: [...cfg.custom, { id, title: a.title, playerId: a.playerId, note: a.note }], order };
    }
    case 'removeCustom':
      return { ...cfg, custom: cfg.custom.filter((c) => c.id !== a.key), order: ordered.filter((k) => k !== a.key) };
  }
}
