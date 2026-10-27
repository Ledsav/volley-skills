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
import { Dialog } from '../components/Dialog';
import { recordStory, videoExtension, videoSupported } from './exportVideo';
import { markShareWarned, needsShareWarning } from './shareWarning';
import { AwardsPresent } from './AwardsPresent';
import { getSeasonAwards, saveMatchAwards, saveSeasonAwards } from './awardsApi';
import { applyPrepareAction } from './awardsReducer';
import { drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';
import { readPalettePrefs, selectedPalette, slideColors, writePalettePrefs, type PalettePrefs } from './palette';
import { renderStoryFrame, type StoryDeps } from './card/drawSlide';
import { buildStory, colorIndexForAward } from './story/buildStory';
import { readStoryPref, writeStoryPref } from './story/storyPref';
import { storyStats } from './story/storyStats';
import { cardFileName, ensureCardFonts, renderPng, shareOrDownload } from './exportCards';
import { readNameStyle, styleName, writeNameStyle, type NameStyle } from './nameStyle';
import { fitSize, loadImageFile, loadLogoFile } from './photo';
import { knockOutBackground, MAX_SPONSORS } from './card/branding';
import { resolveAwards, revealable, type ResolvedAward } from './resolveAwards';
import { ageFromDob } from '../players/age';
import { photoAllowed } from './photoGate';
import { formatDate } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import { teamGender } from '../teams/teamGender';

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'notFinished' }
  | { state: 'error' }
  | { state: 'ready'; team: Team; matches: Match[]; match: Match | null; people: Map<string, Person>; consented: Set<string>; adults: Set<string> };

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

/**
 * Photos are added per award but belong to the player who won it at that moment: if the coach
 * later picks someone else, the old face must not appear under the new name.
 */
export function photosForWinners<T>(awards: ResolvedAward[], images: Map<string, T>, owners: Map<string, string>): Map<string, T> {
  const out = new Map<string, T>();
  for (const a of awards) {
    const img = images.get(a.key);
    if (img && a.winner && owners.get(a.key) === a.winner.playerId) out.set(a.key, img);
  }
  return out;
}

/**
 * Whether an export of these awards shows a minor: any winner who is not a known adult.
 * A missing date of birth or a former player counts as a possible minor (warn rather than not).
 */
export function exportIncludesMinors(keys: string[], awards: ResolvedAward[], adults: Set<string>): boolean {
  return awards.some((a) => keys.includes(a.key) && a.winner !== null && !adults.has(a.winner.playerId));
}

const fmtDate = (iso: string) => formatDate(iso, 'short');

