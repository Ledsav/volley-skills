import { Button } from './Button';
import { Input } from './Input';

interface AttemptsInputProps {
  name: string;
  label: string;
  values: number[];
  onChange: (values: number[]) => void;
  minCount: number;
  maxCount?: number;
}

export function AttemptsInput({ name, label, values, onChange, minCount, maxCount }: AttemptsInputProps) {
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

  return (
    <div>
      {values.map((value, index) => (
        <div key={index} className="mb-3">
          <label htmlFor={`${name}-attempt-${index}`} className="mb-1 block text-sm font-medium text-ink">
            {label} {index + 1}
          </label>
          <Input
            id={`${name}-attempt-${index}`}
            type="number"
            step="any"
            value={Number.isNaN(value) ? '' : value}
            onChange={(e) => updateAt(index, e.target.value)}
            required
            className="w-full"
          />
        </div>
      ))}
      {maxCount !== undefined && values.length < maxCount && (
        <Button variant="secondary" size="sm" onClick={addAttempt} className="mb-3">
          + Add attempt
        </Button>
      )}
      {maxCount !== undefined && values.length > minCount && (
        <Button variant="ghost" size="sm" onClick={removeLast} className="mb-3 ml-2">
          Remove last attempt
        </Button>
      )}
    </div>
  );
}
