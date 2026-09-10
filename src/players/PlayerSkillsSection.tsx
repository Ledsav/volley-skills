import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { InfoTooltip } from '../components/InfoTooltip';
import { Input } from '../components/Input';
import { SkillMeter } from '../components/SkillMeter';
import { getSkillGuide } from '../skillGuide/skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';
import type { Player, SkillKey, Skills } from '../types/player';
import { updatePlayerSkills } from './playersApi';
import { computeAvgScore, computeLevel } from './skillMath';
import { SkillRadarChart } from './SkillRadarChart';

const SKILL_LABELS: Record<SkillKey, string> = {
  serve: 'Serve',
  attack: 'Attack',
  block: 'Block',
  set: 'Set',
  defence: 'Defence',
  reception: 'Reception',
  jump: 'Jump',
  speed: 'Speed',
  iq: 'IQ',
};

const SKILL_ORDER = Object.keys(SKILL_LABELS) as SkillKey[];

/** The scoring-guide reminder shown in a skill's ⓘ tooltip. */
function SkillGuideHint({ entry }: { entry: SkillGuideEntry }) {
  return (
    <>
      <p className="mb-1 font-semibold text-ink">{entry.label}</p>
      <ul className="space-y-0.5">
        {entry.ranges.map((range) => (
          <li key={`${range.min}-${range.max}`}>
            <span className="tabular-nums text-slate">
              {range.min}–{range.max}
            </span>{' '}
            {range.description}
          </li>
        ))}
      </ul>
      {entry.howToEvaluate && <p className="mt-2 text-slate">{entry.howToEvaluate}</p>}
    </>
  );
}

interface PlayerSkillsSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export function PlayerSkillsSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
  editing,
  onEditingChange,
}: PlayerSkillsSectionProps) {
  const [skills, setSkills] = useState<Skills>(player.skills);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Record<string, SkillGuideEntry>>({});

  useEffect(() => {
    let active = true;
    getSkillGuide()
      .then((config) => {
        if (active) setGuide(Object.fromEntries(config.skills.map((s) => [s.key, s])));
      })
      .catch(() => {
        /* guide is optional — the tooltips just won't render */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (editing) {
      setSkills(player.skills);
      setError(null);
    }
  }, [editing, player.skills]);

  function updateScore(key: SkillKey, rawValue: string) {
    const score = rawValue === '' ? null : Number(rawValue);
    setSkills((current) => ({ ...current, [key]: { ...current[key], score } }));
  }

  function updatePriority(key: SkillKey, priority: boolean) {
    setSkills((current) => ({ ...current, [key]: { ...current[key], priority } }));
  }

  async function handleSave() {
    setError(null);
    const avgScore = computeAvgScore(skills);
    const level = computeLevel(avgScore);
    try {
      await updatePlayerSkills(teamId, playerId, skills, avgScore, level);
    } catch {
      setError('Could not save skills. Check that every score is between 1 and 10, then try again.');
      return;
    }
    onPlayerUpdated({ ...player, skills, avgScore, level });
    onEditingChange(false);
  }

  const previewAvg = computeAvgScore(skills);
  const previewLevel = computeLevel(previewAvg);

  return (
    <div className="flex h-full flex-col">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
        <div>
          <SkillRadarChart
            scores={SKILL_ORDER.map((key) => player.skills[key]?.score ?? null)}
            labels={SKILL_ORDER.map((key) => SKILL_LABELS[key])}
            level={player.level}
          />
          <p className="mt-2 text-center text-sm text-slate">
            Average: <span className="font-semibold tabular-nums text-ink">{player.avgScore?.toFixed(1) ?? '—'}</span>{' '}
            ({player.level ?? 'No scores yet'})
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {SKILL_ORDER.map((key) => {
            const { score, priority } = player.skills[key] ?? { score: null, priority: false };
            return (
              <li key={key} className="grid grid-cols-[5rem_2rem_1fr] items-center gap-x-3 gap-y-1">
                <span className={`flex items-center gap-1 text-sm font-medium ${priority ? 'text-orange' : 'text-ink'}`}>
                  {SKILL_LABELS[key]}
                  {guide[key] && (
                    <InfoTooltip label={`${SKILL_LABELS[key]} scoring guide`}>
                      <SkillGuideHint entry={guide[key]} />
                    </InfoTooltip>
                  )}
                </span>
                <span className="text-right text-sm tabular-nums text-ink">{score ?? '—'}</span>
                <SkillMeter score={score} />
                {priority && (
                  <span className="col-span-3 w-fit justify-self-start rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
                    Focus area
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {editing && isAdmin && (
        <Dialog title="Edit skills" onClose={() => onEditingChange(false)}>
          <div aria-label="Edit skills">
            <p className="mb-4 text-sm text-slate">
              Average: <span className="font-semibold tabular-nums text-ink">{previewAvg?.toFixed(1) ?? '—'}</span>{' '}
              ({previewLevel ?? 'No scores yet'})
            </p>
            <div className="flex flex-col gap-4">
              {SKILL_ORDER.map((key) => (
                <div
                  key={key}
                  className="grid grid-cols-[7rem_5rem] items-center gap-x-4 gap-y-2 border-b border-border pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[7rem_5rem_1fr_auto]"
                >
                  <span className="flex items-center gap-1">
                    <label htmlFor={`skill-${key}`} className="text-sm font-medium text-ink">
                      {SKILL_LABELS[key]}
                    </label>
                    {guide[key] && (
                      <InfoTooltip label={`${SKILL_LABELS[key]} scoring guide`}>
                        <SkillGuideHint entry={guide[key]} />
                      </InfoTooltip>
                    )}
                  </span>
                  <Input
                    id={`skill-${key}`}
                    type="number"
                    min={1}
                    max={10}
                    value={skills[key].score ?? ''}
                    onChange={(e) => updateScore(key, e.target.value)}
                    className="w-20"
                  />
                  <div className="col-span-2 sm:col-span-1">
                    <SkillMeter score={skills[key].score} />
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-sm text-slate sm:col-span-1">
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
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => onEditingChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleSave()}>
                Save skills
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
