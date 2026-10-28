#!/usr/bin/env node
// Seeds a demo exercise + training library into the LOCAL Firestore emulator,
// so the exercises / trainings / diagram screens have something to show.
//
//   npm run seed:library            # against a running emulator (127.0.0.1:8080)
//
// Emulator-only by design: this is example content, never club data. It
// replaces any previously seeded library docs (fixed ids prefixed `demo-`), and
// sets counters/trainings so the next training created in the app continues
// the TR-xxxx sequence.

import { createRequire } from 'node:module';

import { clubRoot, parseClubArg } from './clubArg.mjs';
import { searchTokens } from '../../src/search/searchTokens.js';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = 'volley-skills';
const CREATED_BY = 'seed-library';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const root = clubRoot(db, parseClubArg(process.argv.slice(2)));

// ── Scene helpers (court units: full court x∈[10,90], y∈[6,94], net at y=50;
//    half court y∈[6,72] with the net along the top) ──────────────────────────
let seq = 0;
const id = () => `s${(++seq).toString(36).padStart(6, '0')}`;
const base = (x, y, color = 'ink') => ({ id: id(), x, y, rotation: 0, size: 1, color });

const player = (x, y, label, color = 'blue', view = 'above') => ({
  ...base(x, y, color), type: 'player', label, shape: 'circle', view,
});
const ball = (x, y) => ({ ...base(x, y, 'orange'), type: 'ball', style: 'mikasa' });
const cone = (x, y, color = 'orange') => ({ ...base(x, y, color), type: 'cone' });
const arrow = (from, to, style = 'pass', color = 'ink', curved = false) => ({
  ...base((from.x + to.x) / 2, (from.y + to.y) / 2, color),
  type: 'arrow', from, to, curved, style, head: 'single',
});
const line = (points, color = 'ink', style = 'dashed') => ({
  ...base(points[0].x, points[0].y, color), type: 'line', points, style, thickness: 1,
});
const text = (x, y, content, color = 'ink') => ({ ...base(x, y, color), type: 'text', content, fontSize: 3.5 });
const ladder = (x, y, rotation = 0) => ({ ...base(x, y), rotation, type: 'ladder', rungs: 6, length: 24 });
const p = (x, y) => ({ x, y });

const scene = (court, items, showZones = false) => ({ v: 1, court, showZones, items });

