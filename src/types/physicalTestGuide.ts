import type { PhysicalTestType } from './physicalTest';

export interface PhysicalTestGuideEntry {
  key: PhysicalTestType;
  label: string;
  protocol: string;
}

export interface PhysicalTestGuideConfig {
  tests: PhysicalTestGuideEntry[];
  updatedBy: string;
  updatedAt: unknown;
}
