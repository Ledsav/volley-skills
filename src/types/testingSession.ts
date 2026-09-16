import type { PhysicalTestType } from './physicalTest';

export interface TestingSession {
  id: string;
  date: string;
  status: 'open' | 'closed';
  createdBy: string;
  createdAt: unknown;
  closedAt: unknown | null;
}

export interface TestingSessionEntry {
  id: string;
  playerId: string;
  testType: PhysicalTestType;
  status: 'in_progress' | 'complete';
  data: Record<string, unknown>;
  resultTestId: string | null;
  updatedAt: unknown;
}

export function buildEntryId(playerId: string, testType: PhysicalTestType): string {
  return `${playerId}__${testType}`;
}
