import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Target } from 'lucide-react';
import { Button } from '../components/Button';
import { InfoTooltip } from '../components/InfoTooltip';
import { Input } from '../components/Input';
import { Sheet } from '../components/Sheet';
import { SkillMeter } from '../components/SkillMeter';
import { getSkillGuide } from '../skillGuide/skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';
import { SKILL_KEYS, type Player, type SkillKey, type Skills } from '../types/player';
import { updatePlayerSkills } from './playersApi';
import { suggestedScore, type MatchRatings } from './matchRating';
import { computeAvgScore, computeLevel } from './skillMath';
import { SkillRadarChart } from './SkillRadarChart';
import { useNotify } from '../components/Notice';
import { useSave } from '../components/useSave';
import { usePlayerSync } from './playerSync';
import { formatNumber } from '../i18n/format';
import { useLocale, useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const SKILL_ORDER = SKILL_KEYS;

/** The scoring-guide reminder shown in a skill's ⓘ tooltip. */
function SkillGuideHint({ entry }: { entry: SkillGuideEntry }) {
  return (
    <>
      <p className="mb-1 text-headline text-ink">{entry.label}</p>
      <ul className="space-y-0.5">
        {entry.ranges.map((range) => (
          <li key={`${range.min}-${range.max}`}>
            <span className="tabular-nums text-ink-2">
              {range.min}–{range.max}
            </span>{' '}
            {range.description}
          </li>
        ))}
      </ul>
      {entry.howToEvaluate && <p className="mt-2 text-ink-2">{entry.howToEvaluate}</p>}
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
  const sync = usePlayerSync();
  const { save } = useSave();
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const { locale } = useLocale();
  // Italian skill names are longer ("Lettura del gioco"), so their label column is wider.
  const listGridClass = locale === 'it' ? 'grid-cols-[9.5rem_1fr_2rem_4.5rem]' : 'grid-cols-[6.5rem_1fr_2rem_4.5rem]';
  const matchLine = (rating: { rating: number | null; attempts: number }): string =>
    rating.rating === null
      ? p.skills.matchNoData(rating.attempts)
      : p.skills.matchRated(formatNumber(rating.rating, 1), rating.attempts);
  const [skills, setSkills] = useState<Skills>(player.skills);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await doSave();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function doSave() {
    setError(null);
    const avgScore = computeAvgScore(skills);
    const level = computeLevel(avgScore);
    try {
      const done = await save(() => updatePlayerSkills(teamId, playerId, skills, avgScore, level), {
        onQueued: (w) => sync.queued('skills', w),
      });
      if (!done) return;
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
    let queued = false;
    try {
      const done = await save(() => updatePlayerSkills(teamId, playerId, next, avgScore, level), {
        onQueued: (w) => {
          queued = true;
          sync.queued('skills', w);
        },
      });
      if (!done) return;
    } catch {
      setError(p.skills.saveFailed);
      return;
    }
    onPlayerUpdated({ ...player, skills: next, avgScore, level });
    if (!queued) notify(p.skills.adapted(lb.playerSkill[key], score));
  }

  const previewAvg = computeAvgScore(skills);
  const previewLevel = computeLevel(previewAvg);

  return (
    <div className="flex h-full flex-col">
      {/* The radar gets a real column (≥ 260 px, labels at caption size) and sits at the top, beside the meters. */}
      <div className="grid gap-4 md:grid-cols-[minmax(260px,340px)_1fr] md:items-start md:gap-6">
        <div>
          <SkillRadarChart
            scores={SKILL_ORDER.map((key) => player.skills[key]?.score ?? null)}
            labels={SKILL_ORDER.map((key) => lb.playerSkill[key])}
            level={player.level}
          />
          <p className="mt-2 text-center text-callout text-ink-2">
            {p.skills.average} <span className="font-semibold tabular-nums text-ink">{player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}</span>{' '}
            ({player.level ? lb.level[player.level](gender) : p.shared.noScores})
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-separator">
          {SKILL_ORDER.map((key) => {
            const { score, priority } = player.skills[key] ?? { score: null, priority: false };
            const rating = ratings?.[key];
            const suggested = suggestionFor(rating, score);
            const up = suggested !== null && suggested > (score ?? 0);
            return (
              <li key={key} className={`grid min-h-[52px] ${listGridClass} items-center gap-x-3`}>
                <span className={`flex items-center gap-1 text-callout ${priority ? 'text-orange-strong' : 'text-ink'}`}>
                  {lb.playerSkill[key]}
                  {priority && (
                    <Target
                      role="img"
                      aria-label={p.skills.focusArea}
                      className="h-3.5 w-3.5 shrink-0 text-orange-strong"
                    />
                  )}
                  {guide[key] && (
                    <InfoTooltip label={p.skills.scoringGuide(lb.playerSkill[key])}>
                      <SkillGuideHint entry={guide[key]} />
                    </InfoTooltip>
                  )}
                </span>
                <div className="min-w-0 flex-1" title={suggested !== null && rating ? p.skills.suggests(matchLine(rating), suggested) : undefined}>
                  <SkillMeter score={score} suggested={suggested} />
                </div>
                <span className="text-right text-headline tabular-nums text-ink">{score ?? '—'}</span>
                {suggested !== null && isAdmin ? (
                  <button
                    type="button"
                    aria-label={p.skills.adaptAria(lb.playerSkill[key], suggested)}
                    onClick={() => void adapt(key, suggested)}
                    className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-0.5 rounded-full px-3 text-footnote tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      up ? 'bg-green-tint text-green-strong' : 'bg-orange-tint text-orange-strong'
                    }`}
                  >
                    {up ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                    {suggested}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {isAdmin && SKILL_ORDER.some((key) => suggestionFor(ratings?.[key], player.skills[key]?.score ?? null) !== null) && (
        <p className="mt-3 flex items-center gap-1.5 text-footnote text-ink-2">
          <span aria-hidden="true" className="inline-flex items-center rounded-full bg-green-tint px-1.5 text-green-strong">
            <ArrowUp className="h-3 w-3" />
          </span>
          {p.skills.suggestionLegend}
        </p>
      )}

      {editing && isAdmin && (
        <Sheet
          title={p.skills.editTitle}
          detent="large"
          onClose={() => onEditingChange(false)}
          guardUnsaved
          confirm={{ label: t.common.save, onConfirm: () => void handleSave(), disabled: saving }}
        >
          <div>
            <p className="mb-4 text-callout text-ink-2">
              {p.skills.average} <span className="font-semibold tabular-nums text-ink">{previewAvg != null ? formatNumber(previewAvg, 1) : '—'}</span>{' '}
              ({previewLevel ? lb.level[previewLevel](gender) : p.shared.noScores})
            </p>
            <div className="flex flex-col">
              {SKILL_ORDER.map((key) => {
                const rating = ratings?.[key];
                const value = rating?.rating ?? null;
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-2 border-b border-separator py-4 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span className="flex items-center gap-1">
                      <label htmlFor={`skill-${key}`} className="text-headline text-ink">
                        {lb.playerSkill[key]}
                      </label>
                      {guide[key] && (
                        <InfoTooltip label={p.skills.scoringGuide(lb.playerSkill[key])}>
                          <SkillGuideHint entry={guide[key]} />
                        </InfoTooltip>
                      )}
                    </span>
                    <div className="flex items-center gap-4">
                      <Input
                        id={`skill-${key}`}
                        type="number"
                        min={1}
                        max={10}
                        value={skills[key].score ?? ''}
                        onChange={(e) => updateScore(key, e.target.value)}
                        className="w-20 tabular-nums"
                      />
                      <div className="min-w-0 flex-1">
                        <SkillMeter score={skills[key].score} />
                      </div>
                    </div>
                    <label className="flex min-h-11 items-center gap-2 text-callout text-ink-2">
                      <input
                        type="checkbox"
                        checked={skills[key].priority}
                        onChange={(e) => updatePriority(key, e.target.checked)}
                      />
                      {p.skills.focusArea}
                    </label>
                    {suggestionFor(rating, skills[key].score) !== null && rating && value !== null && (
                      // One line: what the match data says, and a button that applies it (no second meter).
                      <div className="flex items-center gap-3 text-footnote tabular-nums text-ink-2">
                        <span className="min-w-0 flex-1">{p.skills.suggests(matchLine(rating), suggestedScore(value))}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={p.skills.useAria(lb.playerSkill[key], suggestedScore(value))}
                          onClick={() => updateScore(key, String(suggestedScore(value)))}
                          className={`min-h-11 shrink-0 gap-1 rounded-full !px-3 text-footnote tabular-nums ${
                            suggestedScore(value) > (skills[key].score ?? 0) ? 'bg-green-tint text-green-strong' : 'bg-orange-tint text-orange-strong'
                          }`}
                        >
                          {suggestedScore(value) > (skills[key].score ?? 0) ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                          {p.skills.use(suggestedScore(value))}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-strong">
                {error}
              </p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
