import { describe, expect, it } from 'vitest';
import { buildTrainingMessages, libraryIndexLine } from './trainingPrompt';

const entry = { id: 'ex-1', name: 'Pepper', category: 'warmup' as const, description: `Line one\nline two ${'x'.repeat(200)}` };

describe('libraryIndexLine', () => {
  it('is id | name | category | min players | first 80 chars of a one-line description', () => {
    const line = libraryIndexLine(entry);
    expect(line.startsWith('ex-1 | Pepper | warmup | min - | Line one line two ')).toBe(true);
    expect(line.split(' | ')[4]).toHaveLength(80);
    expect(libraryIndexLine({ ...entry, minPlayers: 4 })).toContain('| min 4 |');
  });
});

describe('buildTrainingMessages', () => {
  it('sends only the documented payload', () => {
    const [system, user] = buildTrainingMessages({ goal: 'serve receive', ageGroupTarget: 'U15', totalMinutes: 90, allowNew: true, index: [entry] });
    expect(system.content).toContain('ex-1 | Pepper | warmup');
    expect(system.content).toContain('"new"');
    expect(system.content).toContain('Diagram format');
    expect(system.content).not.toContain('createdBy');
    expect(user.content).toBe('Goal: serve receive\nAge group: U15\nTotal minutes: 90');
  });
  it('omits new-exercise instructions when not allowed and handles an empty library', () => {
    const [system] = buildTrainingMessages({ goal: 'g', ageGroupTarget: '', totalMinutes: 60, allowNew: false, index: [] });
    expect(system.content).not.toContain('"new"');
    expect(system.content).not.toContain('Diagram format');
    expect(system.content).toContain('(the library is empty)');
  });
});

describe('buildTrainingMessages with targets and suggested players', () => {
  it('asks for target categories and drills the group can run', () => {
    const [system, user] = buildTrainingMessages({
      goal: 'free ball', ageGroupTarget: 'U17', totalMinutes: 90, allowNew: true, index: [entry],
      targets: ['reception', 'defense'], suggestedPlayers: 9,
    });
    expect(user.content).toBe('Goal: free ball\nAge group: U17\nTotal minutes: 90\nTargets: reception, defense\nPlayers: 9 (plan for 6–12)');
    expect(system.content).toContain('min players');
    expect(system.content).toContain('"minPlayers"');
  });
});

describe('naming convention in prompts', () => {
  it('asks for convention names for trainings and new exercises', () => {
    const [system] = buildTrainingMessages({ goal: 'g', ageGroupTarget: '', totalMinutes: 60, allowNew: true, index: [] });
    expect(system.content).toContain('Focus + focus: objective');
    expect(system.content).toContain('Focus: what it trains');
  });
});
