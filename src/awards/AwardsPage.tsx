import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { usePageMeta } from '../layout/usePageMeta';
import { getMatch, listFinishedMatches, loadTeamRoster } from '../matches/matchesApi';
import { latestRosterIndex, withCurrentRoster, type Person } from '../teams/stats/rosterIndex';
import { isTeamAdmin } from '../teams/teamAccess';
import { getTeam } from '../teams/teamsApi';
import { EMPTY_AWARDS, type AwardScope, type AwardsInput } from '../types/awards';
import type { Match } from '../types/match';
import type { Team } from '../types/team';
import { AwardsPrepare } from './AwardsPrepare';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { markShareWarned, needsShareWarning } from './shareWarning';
import { AwardsPresent } from './AwardsPresent';
import { getSeasonAwards, saveMatchAwards, saveSeasonAwards } from './awardsApi';
import { applyPrepareAction } from './awardsReducer';
import { drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';
import { readPalettePrefs, selectedPalette, slideColors, writePalettePrefs, type PalettePrefs } from './palette';
import type { StoryDeps } from './card/drawSlide';
import { buildStory, colorIndexForAward } from './story/buildStory';
import { readStoryPref, writeStoryPref } from './story/storyPref';
import { storyStats } from './story/storyStats';
import { cardFileName, ensureCardFonts, renderPng, shareOrDownload } from './exportCards';
import { readNameStyle, styleName, writeNameStyle, type NameStyle } from './nameStyle';
import { fitSize, loadImageFile } from './photo';
import { resolveAwards, revealable, type ResolvedAward } from './resolveAwards';

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'notFinished' }
  | { state: 'error' }
  | { state: 'ready'; team: Team; matches: Match[]; match: Match | null; people: Map<string, Person>; consented: Set<string> };

const NO_CONSENT = new Set<string>();

/** Awards whose winner is a current player with photo consent; only these may carry a photo or cut-out. */
export function photoAllowedKeys(awards: ResolvedAward[], consented: Set<string>): Set<string> {
  return new Set(awards.filter((a) => a.winner && consented.has(a.winner.playerId)).map((a) => a.key));
}

