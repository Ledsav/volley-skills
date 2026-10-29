import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Sheet } from '../components/Sheet';
import { useT } from '../i18n/I18nProvider';
import { MAX_COLORS, MIN_COLORS, PRESET_PALETTES, newPaletteId, slideColors, type Palette } from './palette';

const DEFAULT_COLORS = PRESET_PALETTES.find((p) => p.id === 'wrapped')!.colors.slice(0, MIN_COLORS);

export function PaletteEditor({ initial, onSave, onDelete, onCancel }: {
  initial: Palette | null; onSave: (p: Palette) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const t = useT().awards.paletteEditor;
  const [name, setName] = useState(initial?.name ?? t.defaultName);
  const [colors, setColors] = useState<string[]>(initial?.colors ?? DEFAULT_COLORS);
  const draft: Palette = { id: initial?.id ?? 'draft', name, colors };
  const setColor = (i: number, v: string) => setColors((cs) => cs.map((c, j) => (j === i ? v.toUpperCase() : c)));
  // Adding or removing a colour is a button-only edit, so the guard cannot rely on change events.
  const dirty = name !== (initial?.name ?? t.defaultName) || colors.join() !== (initial?.colors ?? DEFAULT_COLORS).join();
  const save = () => onSave({ id: initial?.id ?? newPaletteId(), name: name.trim(), colors });

  return (
    <Sheet title={initial ? t.editTitle : t.newTitle} onClose={onCancel} dirty={dirty}
      confirm={{ label: t.save, onConfirm: save, disabled: !name.trim() }}>
      <label className="block text-headline text-ink" htmlFor="palette-name">{t.name}</label>
      <Input id="palette-name" className="mt-1 w-full" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />

      <p className="mt-4 text-headline text-ink">{t.colours}</p>
      <p className="text-footnote text-ink-2">{t.coloursHint}</p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {colors.map((c, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            <input type="color" aria-label={t.colour(i + 1)} value={c} onChange={(e) => setColor(i, e.target.value)}
              className="h-12 w-12 cursor-pointer rounded-md ring-1 ring-separator" />
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={t.removeColour(i + 1)} disabled={colors.length <= MIN_COLORS}
              onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}>
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" className="mt-2" disabled={colors.length >= MAX_COLORS}
        onClick={() => setColors((cs) => [...cs, cs[cs.length % cs.length]])}>{t.addColour}</Button>

      <p className="mt-4 text-headline text-ink">{t.preview}</p>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        {colors.map((_, i) => {
          const sc = slideColors(draft, i);
          return (
            <div key={i} className="flex aspect-[9/16] w-12 flex-col items-center justify-center rounded-sm" style={{ background: sc.bg }}>
              <span className="text-lg font-black" style={{ color: sc.accent }}>7</span>
              <span className="text-[11px] font-semibold" style={{ color: sc.text }}>{t.previewWins}</span>
            </div>
          );
        })}
      </div>

      {onDelete && (
        <div className="mt-6 border-t border-separator pt-4">
          <Button variant="dangerGhost" onClick={onDelete}><Trash2 size={16} aria-hidden="true" /> {t.delete}</Button>
        </div>
      )}
    </Sheet>
  );
}