// ── Exercises ────────────────────────────────────────────────────────────────
const EXERCISES = [
  {
    key: 'pepper',
    name: 'Pepper in pairs',
    category: 'warmup',
    description:
      'Pairs 4–5 m apart. Dig → set → attack (controlled down-ball) in a continuous rally.\n\n' +
      'Coaching points:\n• Platform angle towards partner\n• Call every contact\n• Keep the ball alive, not hard',
    diagrams: [
      {
        title: 'Setup',
        scene: scene('blank', [
          player(30, 35, 'A'), player(70, 35, 'B', 'orange'),
          player(30, 70, 'C'), player(70, 70, 'D', 'orange'),
          ball(38, 33),
          arrow(p(34, 33), p(66, 33), 'pass'), arrow(p(66, 38), p(34, 38), 'shot', 'red'),
          arrow(p(34, 68), p(66, 68), 'pass'), arrow(p(66, 73), p(34, 73), 'shot', 'red'),
          text(50, 15, 'Dig → Set → Hit'),
        ]),
      },
    ],
  },
  {
    key: 'footwork-ladder',
    name: 'Ladder footwork + approach',
    category: 'physical',
    description:
      'Two-feet-in ladder run, then a 3-step approach and block jump at the net.\n\n' +
      '3 rounds × 6 reps. Rest 30 s between rounds.',
    diagrams: [
      {
        title: 'Circuit',
        scene: scene('half', [
          ladder(30, 50, 90), cone(30, 64), cone(30, 34, 'green'),
          arrow(p(30, 62), p(30, 38), 'run', 'blue'),
          arrow(p(32, 32), p(50, 14), 'run', 'blue', true),
          player(50, 11, '1', 'navy', 'front'),
          text(70, 40, 'Approach + jump'),
        ]),
      },
    ],
  },
  {
    key: 'serve-targets',
    name: 'Serve to zones 1-6-5',
    category: 'service',
    description:
      'Server behind the end line serves to cones in zones 1, 6 and 5. Score 1 point per cone hit.\n\n' +
      'Progression: call the target before the toss.',
    diagrams: [
      {
        title: 'Targets',
        scene: scene('full', [
          player(80, 98, 'S', 'navy'), ball(80, 95),
          cone(82, 14, 'red'), cone(50, 14, 'red'), cone(18, 14, 'red'),
          arrow(p(80, 94), p(82, 16), 'shot', 'red', true),
          arrow(p(80, 94), p(50, 16), 'shot', 'red', true),
          arrow(p(80, 94), p(18, 16), 'shot', 'red', true),
        ], true),
      },
    ],
  },
  {
    key: 'reception-3',
    name: 'Three-player serve reception',
    category: 'reception',
    description:
      'Three passers in the W-reception receive from a coach serving across the net. ' +
      'Pass to the setter target at zone 2/3.\n\nRotate after 10 balls.',
    diagrams: [
      {
        title: 'Formation',
        scene: scene('full', [
          player(50, 3, 'C', 'navy'), ball(52, 6),
          player(25, 78, 'R1'), player(50, 82, 'R2'), player(75, 78, 'R3'),
          player(62, 54, 'S', 'green'),
          arrow(p(50, 8), p(50, 78), 'shot', 'red'),
          arrow(p(50, 80), p(61, 57), 'pass'),
        ]),
      },
      {
        title: 'Rotation',
        scene: scene('full', [
          player(25, 78, 'R1'), player(50, 82, 'R2'), player(75, 78, 'R3'),
          arrow(p(28, 79), p(47, 82), 'run', 'blue', true),
          arrow(p(53, 82), p(72, 79), 'run', 'blue', true),
          arrow(p(75, 75), p(25, 75), 'run', 'orange', true),
          text(50, 92, 'Rotate after 10 balls'),
        ]),
      },
    ],
  },
  {
    key: 'setter-footwork',
    name: 'Setter footwork to target',
    category: 'setting',
    description:
      'Setter starts at zone 1, releases on the coach\'s toss and sets to zone 4 then zone 2.\n\n' +
      'Focus: squared shoulders, hands high early, stable base.',
    diagrams: [
      {
        title: 'Release + set',
        scene: scene('half', [
          player(82, 60, 'S', 'green'), player(60, 40, 'C', 'navy'), ball(58, 37),
          arrow(p(82, 57), p(64, 14), 'run', 'green', true),
          player(18, 12, '4', 'orange'), player(82, 12, '2', 'orange'),
          arrow(p(62, 11), p(22, 11), 'pass', 'ink', true),
        ], true),
      },
    ],
  },
  {
    key: 'defense-triangle',
    name: 'Defensive triangle',
    category: 'defense',
    description:
      'Coach attacks from a box on the other side; three defenders read and dig to the setter.\n\n' +
      'Reset after every dig. Defenders call "mine" / "line" / "cross".',
    diagrams: [
      {
        title: 'Positions',
        scene: scene('full', [
          player(25, 42, 'C', 'navy'), ball(27, 45),
          player(18, 82, 'D5'), player(50, 86, 'D6'), player(82, 82, 'D1'),
          player(62, 54, 'S', 'green'),
          arrow(p(26, 46), p(20, 80), 'shot', 'red'),
          arrow(p(26, 46), p(48, 84), 'shot', 'red'),
          line([p(10, 64), p(90, 64)], 'ink', 'dashed'),
        ]),
      },
    ],
  },
  {
    key: 'attack-approach',
    name: 'Outside attack from zone 4',
    category: 'attack',
    description:
      'Line of hitters at zone 4. Setter sets a high ball; hitter does a 4-step approach and attacks line, then cross.\n\n' +
      'Collect balls and return to the line on the outside.',
    diagrams: [
      {
        title: 'Approach',
        scene: scene('half', [
          player(62, 10, 'S', 'green'), ball(58, 12),
          player(14, 40, 'H', 'orange', 'spike'), player(14, 50, 'H'), player(14, 58, 'H'),
          arrow(p(16, 37), p(20, 10), 'run', 'orange', true),
          arrow(p(56, 11), p(22, 8), 'pass', 'ink', true),
        ]),
      },
      {
        title: 'Targets',
        scene: scene('full', [
          player(20, 52, 'H', 'orange', 'spike'),
          cone(14, 14, 'red'), cone(80, 22, 'red'),
          arrow(p(20, 49), p(14, 16), 'shot', 'red'),
          arrow(p(20, 49), p(78, 24), 'shot', 'red'),
          text(50, 40, 'Line, then cross'),
        ]),
      },
    ],
  },
  {
    key: 'wash-drill',
    name: 'Wash drill 6 v 6',
    category: 'game',
    description:
      'Coach serves a free ball to side A; the rally is played out. A team must win two rallies in a row ("big point") to score.\n\n' +
      'First to 5 big points.',
    diagrams: [
      {
        title: 'Start',
        scene: scene('full', [
          player(18, 20, '4', 'orange'), player(50, 20, '3', 'orange'), player(82, 20, '2', 'orange'),
          player(18, 38, '5', 'orange'), player(50, 40, '6', 'orange'), player(82, 38, '1', 'orange'),
          player(18, 62, '4'), player(50, 60, '3'), player(82, 62, '2'),
          player(18, 82, '5'), player(50, 84, '6'), player(82, 82, '1'),
          player(96, 70, 'C', 'navy'), ball(94, 72),
          arrow(p(94, 70), p(52, 80), 'pass', 'ink', true),
        ]),
      },
    ],
  },
];