export default function AwardsPage({ scope }: { scope: AwardScope }) {
  const { teamId = '', matchId = '' } = useParams();
  const { firebaseUser, appUser, access, club } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const ta = t.awards.page;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [config, setConfig] = useState<AwardsInput>(EMPTY_AWARDS);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const [mode, setMode] = useState<'prepare' | 'present'>('prepare');
  const [nameStyle, setNameStyle] = useState<NameStyle>(readNameStyle);
  const [palettePrefs, setPalettePrefs] = useState<PalettePrefs>(readPalettePrefs);
  const [photos, setPhotos] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [cutouts, setCutouts] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [background, setBackground] = useState<HTMLCanvasElement | null>(null);
  // Club and sponsor logos: session-only, like photos (never stored).
  const [clubLogo, setClubLogo] = useState<HTMLCanvasElement | null>(null);
  const [sponsors, setSponsors] = useState<HTMLCanvasElement[]>([]);
  const [logosMono, setLogosMono] = useState(true);
  const logosRef = useRef<HTMLCanvasElement[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dirty = useRef(false);
  const configRef = useRef<AwardsInput>(EMPTY_AWARDS);
  const photosRef = useRef(photos);
  const photoOwners = useRef(new Map<string, string>()); // award key → player the photo was added for
  const cutoutsRef = useRef(cutouts);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const saveSeq = useRef(0);
  const target = useRef({ scope, teamId, matchId, uid: firebaseUser?.uid ?? '' });
  useEffect(() => {
    target.current = { scope, teamId, matchId, uid: firebaseUser?.uid ?? '' };
  });
  usePageMeta({ title: scope === 'season' ? ta.titleSeason : ta.titleMatch });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const team = await getTeam(teamId);
        if (!team || !isTeamAdmin(team, appUser?.email, access)) {
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
        setLoad({ state: 'ready', team, matches: all, match, people: withCurrentRoster(latestRosterIndex(all), roster), consented: new Set(roster.filter((p) => photoAllowed(p, new Date())).map((p) => p.id)),
          adults: new Set(roster.filter((p) => (ageFromDob(p.dob ?? '') ?? 0) >= 18).map((p) => p.id)) });
      } catch (e) {
        if (!cancelled) setLoad({ state: isNotFoundError(e) ? 'notFound' : 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, matchId, scope, appUser?.email, access, attempt]);

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
    logosRef.current.forEach((c) => { c.width = 0; });
  }, []);

  const ready = load.state === 'ready' ? load : null;
  const awards: ResolvedAward[] = useMemo(
    () => (ready ? resolveAwards(scope, ready.matches, config, ready.people, teamGender(ready.team)) : []),
    [ready, scope, config],
  );
  const heading = ready ? (scope === 'season' ? ta.seasonHeading(ready.team.season) : ta.matchHeading(ready.match!.opponent, fmtDate(ready.match!.date))) : '';

  const cardFor = useCallback((a: ResolvedAward): CardModel | null => {
    if (!ready || !a.winner) return null;
    return {
      key: a.key, awardTitle: a.title, name: styleName(a.winner, nameStyle), number: a.winner.number,
      statLine: a.statLine, footer: heading, teamName: ready.team.name, clubName: club?.name ?? '', note: a.note,
    };
  }, [ready, nameStyle, heading, club]);

  const allowed = useMemo(() => photoAllowedKeys(awards, ready?.consented ?? NO_CONSENT), [awards, ready]);
  const livePhotos = useMemo(() => photosForWinners(awards, photos, photoOwners.current), [awards, photos]);
  const liveCutouts = useMemo(() => photosForWinners(awards, cutouts, photoOwners.current), [awards, cutouts]);
  const branding = useMemo(() => ({ clubLogo, sponsors, mono: logosMono }), [clubLogo, sponsors, logosMono]);
  const artFor = useCallback(
    (key: string): CardArt => ({ ...gatedArt(key, allowed, livePhotos, liveCutouts, background), branding }),
    [allowed, livePhotos, liveCutouts, background, branding],
  );
  const loadLogos = (files: File[]) => Promise.all(files.map((f) => loadLogoFile(f, knockOutBackground))).then((cs) => {
    logosRef.current = [...logosRef.current, ...cs];
    return cs;
  });

  const cards = useMemo(
    () => revealable(awards).map((a) => ({ key: a.key, title: a.title, model: cardFor(a)! })),
    [awards, cardFor],
  );
  const [includeStory, setIncludeStory] = useState(readStoryPref);
  const palette = useMemo(() => selectedPalette(palettePrefs), [palettePrefs]);
  const stats = useMemo(() => (ready ? storyStats(scope, ready.matches, ready.people) : []), [ready, scope]);
  const slides = useMemo(() => buildStory({
    introTitle: ready ? (scope === 'season' ? ta.seasonHeading(ready.team.season) : ta.matchIntro(ready.match!.opponent)) : '',
    teamName: ready?.team.name ?? '', stats, awardCount: cards.length, includeStory,
  }), [ready, scope, stats, cards.length, includeStory, ta]);
  const colorsFor = useCallback((key: string) => {
    const i = cards.findIndex((c) => c.key === key);
    return slideColors(palette, colorIndexForAward(slides, Math.max(0, i)));
  }, [cards, palette, slides]);
  const deps: StoryDeps = useMemo(() => ({ palette, cards, artFor, clubName: club?.name ?? '', winnersTitle: t.awards.present.summaryTitle }), [palette, cards, artFor, club, t]);

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

  // The first share of minors' images in a browser session asks the coach to confirm.
  // Exports that only show adults go straight through.
  const [pendingShare, setPendingShare] = useState<(() => void) | null>(null);
  const guardShare = (keys: string[], run: () => Promise<void>) => {
    const go = () => void run();
    if (ready && exportIncludesMinors(keys, awards, ready.adults) && needsShareWarning()) setPendingShare(() => go);
    else go();
  };
  const allKeys = () => revealable(awards).map((a) => a.key);

  const fileCtx = (r: Extract<Load, { state: 'ready' }>) =>
    scope === 'match' ? { kind: 'match' as const, date: r.match!.date, opponent: r.match!.opponent } : { kind: 'season' as const, season: r.team.season };

  async function exportSummary() {
    if (!ready) return;
    setNotice(null);
    try {
      const blob = await renderPng((ctx) => { renderStoryFrame(ctx, slides, slides.length - 1, 1e9, deps, true, null); });
      await shareOrDownload([new File([blob], cardFileName('summary', fileCtx(ready)), { type: 'image/png' })], heading);
    } catch {
      setNotice(ta.exportSummaryError);
    }
  }

  // `video` is set once recording finishes: sharing then needs a fresh tap, because the browser's
  // share sheet only opens right after a user gesture (a 30–90 s recording outlives the original one).
  const [recording, setRecording] = useState<{ progress: number; ctrl: AbortController; video: File | null } | null>(null);
  const recordingCtrl = useRef<AbortController | null>(null);
  useEffect(() => () => recordingCtrl.current?.abort(), []); // leaving the page stops the recorder

  async function recordVideo() {
    if (!ready) return;
    setNotice(null);
    const ctrl = new AbortController();
    recordingCtrl.current = ctrl;
    setRecording({ progress: 0, ctrl, video: null });
    try {
      const blob = await recordStory(slides, deps, { signal: ctrl.signal, onProgress: (p) => setRecording((r) => (r ? { ...r, progress: p } : r)) });
      const name = cardFileName('story', fileCtx(ready)).replace(/\.png$/, `.${videoExtension(blob.type)}`);
      setRecording((r) => (r ? { ...r, progress: 1, video: new File([blob], name, { type: blob.type }) } : r));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNotice(ta.recordError);
      setRecording(null);
    } finally {
      recordingCtrl.current = null;
    }
  }

  async function exportKeys(keys: string[]) {
    if (!ready) return;
    setNotice(null);
    try {
      await doExport(ready, keys);
    } catch {
      setNotice(ta.exportError);
    }
  }

  async function doExport(ready: Extract<Load, { state: 'ready' }>, keys: string[]) {
    const files: File[] = [];
    for (const a of awards.filter((x) => keys.includes(x.key))) {
      const card = cardFor(a);
      if (!card) continue;
      const blob = await renderPng((ctx) => drawAwardCard(ctx, card, colorsFor(a.key), artFor(a.key), 1));
      const name = cardFileName(a.key, fileCtx(ready));
      files.push(new File([blob], name, { type: 'image/png' }));
    }
    if (files.length) await shareOrDownload(files, heading);
  }

  if (load.state === 'loading') return <p className="p-6 text-slate">{ta.loading}</p>;
  if (load.state === 'notFound') return <NotFoundState title={ta.notFoundTitle} message={ta.notFoundMessage} backTo={`/teams/${teamId}`} backLabel={ta.backToTeam} />;
  if (load.state === 'notFinished') return <NotFoundState title={ta.titleMatch} message={ta.notFinishedMessage} backTo={`/teams/${teamId}/matches/${matchId}`} backLabel={ta.backToMatch} />;
  if (load.state === 'error') {
    return (
      <div className="p-6">
        <p role="alert" className="text-red">{ta.loadError}</p>
        <Button variant="secondary" className="mt-3" onClick={() => { setLoad({ state: 'loading' }); setAttempt((n) => n + 1); }}>{ta.tryAgain}</Button>
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
      cutouts={liveCutouts}
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
      storyLabel={scope === 'season' ? ta.includeSeasonStory : ta.includeMatchStory}
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
        }).catch(() => setNotice(ta.backgroundError));
      }}
      photos={livePhotos}
      branding={branding}
      onClubLogo={(file) => {
        setNotice(null);
        if (!file) { if (clubLogo) clubLogo.width = 0; setClubLogo(null); return; }
        void loadLogos([file]).then(([c]) => setClubLogo(c)).catch(() => setNotice(ta.logoError));
      }}
      onAddSponsors={(files) => {
        setNotice(null);
        void loadLogos(files.slice(0, MAX_SPONSORS)).then((cs) => setSponsors((cur) => [...cur, ...cs].slice(0, MAX_SPONSORS)))
          .catch(() => setNotice(ta.logoError));
      }}
      onRemoveSponsor={(i) => setSponsors((cur) => { cur[i].width = 0; return cur.filter((_, j) => j !== i); })}
      onLogosMono={setLogosMono}
      onPhoto={(key, img) => {
        const winner = awards.find((a) => a.key === key)?.winner;
        if (img && winner) photoOwners.current.set(key, winner.playerId); else photoOwners.current.delete(key);
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
      onExportAll={() => guardShare(allKeys(), () => exportKeys(allKeys()))}
      onExportOne={(key) => guardShare([key], () => exportKeys([key]))}
      onExportSummary={() => guardShare(allKeys(), exportSummary)}
      onRecordVideo={() => guardShare(allKeys(), recordVideo)}
      videoAvailable={videoSupported()}
      onClose={() => navigate(scope === 'season' ? `/teams/${teamId}?tab=stats` : `/teams/${teamId}/matches/${matchId}`)}
    />
    {recording && !recording.video && (
      <Dialog title={ta.recordingTitle} onClose={() => recording.ctrl.abort()}
        footer={<Button variant="secondary" onClick={() => recording.ctrl.abort()}>{t.common.cancel}</Button>}>
        <p className="text-sm text-slate">{ta.recordingBody}</p>
        <progress className="mt-3 w-full" max={1} value={recording.progress} aria-label={ta.recordingProgress} />
      </Dialog>
    )}
    {recording?.video && (
      <Dialog title={ta.videoReadyTitle} onClose={() => setRecording(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRecording(null)}>{t.common.close}</Button>
            <Button variant="primary" onClick={() => {
              const file = recording.video!;
              setRecording(null);
              void shareOrDownload([file], heading).catch(() => setNotice(ta.shareVideoError));
            }}>{ta.shareVideo}</Button>
          </div>
        }>
        <p className="text-sm text-slate">{ta.videoReadyBody}</p>
      </Dialog>
    )}
    {pendingShare && (
      <ConfirmDialog
        title={ta.shareTitle}
        message={ta.shareMessage}
        confirmLabel={ta.share}
        onCancel={() => setPendingShare(null)}
        onConfirm={() => { markShareWarned(); const run = pendingShare; setPendingShare(null); run(); }}
      />
    )}
    </>
  );
}
