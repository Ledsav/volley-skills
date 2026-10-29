/** U+2212: a real minus sign is as wide as "+" in tabular figures, where "-" reads as a spaced dash ("- 1"). */
export const MINUS = '−';

/** Swaps a leading hyphen-minus for a true minus ("-14%" → "−14%"). */
export function trueMinus(text: string): string {
  return text.startsWith('-') ? MINUS + text.slice(1) : text;
}

/** A signed integer for display: "+3", "−2", "0". */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '0';
}
