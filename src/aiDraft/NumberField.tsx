import { useEffect, useState } from 'react';
import { Input } from '../components/Input';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * A whole-number input the coach can clear and retype freely: the text is kept as typed,
 * a value is committed only once it is a whole number in range, and leaving the field
 * with anything else restores the last committed value.
 */
export function NumberField({ value, min, max, onChange, ...rest }: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  return (
    <Input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
