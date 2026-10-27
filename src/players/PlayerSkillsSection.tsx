import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Target } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { InfoTooltip } from '../components/InfoTooltip';
import { Input } from '../components/Input';
import { SkillMeter } from '../components/SkillMeter';
import { getSkillGuide } from '../skillGuide/skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';
import { SKILL_KEYS, type Player, type SkillKey, type Skills } from '../types/player';
import { updatePlayerSkills } from './playersApi';
import { suggestedScore, type MatchRatings } from './matchRating';
import { computeAvgScore, computeLevel } from './skillMath';
import { SkillRadarChart } from './SkillRadarChart';
import { useNotify } from '../components/Notice';
import { formatNumber } from '../i18n/format';
import { useLocale, useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const SKILL_ORDER = SKILL_KEYS;

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
  /** Team admins only: season match ratings per skill. Absent → no match lines. */
  ratings?: MatchRatings;
  /** Header toggle state: show match suggestions (ghost segments + Adapt). Defaults to on. */
  showSuggestions?: boolean;
  /** The team's grammatical gender, for the level wording. */
  gender?: Gender;
}

export function PlayerSkillsSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
  editing,
  onEditingChange,
  ratings,
  showSuggestions = true,
  gender = 'mixed',
}: PlayerSkillsSectionProps) {
  const notify = useNotify();
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const { locale } = useLocale();
  // Italian skill names are longer ("Lettura del gioco"), so their label column is wider.
  const listGridClass = locale === 'it' ? 'grid-cols-[9.5rem_2rem_1fr_3.5rem]' : 'grid-cols-[6.5rem_2rem_1fr_3.5rem]';
  const editGridClass =
    locale === 'it' ? 'grid-cols-[9rem_5rem] sm:grid-cols-[9rem_5rem_1fr_auto]' : 'grid-cols-[7rem_5rem] sm:grid-cols-[7rem_5rem_1fr_auto]';
  const matchLine = (rating: { rating: number | null; attempts: number }): string =>
    rating.rating === null
      ? p.skills.matchNoData(rating.attempts)
      : p.skills.matchRated(formatNumber(rating.rating, 1), rating.attempts);
  const [skills, setSkills] = useState<Skills>(player.skills);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Record<string, SkillGuideEntry>>({});

  // Follows the catalog: with no saved guide the fallback is in the active language, and the Italian
  // catalog can arrive after first paint. A late answer for the old language must not overwrite the new one.
  const guideCatalog = t.skillGuide;
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
  }, [guideCatalog]);

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
      setError(p.skills.saveFailedRange);
      return;
    }
    onPlayerUpdated({ ...player, skills, avgScore, level });
    onEditingChange(false);
  }

  /** The score match data suggests, when suggestions are on and it would change `score`. */
  const suggestionFor = (rating: MatchRatings[SkillKey] | undefined, score: number | null): number | null => {
    if (!rating || !showSuggestions || rating.rating == null) return null;
    const suggested = suggestedScore(rating.rating);
    return suggested === score ? null : suggested;
  };

  async function adapt(key: SkillKey, score: number) {
    setError(null);
    const next = { ...player.skills, [key]: { ...player.skills[key], score } };
    const avgScore = computeAvgScore(next);
    const level = computeLevel(avgScore);
    try {
      await updatePlayerSkills(teamId, playerId, next, avgScore, level);
    } catch {
      setError(p.skills.saveFailed);
      return;
    }
    onPlayerUpdated({ ...player, skills: next, avgScore, level });
    notify(p.skills.adapted(lb.playerSkill[key], score));
  }

  const previewAvg = computeAvgScore(skills);
  const previewLevel = computeLevel(previewAvg);

  return (
    <div className="flex h-full flex-col">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
        <div>
          <SkillRadarChart
            scores={SKILL_ORDER.map((key) => player.skills[key]?.score ?? null)}
            labels={SKILL_ORDER.map((key) => lb.playerSkill[key])}
            level={player.level}
          />
          <p className="mt-2 text-center text-sm text-slate">
            {p.skills.average} <span className="font-semibold tabular-nums text-ink">{player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}</span>{' '}
            ({player.level ? lb.level[player.level](gender) : p.shared.noScores})
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {SKILL_ORDER.map((key) => {
            const { score, priority } = player.skills[key] ?? { score: null, priority: false };
            const rating = ratings?.[key];
            const suggested = suggestionFor(rating, score);
            return (
              <li key={key} className={`grid ${listGridClass} items-center gap-x-2`}>
                <span className={`flex items-center gap-1 text-sm font-medium ${priority ? 'text-orange-strong' : 'text-ink'}`}>
                  {lb.playerSkill[key]}
                  {guide[key] && (
                    <InfoTooltip label={p.skills.scoringGuide(lb.playerSkill[key])}>
                      <SkillGuideHint entry={guide[key]} />
                    </InfoTooltip>
                  )}
                  {priority && (
                    <Target
                      role="img"
                      aria-label={p.skills.focusArea}
                      className="h-3.5 w-3.5 shrink-0 text-orange-strong"
                    />
                  )}
                </span>
                <span className="text-right text-sm tabular-nums text-ink">{score ?? '—'}</span>
                <div title={suggested !== null && rating ? p.skills.suggests(matchLine(rating), suggested) : undefined}>
                  <SkillMeter score={score} suggested={suggested} />
                </div>
                {suggested !== null && isAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={p.skills.adaptAria(lb.playerSkill[key], suggested)}
                    onClick={() => void adapt(key, suggested)}
                    className={`!min-h-0 gap-0.5 !px-1.5 !py-0.5 text-xs tabular-nums ${suggested > (score ?? 0) ? 'text-green-strong hover:bg-green/10' : 'text-orange-strong hover:bg-orange/10'}`}
                  >
                    {suggested > (score ?? 0) ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                    {suggested}
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {editing && isAdmin && (
        <Dialog title={p.skills.editTitle} onClose={() => onEditingChange(false)} guardUnsaved>
          <div aria-label={p.skills.editTitle}>
            <p className="mb-4 text-sm text-slate">
              {p.skills.average} <span className="font-semibold tabular-nums text-ink">{previewAvg != null ? formatNumber(previewAvg, 1) : '—'}</span>{' '}
              ({previewLevel ? lb.level[previewLevel](gender) : p.shared.noScores})
            </p>
            <div className="flex flex-col gap-4">
              {SKILL_ORDER.map((key) => {
                const rating = ratings?.[key];
                const value = rating?.rating ?? null;
                return (
                  <div
                    key={key}
                    className={`grid ${editGridClass} items-center gap-x-4 gap-y-2 border-b border-border pb-4 last:border-b-0 last:pb-0`}
                  >
                    <span className="flex items-center gap-1">
                      <label htmlFor={`skill-${key}`} className="text-sm font-medium text-ink">
                        {lb.playerSkill[key]}
                      </label>
                      {guide[key] && (
                        <InfoTooltip label={p.skills.scoringGuide(lb.playerSkill[key])}>
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
                      {p.skills.focusArea}
                    </label>
                    {suggestionFor(rating, skills[key].score) !== null && rating && value !== null && (
                      <div className="col-span-2 flex items-center gap-2 text-xs tabular-nums text-slate sm:col-span-4">
                        <div className="w-40" title={matchLine(rating)}>
                          <SkillMeter score={skills[key].score} suggested={suggestedScore(value)} />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={p.skills.useAria(lb.playerSkill[key], suggestedScore(value))}
                          onClick={() => updateScore(key, String(suggestedScore(value)))}
                          className="!min-h-0 gap-0.5 !px-1.5 !py-0.5 text-xs"
                        >
                          {suggestedScore(value) > (skills[key].score ?? 0) ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                          {suggestedScore(value)}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => onEditingChange(false)}>
                {t.common.cancel}
              </Button>
              <Button variant="primary" onClick={() => void handleSave()}>
                {p.skills.saveSkills}
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
