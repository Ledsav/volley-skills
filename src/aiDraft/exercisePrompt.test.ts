import { describe, expect, it } from 'vitest';
import { buildExerciseMessages } from './exercisePrompt';

describe('buildExerciseMessages', () => {
  const msgs = buildExerciseMessages({ request: 'serve receive, 9 players', category: 'reception', count: 3, existingNames: ['Pepper', 'Butterfly'], alreadyProposed: ['Kept one'] });
  const [system, user] = msgs;

  it('is one system and one user message', () => {
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user']);
  });
  it('asks for JSON with the allowed categories and the diagram guide', () => {
    expect(system.content).toContain('{"exercises":[');
    expect(system.content).toContain('warmup, physical, service, setting, defense, reception, attack, compound, game');
    expect(system.content).toContain('Diagram format');
  });
  it('lists library names and already-kept proposals to avoid duplicates', () => {
    expect(system.content).toContain('Pepper; Butterfly');
    expect(user.content).toContain('Kept one');
  });
  it('carries the request, count and category', () => {
    expect(user.content).toContain('serve receive, 9 players');
    expect(user.content).toContain('Count: 3');
    expect(user.content).toContain('Category: reception');
  });
});
