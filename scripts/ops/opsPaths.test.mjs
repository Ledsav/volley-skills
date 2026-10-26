// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isInside, safeMessage } from './opsPaths.mjs';

describe('isInside', () => {
  it('spots a folder inside the repo whatever the letter case on Windows', () => {
    const repo = 'C:\\Users\\me\\volley-skills';
    expect(isInside('C:\\Users\\me\\volley-skills\\out', repo, 'win32')).toBe(true);
    expect(isInside('c:\\users\\ME\\Volley-Skills\\out', repo, 'win32')).toBe(true);
    expect(isInside('C:\\Users\\me\\volley-skills', repo, 'win32')).toBe(true);
    expect(isInside('C:\\Users\\me\\volley-skills-backups', repo, 'win32')).toBe(false);
    expect(isInside('C:\\Backups', repo, 'win32')).toBe(false);
  });

  it('is case-sensitive elsewhere', () => {
    expect(isInside('/home/me/repo/out', '/home/me/repo', 'linux')).toBe(true);
    expect(isInside('/home/me/Repo/out', '/home/me/repo', 'linux')).toBe(false);
    expect(isInside('/home/me/repo-backups', '/home/me/repo', 'linux')).toBe(false);
  });
});

describe('safeMessage', () => {
  it('hides Firestore error details, which can contain document paths', () => {
    const e = Object.assign(new Error('5 NOT_FOUND: no entity clubs/demo/members/coach@example.com'), { code: 5 });
    expect(safeMessage(e)).toBe('Firestore error (code 5). Details hidden: they can contain document paths.');
    expect(safeMessage(e)).not.toContain('@');
  });

  it("keeps the scripts' own messages", () => {
    expect(safeMessage(new Error('Stopped at the read budget of 5 reads (spent 4).'))).toMatch(/read budget/);
  });
});
