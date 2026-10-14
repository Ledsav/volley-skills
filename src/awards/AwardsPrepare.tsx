import { useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImagePlus, Play, Share2, X } from 'lucide-react';
import { Button } from '../components/Button';
import type { Person } from '../teams/stats/rosterIndex';
import { CUSTOM_NOTE_MAX, CUSTOM_TITLE_MAX, MAX_CUSTOM_AWARDS } from '../types/awards';
import { PRESETS, themeFromPrefs, type ThemePrefs } from './card/cardTheme';
import type { CardModel } from './card/drawAwardCard';
import { CardThumbnail } from './CardThumbnail';
import { NAME_STYLE_LABELS, type NameStyle } from './nameStyle';
import { PhotoCropDialog } from './PhotoCropDialog';
import type { ResolvedAward } from './resolveAwards';

export type PrepareAction =
  | { type: 'pick'; key: string; playerId: string | null }
  | { type: 'hide'; key: string; hidden: boolean }
  | { type: 'move'; key: string; dir: -1 | 1 }
  | { type: 'addCustom'; title: string; playerId: string; note: string }
  | { type: 'removeCustom'; key: string };

export interface AwardsPrepareProps {
  heading: string;
  awards: ResolvedAward[];
  people: Person[];
  saveState: 'saved' | 'saving' | 'offline' | 'error';
  nameStyle: NameStyle; onNameStyle: (s: NameStyle) => void;
  themePrefs: ThemePrefs; onThemePrefs: (p: ThemePrefs) => void;
  hasBackground: boolean; onBackground: (file: File | null) => void;
  photos: Map<string, HTMLCanvasElement>;
  onPhoto: (key: string, img: HTMLCanvasElement | null) => void;
  cardFor: (a: ResolvedAward) => CardModel | null;
  onAction: (a: PrepareAction) => void;
  onPresent: () => void; onExportAll: () => void; onExportOne: (key: string) => void; onClose: () => void;
}

const SAVE_LABEL = { saved: 'Saved', saving: 'Saving…', offline: 'Offline — will sync', error: 'Could not save' } as const;
const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;
const unknown = (playerId: string): Person => ({ playerId, name: 'Unknown player', number: null, current: false });

