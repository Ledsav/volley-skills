import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillMeter } from './SkillMeter';

function getSegments() {
  return screen.getAllByTestId('skill-segment');
}

function filledSegments() {
  return getSegments().filter((el) => el.getAttribute('data-filled') === 'true');
}

describe('SkillMeter', () => {
  it('renders 10 segments regardless of score', () => {
    render(<SkillMeter score={5} />);
    expect(getSegments()).toHaveLength(10);
  });

  it('renders 10 segments and 0 filled when score is null', () => {
    render(<SkillMeter score={null} />);
    expect(getSegments()).toHaveLength(10);
    expect(filledSegments()).toHaveLength(0);
  });

  it('renders exactly 3 filled segments colored red (Beginner band) for score 3', () => {
    render(<SkillMeter score={3} />);
    const filled = filledSegments();
    expect(filled).toHaveLength(3);
    filled.forEach((el) => expect(el.className).toMatch(/bg-red\b/));
  });

  it('renders exactly 7 filled segments colored blue (Advanced band) for score 7', () => {
    render(<SkillMeter score={7} />);
    const filled = filledSegments();
    expect(filled).toHaveLength(7);
    filled.forEach((el) => expect(el.className).toMatch(/bg-blue\b/));
  });

  it('renders exactly 10 filled segments colored green (Elite band) for score 10', () => {
    render(<SkillMeter score={10} />);
    const filled = filledSegments();
    expect(filled).toHaveLength(10);
    filled.forEach((el) => expect(el.className).toMatch(/bg-green\b/));
  });

  it('renders unfilled segments with a neutral border color, not a band color', () => {
    render(<SkillMeter score={3} />);
    const unfilled = getSegments().filter((el) => el.getAttribute('data-filled') === 'false');
    expect(unfilled).toHaveLength(7);
    unfilled.forEach((el) => {
      expect(el.className).not.toMatch(/bg-(red|orange|blue|green)\b/);
      expect(el.className).toMatch(/border-border\b/);
    });
  });
});