// ── Trainings (reference exercises by key) ───────────────────────────────────
const TRAININGS = [
  {
    name: 'Reception & serve focus',
    ageGroupTarget: 'U17',
    description: 'Ball-control session ahead of the weekend match. Keep transitions under 1 min.',
    exercises: [
      ['pepper', 10], ['serve-targets', 15], ['reception-3', 20], ['setter-footwork', 10], ['wash-drill', 25],
    ],
  },
  {
    name: 'Attack & defense',
    ageGroupTarget: 'U17',
    description: 'High-intensity day. Warm up properly before jumping.',
    exercises: [
      ['footwork-ladder', 10], ['pepper', 10], ['attack-approach', 20], ['defense-triangle', 20], ['wash-drill', 20],
    ],
  },
  {
    name: 'Short technical session',
    ageGroupTarget: 'U15',
    description: '',
    exercises: [['pepper', 10], ['setter-footwork', 15], ['serve-targets', 15]],
  },
];

async function main() {
  console.log(`Target: EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST} (project "${PROJECT_ID}")`);

  // Clear previous demo docs (diagram subcollections first).
  const old = await root.collection('exercises').where('createdBy', '==', CREATED_BY).get();
  for (const ex of old.docs) {
    const diags = await ex.ref.collection('diagrams').get();
    await Promise.all(diags.docs.map((d) => d.ref.delete()));
    await ex.ref.delete();
  }
  const oldTrainings = await root.collection('trainings').where('createdBy', '==', CREATED_BY).get();
  await Promise.all(oldTrainings.docs.map((d) => d.ref.delete()));

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  let diagramCount = 0;

  for (const ex of EXERCISES) {
    const ref = root.collection('exercises').doc(`demo-${ex.key}`);
    batch.set(ref, {
      name: ex.name,
      searchTokens: searchTokens(ex.name),
      description: ex.description,
      category: ex.category,
      createdBy: CREATED_BY,
      createdAt: now,
    });
    ex.diagrams.forEach((d, order) => {
      batch.set(ref.collection('diagrams').doc(), {
        title: d.title,
        order,
        scene: d.scene,
        updatedBy: CREATED_BY,
        updatedAt: now,
      });
      diagramCount += 1;
    });
  }

  TRAININGS.forEach((t, i) => {
    const exercises = t.exercises.map(([key, durationMinutes], idx) => ({
      exerciseId: `demo-${key}`,
      order: idx + 1,
      durationMinutes,
    }));
    const businessId = `TR-${String(i + 1).padStart(4, '0')}`;
    batch.set(root.collection('trainings').doc(`demo-training-${i + 1}`), {
      businessId,
      name: t.name,
      searchTokens: searchTokens(t.name, businessId),
      description: t.description,
      ageGroupTarget: t.ageGroupTarget,
      exercises,
      exerciseIds: exercises.map((e) => e.exerciseId),
      createdBy: CREATED_BY,
      createdAt: now,
    });
  });
  batch.set(root.collection('counters').doc('trainings'), { lastSequence: TRAININGS.length });

  await batch.commit();
  console.log(
    `Done. Wrote ${EXERCISES.length} exercises (${diagramCount} diagrams) and ${TRAININGS.length} trainings (TR-0001…TR-${String(TRAININGS.length).padStart(4, '0')}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