/** Card art for one award: photo and cut-out only while the winner has photo consent. */
export function gatedArt(
  key: string, allowed: Set<string>, photos: Map<string, HTMLCanvasElement>, cutouts: Map<string, HTMLCanvasElement>, background: HTMLCanvasElement | null,
): CardArt {
  const ok = allowed.has(key);
  return { photo: ok ? photos.get(key) ?? null : null, cutout: ok ? cutouts.get(key) ?? null : null, background };
}

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
  const [palettePrefs, setPalettePrefs] = useState<PalettePrefs>(readPalettePrefs);
  const [photos, setPhotos] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [cutouts, setCutouts] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [background, setBackground] = useState<HTMLCanvasElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dirty = useRef(false);
  const configRef = useRef<AwardsInput>(EMPTY_AWARDS);
  const photosRef = useRef(photos);
  const cutoutsRef = useRef(cutouts);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const saveSeq = useRef(0);
  const target = useRef({ scope, teamId, matchId, uid: firebaseUser?.uid ?? '' });
  useEffect(() => {
    target.current = { scope, teamId, matchId, uid: firebaseUser?.uid ?? '' };
  });
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
        // Fonts must be ready before the first draw; a font failure never blocks.
        try { await ensureCardFonts(); } catch { /* fall back to system font */ }
        if (cancelled) return;
        const initial = (scope === 'match' ? match!.awards : saved) ?? EMPTY_AWARDS;
        configRef.current = initial;
        setConfig(initial);
        setLoad({ state: 'ready', team, matches: all, match, people: withCurrentRoster(latestRosterIndex(all), roster), consented: new Set(roster.filter((p) => p.consent?.given).map((p) => p.id)) });
      } catch (e) {
        if (!cancelled) setLoad({ state: isNotFoundError(e) ? 'notFound' : 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, matchId, scope, firebaseUser?.email, access, attempt]);

  // Write the latest config now. `track` updates the indicator; a stale write never shows "Saved".
  const writeNow = useCallback((track: boolean) => {
    const t = target.current;
    const n = ++saveSeq.current;
    dirty.current = false;
    const write = t.scope === 'season' ? saveSeasonAwards(t.teamId, configRef.current, t.uid) : saveMatchAwards(t.teamId, t.matchId, configRef.current, t.uid);
    write.then(
      () => { if (track && n === saveSeq.current) setSaveState('saved'); },
      () => { if (track && n === saveSeq.current) setSaveState('error'); },
    );
  }, []);

  // Debounced save, not awaited for UI (offline-safe persistent cache).
  useEffect(() => {
    if (!dirty.current || load.state !== 'ready') return;
    setSaveState(navigator.onLine === false ? 'offline' : 'saving');
    const id = window.setTimeout(() => writeNow(true), 800);
    return () => window.clearTimeout(id);
  }, [config, load.state, writeNow]);

  // Flush a pending edit when leaving (unmount, tab hide/close).
  useEffect(() => {
    const flush = () => { if (dirty.current) writeNow(false); };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [writeNow]);

  // Release in-memory images on leave only.
  useEffect(() => () => {
    photosRef.current.forEach((c) => { c.width = 0; });
    cutoutsRef.current.forEach((c) => { c.width = 0; });
    if (backgroundRef.current) backgroundRef.current.width = 0;
  }, []);

  const ready = load.state === 'ready' ? load : null;
  const awards: ResolvedAward[] = useMemo(
    () => (ready ? resolveAwards(scope, ready.matches, config, ready.people) : []),
    [ready, scope, config],
  );
  const heading = ready ? (scope === 'season' ? `Season ${ready.team.season}` : `vs ${ready.match!.opponent} · ${fmtDate(ready.match!.date)}`) : '';

  const cardFor = useCallback((a: ResolvedAward): CardModel | null => {
    if (!ready || !a.winner) return null;
    return {
      key: a.key, awardTitle: a.title, name: styleName(a.winner, nameStyle), number: a.winner.number,
      statLine: a.statLine, footer: heading, teamName: ready.team.name, clubName: ready.team.club ?? '', note: a.note,
    };
  }, [ready, nameStyle, heading]);

  const allowed = useMemo(() => photoAllowedKeys(awards, ready?.consented ?? NO_CONSENT), [awards, ready]);
  const artFor = useCallback((key: string) => gatedArt(key, allowed, photos, cutouts, background), [allowed, photos, cutouts, background]);

  const cards = useMemo(
    () => revealable(awards).map((a) => ({ key: a.key, title: a.title, model: cardFor(a)! })),
    [awards, cardFor],
  );
  const [includeStory, setIncludeStory] = useState(readStoryPref);
  const palette = useMemo(() => selectedPalette(palettePrefs), [palettePrefs]);
  const stats = useMemo(() => (ready ? storyStats(scope, ready.matches, ready.people) : []), [ready, scope]);
  const slides = useMemo(() => buildStory({
    introTitle: ready ? (scope === 'season' ? `Season ${ready.team.season}` : `vs ${ready.match!.opponent}`) : '',
    teamName: ready?.team.name ?? '', stats, awardCount: cards.length, includeStory,
  }), [ready, scope, stats, cards.length, includeStory]);
  const colorsFor = useCallback((key: string) => {
    const i = cards.findIndex((c) => c.key === key);
    return slideColors(palette, colorIndexForAward(slides, Math.max(0, i)));
  }, [cards, palette, slides]);
  const deps: StoryDeps = useMemo(() => ({ palette, cards, artFor, clubName: ready?.team.club ?? '' }), [palette, cards, artFor, ready]);

  const dropCutout = useCallback((key: string) => {
    const next = new Map(cutoutsRef.current);
    const old = next.get(key);
    if (!old) return;
    next.delete(key);
    cutoutsRef.current = next;
    setCutouts(next);
    old.width = 0;
  }, []);

  const onCutout = useCallback(async (key: string, on: boolean) => {
    if (!on) return dropCutout(key);
    const photo = photosRef.current.get(key);
    if (!photo) return;
    const { removeBackground } = await import('./cutout/segment');
    const cut = await removeBackground(photo); // rejects → the prepare screen shows the error, original kept
    dropCutout(key);
    const next = new Map(cutoutsRef.current).set(key, cut);
    cutoutsRef.current = next;
    setCutouts(next);
  }, [dropCutout]);

  // The first share in a browser session asks the coach to confirm (images of minors).
  const [pendingShare, setPendingShare] = useState<(() => void) | null>(null);
  const guardShare = (run: () => Promise<void>) => {
    const go = () => void run();
    if (needsShareWarning()) setPendingShare(() => go);
    else go();
  };

  async function exportKeys(keys: string[]) {
    if (!ready) return;
    setNotice(null);
    try {
      await doExport(ready, keys);
    } catch {
      setNotice('Could not export the cards. Please try again.');
    }
  }

  async function doExport(ready: Extract<Load, { state: 'ready' }>, keys: string[]) {
    const files: File[] = [];
    for (const a of awards.filter((x) => keys.includes(x.key))) {
      const card = cardFor(a);
      if (!card) continue;
      const blob = await renderPng((ctx) => drawAwardCard(ctx, card, colorsFor(a.key), artFor(a.key), 1));
      const name = cardFileName(a.key, scope === 'match' ? { kind: 'match', date: ready.match!.date, opponent: ready.match!.opponent } : { kind: 'season', season: ready.team.season });
      files.push(new File([blob], name, { type: 'image/png' }));
    }
    if (files.length) await shareOrDownload(files, heading);
  }

  if (load.state === 'loading') return <p className="p-6 text-slate">Loading awards…</p>;
  if (load.state === 'notFound') return <NotFoundState title="Awards not found" message="The team or match may not exist, or you don't have access." backTo={`/teams/${teamId}`} backLabel="Back to team" />;
  if (load.state === 'notFinished') return <NotFoundState title="Match awards" message="Awards are available once the match is finished." backTo={`/teams/${teamId}/matches/${matchId}`} backLabel="Back to match" />;
  if (load.state === 'error') {
    return (
      <div className="p-6">
        <p role="alert" className="text-red">Could not load awards.</p>
        <Button variant="secondary" className="mt-3" onClick={() => { setLoad({ state: 'loading' }); setAttempt((n) => n + 1); }}>Try again</Button>
      </div>
    );
  }
  if (!ready) return null;

  if (mode === 'present') {
    return <AwardsPresent slides={slides} deps={deps} onExit={() => setMode('prepare')} />;
  }

  return (
    <>
    <AwardsPrepare
      heading={heading}
      photoAllowed={(k) => allowed.has(k)}
      cutouts={cutouts}
      onCutout={onCutout}
      awards={awards}
      people={[...ready.people.values()].sort((a, b) => Number(b.current) - Number(a.current) || (a.number ?? 999) - (b.number ?? 999))}
      saveState={saveState}
      nameStyle={nameStyle}
      onNameStyle={(s) => { setNameStyle(s); writeNameStyle(s); }}
      palettePrefs={palettePrefs}
      onPalettePrefs={(p) => { setPalettePrefs(p); writePalettePrefs(p); }}
      includeStory={includeStory}
      onIncludeStory={(on) => { setIncludeStory(on); writeStoryPref(on); }}
      storyLabel={scope === 'season' ? 'Include season story' : 'Include match story'}
      colorsFor={colorsFor}
      hasBackground={!!background}
      notice={notice}
      artFor={artFor}
      onBackground={(file) => {
        setNotice(null);
        const swap = (next: HTMLCanvasElement | null) => {
          const old = backgroundRef.current;
          backgroundRef.current = next;
          setBackground(next);
          if (old) old.width = 0;
        };
        if (!file) return swap(null);
        void loadImageFile(file).then((bmp) => {
          const { w, h } = fitSize(bmp.width, bmp.height, 1920);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
          bmp.close();
          swap(c);
        }).catch(() => setNotice('Could not load that background image.'));
      }}
      photos={photos}
      onPhoto={(key, img) => {
        const next = new Map(photosRef.current);
        const old = next.get(key);
        if (img) next.set(key, img); else next.delete(key);
        photosRef.current = next;
        setPhotos(next);
        if (old && old !== img) old.width = 0;
        dropCutout(key); // a new or removed photo invalidates its cut-out
      }}
      cardFor={cardFor}
      onAction={(a) => {
        dirty.current = true;
        const next = applyPrepareAction(configRef.current, a, awards.map((x) => x.key), () => `c-${Date.now().toString(36)}`);
        configRef.current = next;
        setConfig(next);
      }}
      onPresent={() => setMode('present')}
      onExportAll={() => guardShare(() => exportKeys(revealable(awards).map((a) => a.key)))}
      onExportOne={(key) => guardShare(() => exportKeys([key]))}
      onClose={() => navigate(scope === 'season' ? `/teams/${teamId}?tab=stats` : `/teams/${teamId}/matches/${matchId}`)}
    />
    {pendingShare && (
      <ConfirmDialog
        title="Share award cards"
        message="You're about to share images of minors. Share them only within the team."
        confirmLabel="Share"
        onCancel={() => setPendingShare(null)}
        onConfirm={() => { markShareWarned(); const run = pendingShare; setPendingShare(null); run(); }}
      />
    )}
    </>
  );
}
