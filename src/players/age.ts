const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole years between an ISO `YYYY-MM-DD` date of birth and a reference date
 * (default: today). Returns null when `dob` is empty or not a real calendar date.
 */
export function ageFromDob(dob: string, now: Date = new Date()): number | null {
  const match = ISO_DATE.exec(dob);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return null;

  let age = now.getFullYear() - y;
  const hadBirthday = now.getMonth() > m - 1 || (now.getMonth() === m - 1 && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}
