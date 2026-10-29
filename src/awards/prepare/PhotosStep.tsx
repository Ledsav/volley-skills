import { ImagePlus } from 'lucide-react';
import { Button, buttonClassName } from '../../components/Button';
import { useT } from '../../i18n/I18nProvider';
import type { AwardsPrepareProps } from '../AwardsPrepare';
import { CardThumbnail } from '../CardThumbnail';
import type { CardModel } from '../card/drawAwardCard';
import { personLabel as label } from './personLabel';

type Props = Pick<AwardsPrepareProps, 'awards' | 'photoAllowed' | 'photos' | 'cutouts' | 'onPhoto' | 'onCutout' | 'colorsFor' | 'artFor'> & {
  cards: Map<string, CardModel | null>;
  cutting: string | null;
  setCutting: (key: string | null) => void;
  cutError: string | null;
  setCutError: (key: string | null) => void;
  onPickFile: (key: string, file: File) => void;
};

/** Step 2: a photo per winner (only with consent), optional background removal. */
export function PhotosStep(props: Props) {
  const ta = useT().awards.prepare;
  const { cutting, setCutting, cutError, setCutError } = props;
  const winners = props.awards.filter((a) => a.winner);
  return (
    <ol className="space-y-3">
      {winners.map((a) => {
        const titleId = `photo-${a.key}`;
        const card = props.cards.get(a.key) ?? null;
        const photo = props.photos.get(a.key) ?? null;
        return (
          <li key={a.key}>
            <section aria-labelledby={titleId} className={`flex gap-4 rounded-lg bg-surface p-4 shadow-card ${a.hidden ? 'opacity-60' : ''}`}>
              {card && <CardThumbnail card={card} colors={props.colorsFor(a.key)} art={props.artFor(a.key)} />}
              <div className="min-w-0 flex-1 space-y-2">
                <h2 id={titleId} className="text-headline text-ink">{a.title}</h2>
                <p className="text-footnote text-ink-2">{label(a.winner!)}</p>
                {props.photoAllowed(a.key) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`${buttonClassName('secondary', 'pill')} min-h-11 gap-1 focus-within:ring-2 focus-within:ring-focus`}>
                      <ImagePlus size={16} aria-hidden="true" /> {photo ? ta.changePhoto : ta.addPhoto}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onPickFile(a.key, f); e.target.value = ''; }} />
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
                    {cutting === a.key && <span role="status" className="text-footnote text-ink-2">{ta.preparing}</span>}
                    {cutError === a.key && <p role="alert" className="w-full text-footnote text-red-strong">{ta.cutoutError}</p>}
                  </div>
                ) : (
                  <p className="text-footnote text-ink-2">{ta.noConsent}</p>
                )}
              </div>
            </section>
          </li>
        );
      })}
    </ol>
  );
}