export function AwardsPrepare(props: AwardsPrepareProps) {
  const { awards, people, onAction } = props;
  const [cropFor, setCropFor] = useState<{ key: string; file: File } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', playerId: '', note: '' });
  const customCount = awards.filter((a) => a.kind === 'custom').length;
  const byId = new Map(people.map((p) => [p.playerId, p]));
  const who = (id: string) => byId.get(id) ?? unknown(id);
  const theme = themeFromPrefs(props.themePrefs);
  const custom = props.themePrefs.custom;

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-ink">Awards</h1>
          <p className="text-slate">{props.heading}</p>
        </div>
        <span role="status" className={`text-sm ${props.saveState === 'error' ? 'text-red' : 'text-slate'}`}>{SAVE_LABEL[props.saveState]}</span>
        <Button variant="secondary" onClick={props.onExportAll}><Share2 size={16} aria-hidden="true" /> Export cards</Button>
        <Button variant="primary" onClick={props.onPresent}><Play size={16} aria-hidden="true" /> Present</Button>
        <Button variant="ghost" onClick={props.onClose} aria-label="Close awards"><X size={16} aria-hidden="true" /></Button>
      </header>

      <section aria-label="Card settings" className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="text-sm text-slate">Theme
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.themePrefs.presetId}
            onChange={(e) => props.onThemePrefs({ ...props.themePrefs, presetId: e.target.value })}>
            {PRESETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate">Custom colours
          <input type="checkbox" className="ml-2" checked={!!custom}
            onChange={(e) => props.onThemePrefs({ ...props.themePrefs, custom: e.target.checked ? { from: theme.bgFrom, to: theme.bgTo } : null })} />
        </label>
        {custom && (
          <>
            <label className="text-sm text-slate">Top <input type="color" value={custom.from}
              onChange={(e) => props.onThemePrefs({ ...props.themePrefs, custom: { ...custom, from: e.target.value } })} /></label>
            <label className="text-sm text-slate">Bottom <input type="color" value={custom.to}
              onChange={(e) => props.onThemePrefs({ ...props.themePrefs, custom: { ...custom, to: e.target.value } })} /></label>
          </>
        )}
        <label className="text-sm text-slate">Background image
          <input type="file" accept="image/*" className="ml-2 text-sm" onChange={(e) => props.onBackground(e.target.files?.[0] ?? null)} />
        </label>
        {props.hasBackground && <Button variant="ghost" size="sm" onClick={() => props.onBackground(null)}>Remove background</Button>}
        <label className="text-sm text-slate">Names on cards
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.nameStyle} onChange={(e) => props.onNameStyle(e.target.value as NameStyle)}>
            {(Object.keys(NAME_STYLE_LABELS) as NameStyle[]).map((s) => <option key={s} value={s}>{NAME_STYLE_LABELS[s]}</option>)}
          </select>
        </label>
        <p className="w-full text-xs text-slate">Photos stay on this device and are forgotten when you leave.</p>
      </section>

      <ol className="space-y-3">
        {awards.map((a, i) => {
          const titleId = `award-${a.key}`;
          const card = props.cardFor(a);
          const photo = props.photos.get(a.key) ?? null;
          return (
            <li key={a.key}>
              <section aria-labelledby={titleId} className={`flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4 shadow-card ${a.hidden ? 'opacity-60' : ''}`}>
                {card && <CardThumbnail card={card} theme={theme} art={{ photo, background: null }} />}
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 id={titleId} className="font-semibold text-ink">{a.title}</h2>
                  {a.kind === 'stats' ? (
                    <label className="block text-sm text-slate">Winner
                      <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={a.overridden ? a.winner?.playerId ?? '' : ''}
                        onChange={(e) => onAction({ type: 'pick', key: a.key, playerId: e.target.value || null })}>
                        <option value="">{a.suggested ? `Stats' choice (${label(who(a.suggested.playerId))})` : "Stats' choice (none)"}</option>
                        {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-ink">{a.winner ? label(a.winner) : '—'}{a.note && <span className="text-slate"> · {a.note}</span>}</p>
                  )}
                  {a.winner === null && <p className="text-sm text-orange-strong">No winner — pick one or hide</p>}
                  {a.statLine && <p className="text-sm tabular-nums text-slate">{a.statLine}</p>}
                  {a.overridden && a.suggested && <p className="text-sm text-slate">Stats suggest: {label(who(a.suggested.playerId))}</p>}
                  {a.runnersUp.length > 0 && (
                    <p className="text-xs text-slate">Runners-up: {a.runnersUp.map((r) => label(who(r.playerId))).join(', ')}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {a.kind === 'stats' && (
                      <label className="inline-flex items-center gap-1 text-sm text-slate">
                        <input type="checkbox" checked={a.hidden} onChange={(e) => onAction({ type: 'hide', key: a.key, hidden: e.target.checked })} /> Hide
                      </label>
                    )}
                    <Button variant="ghost" size="sm" aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => onAction({ type: 'move', key: a.key, dir: -1 })}><ArrowUp size={16} aria-hidden="true" /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Move ${a.title} down`} disabled={i === awards.length - 1} onClick={() => onAction({ type: 'move', key: a.key, dir: 1 })}><ArrowDown size={16} aria-hidden="true" /></Button>
                    <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-blue">
                      <ImagePlus size={16} aria-hidden="true" /> {photo ? 'Change photo' : 'Add photo'}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFor({ key: a.key, file: f }); e.target.value = ''; }} />
                    </label>
                    {photo && <Button variant="ghost" size="sm" onClick={() => props.onPhoto(a.key, null)}>Remove photo</Button>}
                    {card && <Button variant="ghost" size="sm" onClick={() => props.onExportOne(a.key)}><Download size={16} aria-hidden="true" /> PNG</Button>}
                    {a.kind === 'custom' && <Button variant="dangerGhost" size="sm" onClick={() => onAction({ type: 'removeCustom', key: a.key })}>Remove</Button>}
                  </div>
                </div>
              </section>
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        {!adding ? (
          <Button variant="secondary" disabled={customCount >= MAX_CUSTOM_AWARDS} onClick={() => setAdding(true)}>+ Custom award</Button>
        ) : (
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.title.trim() || !draft.playerId) return;
              onAction({ type: 'addCustom', title: draft.title.trim(), playerId: draft.playerId, note: draft.note.trim() });
              setDraft({ title: '', playerId: '', note: '' });
              setAdding(false);
            }}>
            <label className="text-sm text-slate">Award title
              <input className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_TITLE_MAX} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="text-sm text-slate">Player
              <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={draft.playerId} onChange={(e) => setDraft({ ...draft, playerId: e.target.value })}>
                <option value="">Choose…</option>
                {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate">Note
              <input className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_NOTE_MAX} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <Button type="submit" variant="primary">Add award</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </form>
        )}
      </div>

      <PhotoCropDialog open={!!cropFor} file={cropFor?.file ?? null} onCancel={() => setCropFor(null)}
        onDone={(img) => { if (cropFor) props.onPhoto(cropFor.key, img); setCropFor(null); }} />
    </div>
  );
}
