import type { Person } from '../../teams/stats/rosterIndex';

export const personLabel = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;
