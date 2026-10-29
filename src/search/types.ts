import type { LucideIcon } from 'lucide-react';

export type SearchGroupId = 'goto' | 'actions' | 'teams' | 'players' | 'matches' | 'exercises' | 'trainings' | 'recent';

/** An action that the destination page performs on arrival (opens its create form). */
export type PendingActionId = 'new-team' | 'new-training' | 'new-exercise' | 'new-match' | 'new-session' | 'add-player';

export interface SearchItem {
  /** Unique within its group. */
  id: string;
  group: SearchGroupId;
  label: string;
  /** E.g. the team name for a player, the date for a match. */
  sublabel?: string;
  /** Extra matchable text (age group, "#7", opponent). */
  keywords?: string[];
  /** URL; enables Ctrl+Enter. */
  to?: string;
  /** For actions without a URL. */
  run?: () => void;
  icon?: LucideIcon;
  /** The action needs a team picker first. */
  pick?: 'team';
  /** Performed by the destination page on arrival. */
  action?: PendingActionId;
}

export interface SearchGroup {
  id: SearchGroupId;
  label: string;
  items: SearchItem[];
  total: number;
  loading: boolean;
}
