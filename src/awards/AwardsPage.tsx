import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotFoundState } from '../components/NotFoundState';
import { usePageMeta } from '../layout/usePageMeta';
import { getMatch, listFinishedMatches, loadTeamRoster } from '../matches/matchesApi';
import { latestRosterIndex, withCurrentRoster, type Person } from '../teams/stats/rosterIndex';
import { isTeamAdmin } from '../teams/teamAccess';
import { getTeam } from '../teams/teamsApi';
import { EMPTY_AWARDS, type AwardScope, type AwardsInput } from '../types/awards';
import type { Match } from '../types/match';
import type { Team } from '../types/team';
import { AwardsPrepare } from './AwardsPrepare';
import { AwardsPresent } from './AwardsPresent';
import { getSeasonAwards, saveMatchAwards, saveSeasonAwards } from './awardsApi';
import { applyPrepareAction } from './awardsReducer';
import { readThemePrefs, themeFromPrefs, writeThemePrefs, type ThemePrefs } from './card/cardTheme';
import type { CardModel } from './card/drawAwardCard';
import { cardFileName, renderCardPng, shareOrDownload } from './exportCards';
import { readNameStyle, styleName, writeNameStyle, type NameStyle } from './nameStyle';
import { loadImageFile, renderCrop } from './photo';
import { resolveAwards, revealable, type ResolvedAward } from './resolveAwards';

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'notFinished' }
  | { state: 'ready'; team: Team; matches: Match[]; match: Match | null; people: Map<string, Person> };

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function AwardsPage({ scope }: { scope: AwardScope }) {
  const { teamId = '', matchId = '' } = useParams();
  const { firebaseUser, access } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [config, setConfig] = useState<AwardsInput>(EMPTY_AWARDS);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const [mode, setMode] = useState<'prepare' | 'present'>('prepare');
  const [nameStyle, setNameStyle] = useState<NameStyle>(readNameStyle);
  const [themePrefs, setThemePrefs] = useState<ThemePrefs>(readThemePrefs);
  const [photos, setPhotos] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [background, setBackground] = useState<HTMLCanvasElement | null>(null);
  const dirty = useRef(false);
  usePageMeta({ title: scope === 'season' ? 'Season awards' : 'Match awards' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const team = await getTeam(teamId);
        if (!team || !isTeamAdmin(team, firebaseUser?.email, access)) {
          if (!cancelled) setLoad({ state: 'notFound' });
          return;
        }
        const [roster, matches, match, saved] = await Promise.all([
          loadTeamRoster(teamId).catch(() => []),
          scope === 'season' ? listFinishedMatches(teamId) : Promise.resolve([] as Match[]),
          scope === 'match' ? getMatch(teamId, matchId) : Promise.resolve(null),
          scope === 'season' ? getSeasonAwards(teamId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (scope === 'match' && !match) return setLoad({ state: 'notFound' });
        if (scope === 'match' && match!.status !== 'finished') return setLoad({ state: 'notFinished' });
        const all = scope === 'match' ? [match!] : matches;
        setConfig((scope === 'match' ? match!.awards : saved) ?? EMPTY_AWARDS);
        setLoad({ state: 'ready', team, matches: all, match, people: withCurrentRoster(latestRosterIndex(all), roster) });
      } catch {
        if (!cancelled) setLoad({ state: 'notFound' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, matchId, scope, firebaseUser?.email, access]);

  // Debounced save, not awaited for UI (offline-safe persistent cache).
  useEffect(() => {
    if (!dirty.current || load.state !== 'ready') return;
    setSaveState(navigator.onLine === false ? 'offline' : 'saving');
    const id = window.setTimeout(() => {
      const uid = firebaseUser?.uid ?? '';
      const write = scope === 'season' ? saveSeasonAwards(teamId, config, uid) : saveMatchAwards(teamId, matchId, config, uid);
      write.then(() => setSaveState('saved')).catch(() => setSaveState('error'));
    }, 800);
    return () => window.clearTimeout(id);
  }, [config, load.state, scope, teamId, matchId, firebaseUser?.uid]);

  // Release in-memory images on leave.
  useEffect(() => () => { photos.forEach((c) => { c.width = 0; }); }, [photos]);

  const ready = load.state === 'ready' ? load : null;
  const awards: ResolvedAward[] = useMemo(
    () => (ready ? resolveAwards(scope, ready.matches, config, ready.people) : []),
    [ready, scope, config],
  );
  const theme = themeFromPrefs(themePrefs);
  const heading = ready ? (scope === 'season' ? `Season ${ready.team.season}` : `vs ${ready.match!.opponent} · ${fmtDate(ready.match!.date)}`) : '';

  const cardFor = useCallback((a: ResolvedAward): CardModel | null => {
    if (!ready || !a.winner) return null;
    return {
      key: a.key, awardTitle: a.title, name: styleName(a.winner, nameStyle), number: a.winner.number,
      statLine: a.statLine, footer: heading, teamName: ready.team.name, note: a.note,
    };
  }, [ready, nameStyle, heading]);

  const artFor = useCallback((key: string) => ({ photo: photos.get(key) ?? null, background }), [photos, background]);

  async function exportKeys(keys: string[]) {
    if (!ready) return;
    const files: File[] = [];
    for (const a of awards.filter((x) => keys.includes(x.key))) {
      const card = cardFor(a);
      if (!card) continue;
      const blob = await renderCardPng(card, theme, artFor(a.key));
      const name = cardFileName(a.key, scope === 'match' ? { kind: 'match', date: ready.match!.date, opponent: ready.match!.opponent } : { kind: 'season', season: ready.team.season });
      files.push(new File([blob], name, { type: 'image/png' }));
    }
    if (files.length) await shareOrDownload(files, heading);
  }

  if (load.state === 'loading') return <p className="p-6 text-slate">Loading awards…</p>;
  if (load.state === 'notFound') return <NotFoundState title="Awards not found" message="The team or match may not exist, or you don't have access." backTo={`/teams/${teamId}`} backLabel="Back to team" />;
  if (load.state === 'notFinished') return <NotFoundState title="Match awards" message="Awards are available once the match is finished." backTo={`/teams/${teamId}/matches/${matchId}`} backLabel="Back to match" />;
  if (!ready) return null;

  if (mode === 'present') {
    const cards = revealable(awards).map((a) => ({ key: a.key, title: a.title, model: cardFor(a)! }));
    return <AwardsPresent cards={cards} theme={theme} artFor={artFor} onExit={() => setMode('prepare')} />;
  }

  return (
    <AwardsPrepare
      heading={heading}
      awards={awards}
      people={[...ready.people.values()].sort((a, b) => Number(b.current) - Number(a.current) || (a.number ?? 999) - (b.number ?? 999))}
      saveState={saveState}
      nameStyle={nameStyle}
      onNameStyle={(s) => { setNameStyle(s); writeNameStyle(s); }}
      themePrefs={themePrefs}
      onThemePrefs={(p) => { setThemePrefs(p); writeThemePrefs(p); }}
      hasBackground={!!background}
      onBackground={(file) => {
        if (!file) return setBackground(null);
        void loadImageFile(file).then((bmp) => {
          const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
          const c = renderCrop(bmp, { cx: 0.5, cy: 0.5, zoom: 1 }, Math.round(Math.min(bmp.width, bmp.height) * scale));
          bmp.close();
          setBackground(c);
        }).catch(() => undefined);
      }}
      photos={photos}
      onPhoto={(key, img) => setPhotos((prev) => { const next = new Map(prev); if (img) next.set(key, img); else next.delete(key); return next; })}
      cardFor={cardFor}
      onAction={(a) => {
        dirty.current = true;
        setConfig((c) => applyPrepareAction(c, a, awards.map((x) => x.key), () => `c-${Date.now().toString(36)}`));
      }}
      onPresent={() => setMode('present')}
      onExportAll={() => void exportKeys(revealable(awards).map((a) => a.key))}
      onExportOne={(key) => void exportKeys([key])}
      onClose={() => navigate(scope === 'season' ? `/teams/${teamId}?tab=stats` : `/teams/${teamId}/matches/${matchId}`)}
    />
  );
}
