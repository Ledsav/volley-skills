export function formatBusinessId(sequence: number): string {
  return `TR-${String(sequence).padStart(4, '0')}`;
}
