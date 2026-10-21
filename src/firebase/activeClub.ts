let activeClubId: string | null = null;

export function setActiveClubId(id: string | null): void {
  activeClubId = id;
}

export function getActiveClubId(): string {
  if (!activeClubId) throw new Error('No active club');
  return activeClubId;
}
