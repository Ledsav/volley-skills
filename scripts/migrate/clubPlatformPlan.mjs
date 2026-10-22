// Pure planner for the club-platform migration (club platform spec §9.1–9.4): the
// single-club top-level data becomes the first tenant under clubs/{clubId}. No I/O:
// clubPlatformRun.mjs reads the legacy tree, calls this, and writes the result.

import { newClubDoc } from '../seed/clubArg.mjs';

/** Every top-level collection the single-club app used (read recursively). */
export const LEGACY_COLLECTIONS = ['adminAllowlist', 'users', 'sectionAccess', 'skillGuide',
  'physicalTestGuide', 'teams', 'exercises', 'trainings', 'counters'];

const LIBRARY = ['exercises', 'trainings', 'counters'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const lower = (e) => String(e ?? '').trim().toLowerCase();
const lowerList = (list) => [...new Set((Array.isArray(list) ? list : []).map(lower).filter(Boolean))];

function validate({ clubId, owner, operator, country, locale }) {
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(clubId ?? '')) throw new Error(`clubId must be a lowercase slug (got "${clubId}")`);
  if (!EMAIL.test(owner ?? '')) throw new Error('owner must be an email');
  if (!EMAIL.test(operator ?? '')) throw new Error('operator must be an email');
  if (lower(owner) === lower(operator)) throw new Error('owner must not be the operator');
  if (!/^[A-Z]{2}$/.test(country ?? '')) throw new Error('country must be a two-letter code like ES');
  if (!['en', 'it'].includes(locale)) throw new Error('locale must be en or it');
}

/** The most common non-empty team.club (ties: alphabetically first), or null. */
function mostCommonClubName(teams) {
  const counts = new Map();
  for (const { data } of teams) {
    const name = typeof data.club === 'string' ? data.club.trim() : '';
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked[0]?.[0] ?? null;
}

/**
 * source: { path, data }[] for every doc under LEGACY_COLLECTIONS (any depth).
 * now: the timestamp written as createdAt/addedAt (a serverTimestamp sentinel).
 * Returns the club doc (written first), the other writes in order, the members, and
 * the expected doc count per destination group (for verification).
 */
export function planMigration(source, { clubId, owner, operator, name, country, locale = 'en', now }) {
  validate({ clubId, owner, operator, country, locale });
  const ownerEmail = lower(owner);
  const operatorEmail = lower(operator);
  const root = `clubs/${clubId}`;
  const seg = (d) => d.path.split('/');
  const top = (d) => seg(d)[0];
  const isTeam = (d) => top(d) === 'teams' && seg(d).length === 2;
  const isPlayer = (d) => top(d) === 'teams' && seg(d).length === 4 && seg(d)[2] === 'players';

  const clubName = name ?? mostCommonClubName(source.filter(isTeam));
  if (!clubName) throw new Error('no team names a club: pass --name');

  // Members: admins from the allowlist (plus the owner); everyone else with any access is a member.
  const admins = new Set([ownerEmail, ...source.filter((d) => top(d) === 'adminAllowlist').map((d) => lower(seg(d)[1]))]);
  admins.delete('');
  const others = new Set();
  for (const d of source) {
    if (isTeam(d)) lowerList(d.data.adminEmails).forEach((e) => others.add(e));
    if (isPlayer(d)) lowerList(d.data.viewerEmails).forEach((e) => others.add(e));
    if (top(d) === 'sectionAccess' && seg(d).length === 2) lowerList(d.data.adminEmails).forEach((e) => others.add(e));
  }
  const members = [
    ...[...admins].map((email) => ({ email, role: 'admin' })),
    ...[...others].filter((e) => !admins.has(e)).map((email) => ({ email, role: 'member' })),
  ];

  const memberWrites = members.map(({ email, role }) => ({
    path: `${root}/members/${email}`,
    data: { email, clubId, role, addedBy: 'migration', addedAt: now },
  }));
  const platformWrites = [{ path: `platformAdmins/${operatorEmail}`, data: { addedBy: 'migration', addedAt: now } }];
  const sectionWrites = source
    .filter((d) => top(d) === 'sectionAccess' && seg(d).length === 2)
    .map((d) => ({ path: `${root}/sectionAccess/${seg(d)[1]}`, data: { adminEmails: lowerList(d.data.adminEmails) } }));
  const guideWrites = [
    ['skillGuide', 'skillGuide'],
    ['physicalTestGuide', 'physicalTestGuide'],
  ].flatMap(([from, to]) =>
    source.filter((d) => d.path === `${from}/config`).map((d) => ({ path: `${root}/config/${to}`, data: d.data })),
  );
  const libraryWrites = source
    .filter((d) => LIBRARY.includes(top(d)))
    .map((d) => ({ path: `${root}/${d.path}`, data: d.data }));
  const teamWrites = source
    .filter((d) => top(d) === 'teams')
    .map((d) => {
      if (isTeam(d)) {
        const { club: _club, ...rest } = d.data;
        return { path: `${root}/${d.path}`, data: { ...rest, adminEmails: lowerList(d.data.adminEmails) } };
      }
      if (isPlayer(d)) return { path: `${root}/${d.path}`, data: { ...d.data, viewerEmails: lowerList(d.data.viewerEmails) } };
      return { path: `${root}/${d.path}`, data: d.data };
    });
  const userWrites = source
    .filter((d) => top(d) === 'users' && seg(d).length === 2 && 'role' in d.data)
    .map((d) => {
      const { role: _role, ...rest } = d.data;
      return { path: d.path, data: rest };
    });

  const countUnder = (group) => [...libraryWrites, ...teamWrites].filter((w) => w.path.startsWith(`${root}/${group}/`)).length;

  return {
    club: {
      path: root,
      data: newClubDoc(
        { name: clubName, country, locale, ownerEmail, status: 'active', aiEnabled: true, growthTestsEnabled: true },
        now,
      ),
    },
    writes: [...memberWrites, ...platformWrites, ...sectionWrites, ...guideWrites, ...libraryWrites, ...teamWrites, ...userWrites],
    members,
    expected: {
      teams: countUnder('teams'),
      exercises: countUnder('exercises'),
      trainings: countUnder('trainings'),
      counters: countUnder('counters'),
      config: guideWrites.length,
      sectionAccess: sectionWrites.length,
      members: members.length,
    },
  };
}
