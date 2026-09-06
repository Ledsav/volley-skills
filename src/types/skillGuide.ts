import type { SkillKey } from './player';

export interface SkillGuideRange {
  min: number;
  max: number;
  description: string;
}

export interface SkillGuideEntry {
  key: SkillKey;
  label: string;
  ranges: SkillGuideRange[];
  howToEvaluate: string;
}

export interface SkillGuideConfig {
  skills: SkillGuideEntry[];
  updatedBy: string;
  updatedAt: unknown;
}
