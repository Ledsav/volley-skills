import { useMemo, useState } from 'react';
import { Play, Share2, X } from 'lucide-react';
import { Button, buttonClassName } from '../components/Button';
import { Menu } from '../components/Menu';
import { SegmentedControl } from '../components/SegmentedControl';
import { useWindowScrolled } from '../layout/useWindowScrolled';
import type { Person } from '../teams/stats/rosterIndex';
import type { CardArt, CardModel } from './card/drawAwardCard';
import { PRESET_PALETTES, type Palette, type PalettePrefs, type SlideColors } from './palette';
import { PaletteEditor } from './PaletteEditor';
import type { NameStyle } from './nameStyle';
import { useT } from '../i18n/I18nProvider';
import { PhotoCropDialog } from './PhotoCropDialog';
import { revealable, type ResolvedAward } from './resolveAwards';
import { ChooseStep } from './prepare/ChooseStep';
import { PhotosStep } from './prepare/PhotosStep';
import { PreviewStep } from './prepare/PreviewStep';

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

export type PrepareStep = 'choose' | 'photos' | 'preview';

export function AwardsPrepare(props: AwardsPrepareProps) {
  const t = useT();
  const ta = t.awards.prepare;
  const { awards, cardFor } = props;
  // The step is not stored. The crop sheet, palette editor and a running cut-out live here, so a step change keeps them.
  const [step, setStep] = useState<PrepareStep>('choose');
  const [cropFor, setCropFor] = useState<{ key: string; file: File } | null>(null);
  const [editing, setEditing] = useState<Palette | 'new' | null>(null);
  const [cutting, setCutting] = useState<string | null>(null);
  const [cutError, setCutError] = useState<string | null>(null);
  const scrolled = useWindowScrolled();
  const cards = useMemo(() => new Map(awards.map((a) => [a.key, cardFor(a)])), [awards, cardFor]);
  const noWinners = revealable(awards).length === 0;
  const stepOptions = [
    { id: 'choose' as const, label: ta.steps.choose },
    { id: 'photos' as const, label: ta.steps.photos },
    { id: 'preview' as const, label: ta.steps.preview },
  ];

  return (
    <div className="min-h-[100dvh] bg-bg">
      <header className={`sticky top-0 z-30 grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 px-4 ${scrolled ? 'glass' : 'bg-bg'}`}>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={props.onClose} aria-label={ta.closeAria}><X size={20} aria-hidden="true" /></Button>
        <div className="min-w-0 text-center">
          <h1 className="text-headline text-ink">{ta.title}</h1>
          <p className="truncate text-footnote text-ink-2">
            {props.heading} · <span role="status" className={props.saveState === 'error' ? 'text-red-strong' : undefined}>{ta.saveState[props.saveState]}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!noWinners && (
            <Menu
              label={ta.export}
              triggerClassName={`${buttonClassName('secondary', 'pill')} gap-2`}
              trigger={<><Share2 size={16} aria-hidden="true" /><span className="hidden sm:inline">{ta.export}</span></>}
              items={[
                { kind: 'action', label: ta.winnerCards, onSelect: props.onExportAll },
                { kind: 'action', label: ta.summaryCard, onSelect: props.onExportSummary },
                props.videoAvailable
                  ? { kind: 'action', label: ta.recordVideo, onSelect: props.onRecordVideo }
                  : { kind: 'action', label: ta.recordVideo, hint: ta.videoUnsupported, disabled: true, onSelect: () => {} },
              ]}
            />
          )}
          <Button variant="primary" size="pill" className="gap-1" disabled={noWinners} onClick={props.onPresent}><Play size={16} aria-hidden="true" /> {ta.present}</Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[880px] px-4 pb-16 sm:px-6">
        <SegmentedControl semantics="tabs" label={ta.steps.label} options={stepOptions} value={step} onChange={setStep} className="mt-2 w-full sm:w-auto" />
        {noWinners && <p className="mt-4 text-callout text-ink-2">{ta.noWinners}</p>}
        {props.notice && <p role="alert" className="mt-4 text-callout text-red-strong">{props.notice}</p>}

        <div role="tabpanel" aria-label={ta.steps[step]} className="mt-6">
          {step === 'choose' && <ChooseStep awards={awards} people={props.people} onAction={props.onAction} />}
          {step === 'photos' && (
            <PhotosStep awards={awards} photoAllowed={props.photoAllowed} photos={props.photos} cutouts={props.cutouts} onPhoto={props.onPhoto} onCutout={props.onCutout}
              colorsFor={props.colorsFor} artFor={props.artFor} cards={cards}
              cutting={cutting} setCutting={setCutting} cutError={cutError} setCutError={setCutError}
              onPickFile={(key, file) => setCropFor({ key, file })} />
          )}
          {step === 'preview' && (
            <PreviewStep awards={awards} palettePrefs={props.palettePrefs} onPalettePrefs={props.onPalettePrefs} includeStory={props.includeStory} onIncludeStory={props.onIncludeStory}
              storyLabel={props.storyLabel} hasBackground={props.hasBackground} onBackground={props.onBackground} nameStyle={props.nameStyle} onNameStyle={props.onNameStyle}
              branding={props.branding} onClubLogo={props.onClubLogo} onAddSponsors={props.onAddSponsors} onRemoveSponsor={props.onRemoveSponsor} onLogosMono={props.onLogosMono}
              colorsFor={props.colorsFor} artFor={props.artFor} onExportOne={props.onExportOne} cards={cards} onEditPalette={setEditing} />
          )}
        </div>
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
