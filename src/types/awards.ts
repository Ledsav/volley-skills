export type AwardId =
  | 'mvp' | 'topScorer' | 'attacker' | 'server' | 'receiver' | 'blocker' | 'defender' | 'setter' | 'mostImproved' | 'everPresent';
export type AwardScope = 'match' | 'season';

export interface AwardPick { playerId: string | null; hidden: boolean }
export interface CustomAward { id: string; title: string; playerId: string; note: string }
export interface AwardsInput {
  /** Absent key → the stats' choice. */
  picks: Partial<Record<AwardId, AwardPick>>;
  custom: CustomAward[];
  /** AwardId | CustomAward.id in reveal order. */
  order: string[];
}
export interface AwardsConfig extends AwardsInput { updatedBy: string; updatedAt: unknown }
export const EMPTY_AWARDS: AwardsInput = { picks: {}, custom: [], order: [] };
export const MAX_CUSTOM_AWARDS = 5;
export const CUSTOM_TITLE_MAX = 40;
export const CUSTOM_NOTE_MAX = 80;
