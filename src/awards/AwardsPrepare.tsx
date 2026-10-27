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
import { NAME_STYLES, type NameStyle } from './nameStyle';
import { useT } from '../i18n/I18nProvider';
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

const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;

export function AwardsPrepare(props: AwardsPrepareProps) {
  const t = useT();
  const ta = t.awards.prepare;
  const unknown = (playerId: string): Person => ({ playerId, name: t.teams.stats.unknownPlayer, number: null, current: false });
  const paletteName = (p: Palette) => t.awards.paletteNames[p.id] ?? p.name;
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
          <h1 className="text-title font-semibold text-ink">{ta.title}</h1>
          <p className="text-slate">{props.heading}</p>
        </div>
        <span role="status" className={`text-sm ${props.saveState === 'error' ? 'text-red' : 'text-slate'}`}>{ta.saveState[props.saveState]}</span>
        {!noWinners && (
          <Menu
            label={ta.export}
            triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue bg-surface px-4 font-medium text-blue hover:bg-blue/10"
            trigger={<><Share2 size={16} aria-hidden="true" /> {ta.export}</>}
            items={[
              { kind: 'action', label: ta.winnerCards, onSelect: props.onExportAll },
              { kind: 'action', label: ta.summaryCard, onSelect: props.onExportSummary },
              props.videoAvailable
                ? { kind: 'action', label: ta.recordVideo, onSelect: props.onRecordVideo }
                : { kind: 'action', label: ta.recordVideo, hint: ta.videoUnsupported, onSelect: () => {} },
            ]}
          />
        )}
        <Button variant="primary" disabled={noWinners} onClick={props.onPresent}><Play size={16} aria-hidden="true" /> {ta.present}</Button>
        <Button variant="ghost" onClick={props.onClose} aria-label={ta.closeAria}><X size={16} aria-hidden="true" /></Button>
      </header>

      {noWinners && <p className="mb-3 text-sm text-slate">{ta.noWinners}</p>}
      {props.notice && <p role="alert" className="mb-3 text-sm text-red">{props.notice}</p>}

      <section aria-label={ta.cardSettings} className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="text-sm text-slate">{ta.palette}
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.palettePrefs.selectedId}
            onChange={(e) => props.onPalettePrefs({ ...props.palettePrefs, selectedId: e.target.value })}>
            <optgroup label={ta.presets}>
              {PRESET_PALETTES.map((p) => <option key={p.id} value={p.id}>{paletteName(p)}</option>)}
            </optgroup>
            {props.palettePrefs.custom.length > 0 && (
              <optgroup label={ta.yours}>
                {props.palettePrefs.custom.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <span className="flex gap-1" aria-hidden="true">
          {palette.colors.map((c, i) => <span key={i} className="h-6 w-6 rounded-sm border border-border" style={{ background: c }} />)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>{ta.newPalette}</Button>
        {isCustom && <Button variant="ghost" size="sm" onClick={() => setEditing(palette)}>{ta.editPalette}</Button>}
        <label className="inline-flex items-center gap-2 text-sm text-slate">
          <input type="checkbox" checked={props.includeStory} onChange={(e) => props.onIncludeStory(e.target.checked)} />
          {props.storyLabel}
        </label>
        <label className="text-sm text-slate">{ta.backgroundImage}
          <input type="file" accept="image/*" aria-describedby="awards-background-hint" className="ml-2 text-sm" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; props.onBackground(f); }} />
          {/* Photos of minors are used only with recorded consent (Terms T7); a background has none. */}
          <span id="awards-background-hint" className="block text-xs">{ta.backgroundHint}</span>
        </label>
        {props.hasBackground && <Button variant="ghost" size="sm" onClick={() => props.onBackground(null)}>{ta.removeBackground}</Button>}
        <label className="text-sm text-slate">{ta.namesOnCards}
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.nameStyle} onChange={(e) => props.onNameStyle(e.target.value as NameStyle)}>
            {NAME_STYLES.map((s) => <option key={s} value={s}>{t.awards.nameStyle[s]}</option>)}
          </select>
        </label>
        <div role="group" aria-label={ta.branding} className="flex w-full flex-wrap items-center gap-3 border-t border-border pt-3">
          <span className="text-sm font-medium text-ink">{ta.branding}</span>
          {props.branding.clubLogo ? (
            <span className="inline-flex items-center gap-1">
              <LogoThumb img={props.branding.clubLogo} />
              <Button variant="ghost" size="icon" aria-label={ta.removeClubLogo} onClick={() => props.onClubLogo(null)}><X size={14} aria-hidden="true" /></Button>
            </span>
          ) : (
            <label className="text-sm text-slate">{ta.clubLogo}
              <input type="file" accept="image/*" className="ml-2 text-sm" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) props.onClubLogo(f); }} />
            </label>
          )}
          {props.branding.sponsors.map((img, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <LogoThumb img={img} />
              <Button variant="ghost" size="icon" aria-label={ta.removeSponsor(i + 1)} onClick={() => props.onRemoveSponsor(i)}><X size={14} aria-hidden="true" /></Button>
            </span>
          ))}
          <label className="text-sm text-slate">{ta.addSponsorLogos}
            <input type="file" accept="image/*" multiple disabled={props.branding.sponsors.length >= MAX_SPONSORS} className="ml-2 text-sm"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) props.onAddSponsors(fs); }} />
          </label>
          {props.branding.sponsors.length >= MAX_SPONSORS && <span className="text-xs text-slate">{ta.maxSponsors(MAX_SPONSORS)}</span>}
          <label className="inline-flex items-center gap-2 text-sm text-slate">
            <input type="checkbox" checked={!props.branding.mono} onChange={(e) => props.onLogosMono(!e.target.checked)} />
            {ta.originalColours}
          </label>
        </div>
        <p className="w-full text-xs text-slate">{ta.privacyNote}</p>
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
                    <label className="block text-sm text-slate">{ta.winner}
                      <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={a.overridden ? a.winner?.playerId ?? '' : ''}
                        onChange={(e) => onAction({ type: 'pick', key: a.key, playerId: e.target.value || null })}>
                        <option value="">{a.suggested ? ta.statsChoice(label(who(a.suggested.playerId))) : ta.statsChoiceNone}</option>
                        {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-ink">{a.winner ? label(a.winner) : '—'}{a.note && <span className="text-slate"> · {a.note}</span>}</p>
                  )}
                  {a.winner === null && <p className="text-sm text-orange-strong">{ta.noWinner}</p>}
                  {a.statLine && <p className="text-sm tabular-nums text-slate">{a.statLine}</p>}
                  {a.overridden && a.suggested && <p className="text-sm text-slate">{ta.statsSuggest(label(who(a.suggested.playerId)))}</p>}
                  {a.runnersUp.length > 0 && (
                    <p className="text-xs text-slate">{ta.runnersUp(a.runnersUp.map((r) => label(who(r.playerId))).join(', '))}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {a.kind === 'stats' && (
                      <label className="inline-flex items-center gap-1 text-sm text-slate">
                        <input type="checkbox" checked={a.hidden} onChange={(e) => onAction({ type: 'hide', key: a.key, hidden: e.target.checked })} /> {ta.hide}
                      </label>
                    )}
                    <Button variant="ghost" size="sm" aria-label={ta.moveUp(a.title)} disabled={i === 0} onClick={() => onAction({ type: 'move', key: a.key, dir: -1 })}><ArrowUp size={16} aria-hidden="true" /></Button>
                    <Button variant="ghost" size="sm" aria-label={ta.moveDown(a.title)} disabled={i === awards.length - 1} onClick={() => onAction({ type: 'move', key: a.key, dir: 1 })}><ArrowDown size={16} aria-hidden="true" /></Button>
                    {props.photoAllowed(a.key) ? (
                      <>
                        <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-blue">
                          <ImagePlus size={16} aria-hidden="true" /> {photo ? ta.changePhoto : ta.addPhoto}
                          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFor({ key: a.key, file: f }); e.target.value = ''; }} />
                        </label>
                        {photo && <Button variant="ghost" size="sm" onClick={() => props.onPhoto(a.key, null)}>{ta.removePhoto}</Button>}
                        {photo && (props.cutouts.has(a.key) ? (
                          <Button variant="ghost" size="sm" onClick={() => void props.onCutout(a.key, false)}>{ta.useOriginal}</Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled={cutting !== null} onClick={() => {
                            setCutting(a.key);
                            setCutError(null);
                            props.onCutout(a.key, true)
                              .catch(() => setCutError(a.key))
                              .finally(() => setCutting(null));
                          }}>{ta.removeBackground}</Button>
                        ))}
                        {cutting === a.key && <span role="status" className="text-sm text-slate">{ta.preparing}</span>}
                        {cutError === a.key && <p role="alert" className="w-full text-sm text-red-strong">{ta.cutoutError}</p>}
                      </>
                    ) : (
                      a.winner && <p className="text-xs text-slate">{ta.noConsent}</p>
                    )}
                    {card && <Button variant="ghost" size="sm" onClick={() => props.onExportOne(a.key)}><Download size={16} aria-hidden="true" /> {ta.png}</Button>}
                    {a.kind === 'custom' && <Button variant="dangerGhost" size="sm" onClick={() => onAction({ type: 'removeCustom', key: a.key })}>{ta.remove}</Button>}
                  </div>
                </div>
              </section>
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        {!adding ? (
          <Button variant="secondary" disabled={customCount >= MAX_CUSTOM_AWARDS} onClick={() => setAdding(true)}>{ta.customAward}</Button>
        ) : (
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.title.trim() || !draft.playerId) return;
              onAction({ type: 'addCustom', title: draft.title.trim(), playerId: draft.playerId, note: draft.note.trim() });
              setDraft({ title: '', playerId: '', note: '' });
              setAdding(false);
            }}>
            <label className="text-sm text-slate">{ta.awardTitle}
              <input className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_TITLE_MAX} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="text-sm text-slate">{ta.player}
              <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={draft.playerId} onChange={(e) => setDraft({ ...draft, playerId: e.target.value })}>
                <option value="">{ta.choose}</option>
                {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate">{ta.note}
              <input aria-describedby="award-note-hint" className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_NOTE_MAX} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <HealthHint id="award-note-hint" />
            <Button type="submit" variant="primary">{ta.addAward}</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{ta.cancel}</Button>
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
