import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { PhysicalTestGuideConfig, PhysicalTestGuideEntry } from '../types/physicalTestGuide';

/**
 * Fallback used until an admin saves `physicalTestGuide/config` for the first time,
 * so the editor is usable on a fresh project. Source: the coach's own written
 * testing protocol.
 */
export const DEFAULT_PHYSICAL_TEST_GUIDE: PhysicalTestGuideEntry[] = [
  {
    key: 'growth',
    label: 'Growth',
    protocol: 'Record height (cm) and body mass (kg). This is your main growth/context tracking metric — track exact figures over time.',
  },
  {
    key: 'cmj',
    label: 'Countermovement Jump',
    protocol:
      'Hands on hips if possible (arm swing adds variability). Quick downward movement, jump as high as possible. Record best of 3 attempts. Rest ~45-60s between attempts. Use a jump mat or phone app if available; otherwise use the same wall/chalk method every time.',
  },
  {
    key: 'approachJump',
    label: 'Approach Jump',
    protocol:
      'Use the same approach every test. Measure standing reach first, then measure maximum touch height with a 3-attempt approach jump. Approach jump height = maximum touch − standing reach. Record both figures — max touch is meaningful to the players too.',
  },
  {
    key: 'broadJump',
    label: 'Standing Broad Jump',
    protocol:
      'Toe behind the line, two-foot takeoff, two-foot controlled landing. Measure from the start line to the back heel. Three attempts, best result.',
  },
  {
    key: 'sprint10m',
    label: '10m Sprint',
    protocol:
      'Start 0.5-1m behind the line. Measure 10m. Two or three attempts, resting ~2 minutes between. Best time counts. Timing gates are ideal; otherwise use the same timer/method every session, or film the start/finish in slow motion.',
  },
  {
    key: 'shuttle5105',
    label: '5-10-5 Shuttle',
    protocol:
      'Place three cones/lines 5m apart, start at the middle. Sprint 5m one direction, turn and sprint 10m the other way, turn and sprint 5m back through the middle. Test both right-first and left-first — the asymmetry between them is often more useful than the overall time.',
  },
  {
    key: 'reaction',
    label: 'Reaction Time',
    protocol:
      'Ruler-drop test. Athlete holds thumb and finger around the bottom of a ruler without touching it; tester releases it unpredictably; athlete catches it. Record the distance fallen. Do 5 attempts, discard the best and worst, and average the middle 3. Treat this as a secondary metric — sport-specific reactive drills matter more for real game reaction ability.',
  },
  {
    key: 'strength',
    label: 'Strength',
    protocol:
      "For this age group, don't run a maximal 1RM test. Once technique is solid, use a clean 6RM in one standard exercise (trap-bar deadlift, squat, or goblet squat) and compare the athlete with herself over time. If there's no gym access, don't invent a lower-quality weighted test — track push-ups or split-squat reps as a muscular-endurance measure instead, using jumps as your lower-body power measure.",
  },
];

export async function getPhysicalTestGuide(): Promise<PhysicalTestGuideConfig> {
  const snapshot = await getDoc(doc(db, 'physicalTestGuide', 'config'));
  return snapshot.exists()
    ? (snapshot.data() as PhysicalTestGuideConfig)
    : { tests: DEFAULT_PHYSICAL_TEST_GUIDE, updatedBy: '', updatedAt: null };
}

export async function updatePhysicalTestGuide(tests: PhysicalTestGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'physicalTestGuide', 'config'), { tests, updatedBy, updatedAt: serverTimestamp() });
}
