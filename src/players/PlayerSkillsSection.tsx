import { useState } from 'react';
import { updatePlayerSkills } from './playersApi';
import { computeAvgScore, computeLevel } from './skillMath';
import { SkillMeter } from '../components/SkillMeter';
import type { Player, SkillKey, Skills } from '../types/player';

const SKILL_LABELS: Record<SkillKey, string> = {
  serve: 'Serve',
  attack: 'Attack',
  set: 'Set',
  defence: 'Defence',
  reception: 'Reception',
  jump: 'Jump',
  speed: 'Speed',
  iq: 'IQ',
};

const SKILL_ORDER = Object.keys(SKILL_LABELS) as SkillKey[];

interface PlayerSkillsSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
}

export function PlayerSkillsSection({ teamId, playerId, player, onPlayerUpdated }: PlayerSkillsSectionProps) {
  const [skills, setSkills] = useState<Skills>(player.skills);

  function updateScore(key: SkillKey, rawValue: string) {
    const score = rawValue === '' ? null : Number(rawValue);
    setSkills((current) => ({ ...current, [key]: { ...current[key], score } }));
  }

  function updatePriority(key: SkillKey, priority: boolean) {
    setSkills((current) => ({ ...current, [key]: { ...current[key], priority } }));
  }

  async function handleSave() {
    const avgScore = computeAvgScore(skills);
    const level = computeLevel(avgScore);
    await updatePlayerSkills(teamId, playerId, skills, avgScore, level);
    onPlayerUpdated({ ...player, skills, avgScore, level });
  }

  const previewAvg = computeAvgScore(skills);
  const previewLevel = computeLevel(previewAvg);

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Skills</h2>
      <div className="mt-4 flex flex-col gap-4">
        {SKILL_ORDER.map((key) => (
          <div key={key} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
            <label htmlFor={`skill-${key}`} className="w-24 shrink-0 text-sm font-medium text-ink">
              {SKILL_LABELS[key]}
            </label>
            <input
              id={`skill-${key}`}
              type="number"
              min={1}
              max={10}
              value={skills[key].score ?? ''}
              onChange={(e) => updateScore(key, e.target.value)}
              className="w-20 shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
            <div className="min-w-[8rem] flex-1">
              <SkillMeter score={skills[key].score} />
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm text-slate">
              <input
                type="checkbox"
                checked={skills[key].priority}
                onChange={(e) => updatePriority(key, e.target.checked)}
                className="h-4 w-4 rounded-sm border-border text-blue focus:outline-none focus:ring-2 focus:ring-blue"
              />
              Focus area
            </label>
          </div>
        ))}
      </div>
      <p className="mt-4 text-slate">
        Average: {previewAvg?.toFixed(1) ?? '—'} ({previewLevel ?? 'No scores yet'})
      </p>
      <button
        onClick={() => void handleSave()}
        className="mt-4 rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        Save skills
      </button>
    </section>
  );
}
