// src/awards/card/initials.ts

/** First letter of each of the first two words, uppercased ('Lena P.' gives 'LP'); '' when there is none. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => /\p{L}/u.exec(w)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase();
}
