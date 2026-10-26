/** "line 3" or "lines 1, 2, 3, 4, 5, …": at most the first five line numbers. */
export function lineList(lines: number[]): string {
  const first = lines.slice(0, 5).join(', ');
  return `${lines.length === 1 ? 'line' : 'lines'} ${first}${lines.length > 5 ? ', …' : ''}`;
}
