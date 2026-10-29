import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './Logo';

describe('Logo', () => {
  it('BrandMark shows the wordmark and a decorative mark', () => {
    const { container } = render(<BrandMark />);
    expect(screen.getByText('Volley Skills')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('shows the app icon tile', () => {
    const { container } = render(<BrandMark />);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('volley-skills-mark-app-icon');
  });

  it('the mark tile carries the dark-mode edge', () => {
    const { container } = render(<BrandMark />);
    expect(container.querySelector('img')).toHaveClass('shadow-[0_0_0_1px_var(--brand-tile-edge)]');
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/^:root\s*\{[^}]*--brand-tile-edge:\s*transparent;/m);
    expect(css).toMatch(/^\.dark\s*\{[^}]*--brand-tile-edge:\s*rgb\(255 255 255 \/ 0\.16\);/m);
  });

  it('without the wordmark the mark carries the name', () => {
    render(<BrandMark wordmark={false} />);
    expect(screen.getByRole('img', { name: 'Volley Skills' })).toBeInTheDocument();
    expect(screen.queryByText('Volley Skills')).toBeNull();
  });

  it('src/assets/brand holds exactly the brand kit masters', () => {
    const kit = resolve(process.cwd(), 'docs/design/brand/logo');
    const app = resolve(process.cwd(), 'src/assets/brand');
    const masters = readdirSync(kit).filter((f) => f.endsWith('.svg')).sort();
    expect(readdirSync(app).sort()).toEqual(masters);
    for (const f of masters) {
      expect(readFileSync(resolve(app, f)).equals(readFileSync(resolve(kit, f))), f).toBe(true);
    }
  });
});
