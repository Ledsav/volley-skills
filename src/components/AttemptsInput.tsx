import { Button } from './Button';
import { Input } from './Input';
import { useT } from '../i18n/I18nProvider';

interface AttemptsInputProps {
  name: string;
  label: string;
  values: number[];
  onChange: (values: number[]) => void;
  minCount: number;
  maxCount?: number;
  /** 'stat' lays attempts out in a 3-column grid of large, centred inputs (the add-test sheet). */
  size?: 'md' | 'stat';
}

export function AttemptsInput({ name, label, values, onChange, minCount, maxCount, size = 'md' }: AttemptsInputProps) {
  const t = useT().components.attempts;
  function updateAt(index: number, raw: string) {
    const next = [...values];
    next[index] = raw === '' ? NaN : Number(raw);
    onChange(next);
  }

  function addAttempt() {
    onChange([...values, NaN]);
  }

  function removeLast() {
    if (values.length > minCount) onChange(values.slice(0, -1));
  }

  const stat = size === 'stat';
  return (
    <div>
      <div data-testid="attempts-grid" className={stat ? 'mb-3 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3' : undefined}>
        {values.map((value, index) => (
          <div key={index} className={stat ? 'min-w-0' : 'mb-3'}>
            <label htmlFor={`${name}-attempt-${index}`} className={stat ? 'mb-1 block text-footnote text-ink-2' : 'mb-1 block text-sm font-medium text-ink'}>
              {label} {index + 1}
            </label>
            <Input
              id={`${name}-attempt-${index}`}
              type="number"
              inputMode="decimal"
              step="any"
              value={Number.isNaN(value) ? '' : value}
              onChange={(e) => updateAt(index, e.target.value)}
              required
              className={stat ? 'w-full text-center text-stat tabular-nums' : 'w-full'}
            />
          </div>
        ))}
      </div>
      {maxCount !== undefined && values.length < maxCount && (
        <Button variant="secondary" size="sm" onClick={addAttempt} className="mb-3 min-h-11">
          {t.add}
        </Button>
      )}
      {maxCount !== undefined && values.length > minCount && (
        <Button variant="secondary" size="sm" onClick={removeLast} className="mb-3 ml-2 min-h-11">
          {t.removeLast}
        </Button>
      )}
    </div>
  );
}
