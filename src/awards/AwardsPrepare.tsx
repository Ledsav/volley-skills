import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImagePlus, Play, Share2, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Menu } from '../components/Menu';
import type { Person } from '../teams/stats/rosterIndex';
import { CUSTOM_NOTE_MAX, CUSTOM_TITLE_MAX, MAX_CUSTOM_AWARDS } from '../types/awards';
import type { CardArt, CardModel } from './card/drawAwardCard';
import { PRESET_PALETTES, selectedPalette, type Palette, type PalettePrefs, type SlideColors } from './palette';
import { PaletteEditor } from './PaletteEditor';
import { CardThumbnail } from './CardThumbnail';
import { NAME_STYLE_LABELS, type NameStyle } from './nameStyle';
import { PhotoCropDialog } from './PhotoCropDialog';
import { revealable, type ResolvedAward } from './resolveAwards';
import { LogoThumb } from './LogoThumb';
import { MAX_SPONSORS } from './card/branding';
import { HealthHint } from '../components/HealthHint';

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
  palettePrefs: PalettePrefs; onPalettePrefs: (p: PalettePrefs) => void;
  includeStory: boolean; onIncludeStory: (on: boolean) => void; storyLabel: string;
  colorsFor: (key: string) => SlideColors;
  photoAllowed: (key: string) => boolean;
  cutouts: Map<string, HTMLCanvasElement>;
  branding: { clubLogo: HTMLCanvasElement | null; sponsors: HTMLCanvasElement[]; mono: boolean };
  onClubLogo: (file: File | null) => void;
  onAddSponsors: (files: File[]) => void;
  onRemoveSponsor: (index: number) => void;
  onLogosMono: (mono: boolean) => void;
  onCutout: (key: string, on: boolean) => Promise<void>;
  notice?: string | null;
  artFor: (key: string) => CardArt;
  hasBackground: boolean; onBackground: (file: File | null) => void;
  photos: Map<string, HTMLCanvasElement>;
  onPhoto: (key: string, img: HTMLCanvasElement | null) => void;
  cardFor: (a: ResolvedAward) => CardModel | null;
  onAction: (a: PrepareAction) => void;
  onPresent: () => void; onExportAll: () => void; onExportSummary: () => void; onRecordVideo: () => void; videoAvailable: boolean; onExportOne: (key: string) => void; onClose: () => void;
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
  const [editing, setEditing] = useState<Palette | 'new' | null>(null);
  const [cutting, setCutting] = useState<string | null>(null);
  const [cutError, setCutError] = useState<string | null>(null);
  const palette = selectedPalette(props.palettePrefs);
  const isCustom = props.palettePrefs.custom.some((p) => p.id === palette.id);
  const { cardFor } = props;
  const cards = useMemo(() => new Map(awards.map((a) => [a.key, cardFor(a)])), [awards, cardFor]);
  const noWinners = revealable(awards).length === 0;

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-title font-semibold text-ink">Awards</h1>
          <p className="text-slate">{props.heading}</p>
        </div>
        <span role="status" className={`text-sm ${props.saveState === 'error' ? 'text-red' : 'text-slate'}`}>{SAVE_LABEL[props.saveState]}</span>
        {!noWinners && (
          <Menu
            label="Export"
            triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue bg-surface px-4 font-medium text-blue hover:bg-blue/10"
            trigger={<><Share2 size={16} aria-hidden="true" /> Export</>}
            items={[
              { kind: 'action', label: 'Winner cards (PNG)', onSelect: props.onExportAll },
              { kind: 'action', label: 'Summary card (PNG)', onSelect: props.onExportSummary },
              props.videoAvailable
                ? { kind: 'action', label: 'Record video', onSelect: props.onRecordVideo }
                : { kind: 'action', label: 'Record video', hint: "Video export isn't supported in this browser", onSelect: () => {} },
            ]}
          />
        )}
        <Button variant="primary" disabled={noWinners} onClick={props.onPresent}><Play size={16} aria-hidden="true" /> Present</Button>
        <Button variant="ghost" onClick={props.onClose} aria-label="Close awards"><X size={16} aria-hidden="true" /></Button>
      </header>

      {noWinners && <p className="mb-3 text-sm text-slate">Pick at least one winner to present or export cards.</p>}
      {props.notice && <p role="alert" className="mb-3 text-sm text-red">{props.notice}</p>}

      <section aria-label="Card settings" className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="text-sm text-slate">Palette
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.palettePrefs.selectedId}
            onChange={(e) => props.onPalettePrefs({ ...props.palettePrefs, selectedId: e.target.value })}>
            <optgroup label="Presets">
              {PRESET_PALETTES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
            {props.palettePrefs.custom.length > 0 && (
              <optgroup label="Yours">
                {props.palettePrefs.custom.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <span className="flex gap-1" aria-hidden="true">
          {palette.colors.map((c, i) => <span key={i} className="h-6 w-6 rounded-sm border border-border" style={{ background: c }} />)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>New palette</Button>
        {isCustom && <Button variant="ghost" size="sm" onClick={() => setEditing(palette)}>Edit palette</Button>}
        <label className="inline-flex items-center gap-2 text-sm text-slate">
          <input type="checkbox" checked={props.includeStory} onChange={(e) => props.onIncludeStory(e.target.checked)} />
          {props.storyLabel}
        </label>
        <label className="text-sm text-slate">Background image
          <input type="file" accept="image/*" className="ml-2 text-sm" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; props.onBackground(f); }} />
        </label>
        {props.hasBackground && <Button variant="ghost" size="sm" onClick={() => props.onBackground(null)}>Remove background</Button>}
        <label className="text-sm text-slate">Names on cards
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.nameStyle} onChange={(e) => props.onNameStyle(e.target.value as NameStyle)}>
            {(Object.keys(NAME_STYLE_LABELS) as NameStyle[]).map((s) => <option key={s} value={s}>{NAME_STYLE_LABELS[s]}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Branding" className="flex w-full flex-wrap items-center gap-3 border-t border-border pt-3">
          <span className="text-sm font-medium text-ink">Branding</span>
          {props.branding.clubLogo ? (
            <span className="inline-flex items-center gap-1">
              <LogoThumb img={props.branding.clubLogo} />
              <Button variant="ghost" size="icon" aria-label="Remove club logo" onClick={() => props.onClubLogo(null)}><X size={14} aria-hidden="true" /></Button>
            </span>
          ) : (
            <label className="text-sm text-slate">Club logo
              <input type="file" accept="image/*" className="ml-2 text-sm" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) props.onClubLogo(f); }} />
            </label>
          )}
          {props.branding.sponsors.map((img, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <LogoThumb img={img} />
              <Button variant="ghost" size="icon" aria-label={`Remove sponsor ${i + 1}`} onClick={() => props.onRemoveSponsor(i)}><X size={14} aria-hidden="true" /></Button>
            </span>
          ))}
          <label className="text-sm text-slate">Add sponsor logos
            <input type="file" accept="image/*" multiple disabled={props.branding.sponsors.length >= MAX_SPONSORS} className="ml-2 text-sm"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) props.onAddSponsors(fs); }} />
          </label>
          {props.branding.sponsors.length >= MAX_SPONSORS && <span className="text-xs text-slate">Up to {MAX_SPONSORS} sponsors</span>}
          <label className="inline-flex items-center gap-2 text-sm text-slate">
            <input type="checkbox" checked={!props.branding.mono} onChange={(e) => props.onLogosMono(!e.target.checked)} />
            Logos in original colours
          </label>
        </div>
        <p className="w-full text-xs text-slate">Photos and logos stay on this device and are forgotten when you leave.</p>
      </section>

      <ol className="space-y-3">
        {awards.map((a, i) => {
          const titleId = `award-${a.key}`;
          const card = cards.get(a.key) ?? null;
          const photo = props.photos.get(a.key) ?? null;
          return (
            <li key={a.key}>
              <section aria-labelledby={titleId} className={`flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4 shadow-card ${a.hidden ? 'opacity-60' : ''}`}>
                {card && <CardThumbnail card={card} colors={props.colorsFor(a.key)} art={props.artFor(a.key)} />}
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
                    {props.photoAllowed(a.key) ? (
                      <>
                        <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-blue">
                          <ImagePlus size={16} aria-hidden="true" /> {photo ? 'Change photo' : 'Add photo'}
                          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFor({ key: a.key, file: f }); e.target.value = ''; }} />
                        </label>
                        {photo && <Button variant="ghost" size="sm" onClick={() => props.onPhoto(a.key, null)}>Remove photo</Button>}
                        {photo && (props.cutouts.has(a.key) ? (
                          <Button variant="ghost" size="sm" onClick={() => void props.onCutout(a.key, false)}>Use original</Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled={cutting !== null} onClick={() => {
                            setCutting(a.key);
                            setCutError(null);
                            props.onCutout(a.key, true)
                              .catch(() => setCutError(a.key))
                              .finally(() => setCutting(null));
                          }}>Remove background</Button>
                        ))}
                        {cutting === a.key && <span role="status" className="text-sm text-slate">Preparing on this device…</span>}
                        {cutError === a.key && <p role="alert" className="w-full text-sm text-red-strong">Could not remove the background. The original photo is kept.</p>}
                      </>
                    ) : (
                      a.winner && <p className="text-xs text-slate">No photo consent on file — the card shows the jersey number.</p>
                    )}
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
              <input aria-describedby="award-note-hint" className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_NOTE_MAX} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <HealthHint id="award-note-hint" />
            <Button type="submit" variant="primary">Add award</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </form>
        )}
      </div>

      {editing && (
        <PaletteEditor
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => {
            const custom = props.palettePrefs.custom.some((x) => x.id === p.id)
              ? props.palettePrefs.custom.map((x) => (x.id === p.id ? p : x))
              : [...props.palettePrefs.custom, p];
            props.onPalettePrefs({ selectedId: p.id, custom });
            setEditing(null);
          }}
          onDelete={editing === 'new' ? undefined : () => {
            props.onPalettePrefs({ selectedId: PRESET_PALETTES[0].id, custom: props.palettePrefs.custom.filter((x) => x.id !== editing.id) });
            setEditing(null);
          }}
        />
      )}

      <PhotoCropDialog open={!!cropFor} file={cropFor?.file ?? null} onCancel={() => setCropFor(null)}
        onDone={(img) => { if (cropFor) props.onPhoto(cropFor.key, img); setCropFor(null); }} />
    </div>
  );
}
