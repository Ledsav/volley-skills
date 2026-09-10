import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { SkillGuideConfig, SkillGuideEntry } from '../types/skillGuide';

/**
 * Fallback used until an admin saves `skillGuide/config` for the first time,
 * so the editor is usable on a fresh project instead of rendering an empty list.
 * Source: the club's own scoring rubric spreadsheet.
 */
export const DEFAULT_SKILL_GUIDE: SkillGuideEntry[] = [
  {
    key: 'serve',
    label: 'Serve',
    ranges: [
      { min: 1, max: 3, description: 'Inconsistent, many faults.' },
      { min: 4, max: 6, description: 'Regular float/jump-float, holds under pressure.' },
      { min: 7, max: 8, description: 'Tactical serving with direction & spin.' },
      { min: 9, max: 10, description: 'Jump-serve with pace, precision & zone targeting.' },
    ],
    howToEvaluate:
      'Count % of serves in over 10 attempts. Score based on accuracy %, consistency & tactical variation observed in game/drill context.',
  },
  {
    key: 'attack',
    label: 'Attack',
    ranges: [
      { min: 1, max: 3, description: 'Arm swing issues, telegraphed approach.' },
      { min: 4, max: 6, description: 'Clean hit on 2-step approach, limited zones.' },
      { min: 7, max: 8, description: 'Attacks multiple zones, adjusts to set.' },
      { min: 9, max: 10, description: 'Kills consistently, reads block, back-row capable.' },
    ],
    howToEvaluate:
      'Track kill %, error % in 3-set match or blocking drill. Observe approach timing, arm speed, and ability to redirect hit.',
  },
  {
    key: 'block',
    label: 'Block',
    ranges: [
      { min: 1, max: 3, description: 'Late timing, hands short of the net, frequent tools and roofs against.' },
      { min: 4, max: 6, description: 'Reads the setter, times a stationary block, seals the net on quick balls.' },
      { min: 7, max: 8, description: 'Moves and closes a two-person block, takes away line or angle on call.' },
      { min: 9, max: 10, description: 'Reads the hitter early, presses and rebounds, stuffs or channels most attacks.' },
    ],
    howToEvaluate:
      'Count stuff blocks, touches, and block errors over a set or blocking drill. Judge timing, hand penetration over the net, and closing with a second blocker.',
  },
  {
    key: 'set',
    label: 'Set',
    ranges: [
      { min: 1, max: 3, description: 'Inconsistent hand contact or location.' },
      { min: 4, max: 6, description: 'Reliable overhead set to OH from position 3.' },
      { min: 7, max: 8, description: 'Back-sets, quick sets, adjusts to bad pass.' },
      { min: 9, max: 10, description: 'Controls tempo, deceives block, manages team.' },
    ],
    howToEvaluate:
      'Evaluate contact quality, set height/distance accuracy, and tactical decision-making in game-like situations. Count % location errors.',
  },
  {
    key: 'defence',
    label: 'Defence',
    ranges: [
      { min: 1, max: 3, description: 'Reactive only, poor reading.' },
      { min: 4, max: 6, description: 'Digs hard-driven balls in position.' },
      { min: 7, max: 8, description: 'Anticipates attack line, covers tips, good footwork.' },
      { min: 9, max: 10, description: 'Controls dig direction, leads defensive system.' },
    ],
    howToEvaluate:
      'Assess dig success rate in pepper drills and game play. Note footwork, platform angle, and reading of attacker body language.',
  },
  {
    key: 'reception',
    label: 'Reception',
    ranges: [
      { min: 1, max: 3, description: "Platform unstable, can't direct pass." },
      { min: 4, max: 6, description: 'Passes to zone 3 consistently on medium pace.' },
      { min: 7, max: 8, description: 'Handles float & jump serves, side-out passes.' },
      { min: 9, max: 10, description: 'Perfect pass %, moves well under pressure.' },
    ],
    howToEvaluate:
      'Measure pass rating (0-3 scale) over 15+ receptions. Calculate average pass score. Observe movement to ball and platform consistency.',
  },
  {
    key: 'jump',
    label: 'Jump',
    ranges: [
      { min: 1, max: 3, description: '<30cm vertical.' },
      { min: 4, max: 6, description: '30-40cm, basic timing.' },
      { min: 7, max: 8, description: '40-50cm, good block/attack timing.' },
      { min: 9, max: 10, description: '50cm+, elite timing for age.' },
    ],
    howToEvaluate:
      'Measure standing vertical jump (cm) with a wall reach test. Note: approach jump may differ. Combine with block timing observation in live reps.',
  },
  {
    key: 'speed',
    label: 'Speed',
    ranges: [
      { min: 1, max: 3, description: 'Slow first step, poor court coverage.' },
      { min: 4, max: 6, description: 'Average reaction, covers near zone.' },
      { min: 7, max: 8, description: 'Quick first step, good side-to-side range.' },
      { min: 9, max: 10, description: 'Elite court speed, anticipates, gets to every ball.' },
    ],
    howToEvaluate:
      'Use 5m sprint time or side-to-side agility test. Supplement with in-game observation of first-step quickness and court coverage in defence.',
  },
  {
    key: 'iq',
    label: 'IQ',
    ranges: [
      { min: 1, max: 3, description: 'Unaware of game situation.' },
      { min: 4, max: 6, description: 'Understands basic rotations and role.' },
      { min: 7, max: 8, description: 'Reads opponents, makes smart tactical choices.' },
      { min: 9, max: 10, description: 'Coaches on court, controls tempo, leads system.' },
    ],
    howToEvaluate:
      'Observe in game/scrimmage: does player call plays, recognise mismatches, adjust after errors? Rate decision quality over a full match, not just flashy plays.',
  },
];

export async function getSkillGuide(): Promise<SkillGuideConfig> {
  const snapshot = await getDoc(doc(db, 'skillGuide', 'config'));
  return snapshot.exists()
    ? (snapshot.data() as SkillGuideConfig)
    : { skills: DEFAULT_SKILL_GUIDE, updatedBy: '', updatedAt: null };
}

export async function updateSkillGuide(skills: SkillGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'skillGuide', 'config'), { skills, updatedBy, updatedAt: serverTimestamp() });
}
