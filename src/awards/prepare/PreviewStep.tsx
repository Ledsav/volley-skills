import { Download, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { FIELD_CLASS } from '../../components/Input';
import { useT } from '../../i18n/I18nProvider';
import { PRESET_PALETTES, selectedPalette, type Palette } from '../palette';
import { NAME_STYLES, type NameStyle } from '../nameStyle';
import { MAX_SPONSORS } from '../card/branding';
import type { CardModel } from '../card/drawAwardCard';
import type { AwardsPrepareProps } from '../AwardsPrepare';
import { CardThumbnail } from '../CardThumbnail';
import { LogoThumb } from '../LogoThumb';

type Props = Pick<AwardsPrepareProps,
  'awards' | 'palettePrefs' | 'onPalettePrefs' | 'includeStory' | 'onIncludeStory' | 'storyLabel' | 'hasBackground' | 'onBackground' |
  'nameStyle' | 'onNameStyle' | 'branding' | 'onClubLogo' | 'onAddSponsors' | 'onRemoveSponsor' | 'onLogosMono' | 'colorsFor' | 'artFor' | 'onExportOne'> & {
  cards: Map<string, CardModel | null>;
  onEditPalette: (p: Palette | 'new') => void;
};

const ROW = 'flex min-h-[52px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-callout text-ink';
const FILE = 'text-callout file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:text-callout file:font-semibold file:text-ink';

/** Step 3: card settings, then every card with its PNG. */
export function PreviewStep(props: Props) {
  const t = useT();
  const ta = t.awards.prepare;
  const paletteName = (p: Palette) => t.awards.paletteNames[p.id] ?? p.name;
  const palette = selectedPalette(props.palettePrefs);
  const isCustom = props.palettePrefs.custom.some((p) => p.id === palette.id);
  const withCards = props.awards.filter((a) => props.cards.get(a.key));

  return (
    <>
      <section aria-label={ta.cardSettings} className="divide-y divide-separator rounded-lg bg-surface shadow-card">
        <div className={ROW}>
          <label className="flex items-center gap-2">{ta.palette}
            <select className={`${FIELD_CLASS} min-h-11`} value={props.palettePrefs.selectedId}
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
            {palette.colors.map((c, i) => <span key={i} className="h-6 w-6 rounded-sm ring-1 ring-separator" style={{ background: c }} />)}
          </span>
          <span className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={() => props.onEditPalette('new')}>{ta.newPalette}</Button>
            {isCustom && <Button variant="ghost" size="sm" onClick={() => props.onEditPalette(palette)}>{ta.editPalette}</Button>}
          </span>
        </div>
        <div className={ROW}>
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={props.includeStory} onChange={(e) => props.onIncludeStory(e.target.checked)} />
            {props.storyLabel}
          </label>
        </div>
        <div className={ROW}>
          <label className="flex flex-wrap items-center gap-2">{ta.backgroundImage}
            <input type="file" accept="image/*" aria-describedby="awards-background-hint" className={FILE} onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; props.onBackground(f); }} />
          </label>
          {props.hasBackground && <Button variant="ghost" size="sm" onClick={() => props.onBackground(null)}>{ta.removeBackground}</Button>}
          {/* Photos of minors are used only with recorded consent (Terms T7); a background has none. */}
          <span id="awards-background-hint" className="block w-full text-footnote text-ink-2">{ta.backgroundHint}</span>
        </div>
        <div className={ROW}>
          <label className="flex items-center gap-2">{ta.namesOnCards}
            <select className={`${FIELD_CLASS} min-h-11`} value={props.nameStyle} onChange={(e) => props.onNameStyle(e.target.value as NameStyle)}>
              {NAME_STYLES.map((s) => <option key={s} value={s}>{t.awards.nameStyle[s]}</option>)}
            </select>
          </label>
        </div>
        <div role="group" aria-label={ta.branding} className={`${ROW} justify-start`}>
          <span className="font-semibold">{ta.branding}</span>
          {props.branding.clubLogo ? (
            <span className="inline-flex items-center gap-1">
              <LogoThumb img={props.branding.clubLogo} />
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={ta.removeClubLogo} onClick={() => props.onClubLogo(null)}><X size={14} aria-hidden="true" /></Button>
            </span>
          ) : (
            <label className="flex flex-wrap items-center gap-2">{ta.clubLogo}
              <input type="file" accept="image/*" className={FILE} onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) props.onClubLogo(f); }} />
            </label>
          )}
          {props.branding.sponsors.map((img, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <LogoThumb img={img} />
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={ta.removeSponsor(i + 1)} onClick={() => props.onRemoveSponsor(i)}><X size={14} aria-hidden="true" /></Button>
            </span>
          ))}
          <label className="flex flex-wrap items-center gap-2">{ta.addSponsorLogos}
            <input type="file" accept="image/*" multiple disabled={props.branding.sponsors.length >= MAX_SPONSORS} className={FILE}
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) props.onAddSponsors(fs); }} />
          </label>
          {props.branding.sponsors.length >= MAX_SPONSORS && <span className="text-footnote text-ink-2">{ta.maxSponsors(MAX_SPONSORS)}</span>}
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={!props.branding.mono} onChange={(e) => props.onLogosMono(!e.target.checked)} />
            {ta.originalColours}
          </label>
        </div>
      </section>
      <p className="mt-3 text-footnote text-ink-2">{ta.privacyNote}</p>

      <h2 className="mt-8 text-title-3 text-ink">{ta.cards}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {withCards.map((a) => (
          <li key={a.key} className={`flex flex-col items-start gap-2 ${a.hidden ? 'opacity-60' : ''}`}>
            <CardThumbnail card={props.cards.get(a.key)!} colors={props.colorsFor(a.key)} art={props.artFor(a.key)} width={132} />
            <p className="text-footnote text-ink-2">{a.title}</p>
            <Button variant="ghost" size="sm" onClick={() => props.onExportOne(a.key)}><Download size={16} aria-hidden="true" /> {ta.png}</Button>
          </li>
        ))}
      </ul>
    </>
  );
}
