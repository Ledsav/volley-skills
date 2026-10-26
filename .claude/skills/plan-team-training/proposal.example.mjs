// Worked example (the real TR-0012, U17, 2026-10-20). Copy to
// .superpowers/plan-training/<date>/proposal.mjs and adapt. validate.ts and apply.mjs read
// exactly these three exports. Steps name library exercises (exact name) or newExercises.
import { arrow, ball, player, scene, text } from './scripts/scene.mjs';

const t = (s) => s.trim().replace(/^ +/gm, '');

export const plan = {
  team: 'U17',
  expectedPlayers: 9, // the players the coach listed (unknown ones included)
  playerSlack: 3, // "+-3": every step must run with expectedPlayers - playerSlack
  slotMinutes: 90, // the booked slot; work time stays below it to leave setup time
};

export const newExercises = [
  {
    name: 'Free ball: call, drop off and attack',
    category: 'reception',
    minPlayers: 4,
    description: t(`
      Purpose: Teach the team to recognise a free ball, call it, move from base to free-ball positions, and turn it into a 3-contact attack.
      Setup: One side: setter at right front, 1–2 front-row players (positions 4 and 3), 2–3 back-row receivers. The coach on the other side with a ball cart. Extra players collect balls and rotate in.
      How it runs: Players start in base positions. The coach sends an easy, high ball over. Everyone shouts "Free!": the front row drops off the net to the attack approach start, the setter releases to target, the back row spreads into a 3-person line. A back-row player passes (overhead if possible) to the setter, the setter sets the outside hitter, who attacks into the open court. Rotate positions every 5 balls.
      Coaching points:
      - Shout "Free!" the moment the other side can't attack.
      - Front row: drop off the net fast and face the ball, ready to approach.
      - Pass high to target — the setter needs time, not speed.
      Easier: Front-row players start at the 3 m line; the hitter catches the set.
      Harder: The coach mixes free balls, down balls and real attacks.
    `),
    diagrams: [
      {
        title: 'Free! Positions and play',
        scene: scene([
          player('c', 50, 20, 'C', 'red'),
          ball('ball', 50, 25),
          player('s', 62, 54, 'S', 'green'),
          player('h4', 18, 54, '4'),
          player('h3', 40, 54, '3'),
          player('r1', 22, 82, 'R'),
          player('r2', 50, 86, 'R'),
          player('r3', 78, 82, 'R'),
          arrow('drop4', { x: 18, y: 58 }, { x: 17, y: 66 }, 'run'),
          arrow('drop3', { x: 40, y: 58 }, { x: 40, y: 66 }, 'run'),
          arrow('free', { x: 50, y: 26 }, { x: 50, y: 82 }, 'pass', { color: 'orange', curved: true }),
          arrow('pass', { x: 52, y: 83 }, { x: 62, y: 58 }, 'pass', { color: 'blue', curved: true }),
          arrow('set', { x: 60, y: 58 }, { x: 20, y: 66 }, 'pass', { color: 'green', curved: true }),
          arrow('hit', { x: 17, y: 64 }, { x: 28, y: 30 }, 'shot'),
          text('call', 74, 70, 'FREE!', 'red'),
        ]),
      },
    ],
  },
];

export const training = {
  name: 'Reception + free ball: control and convert',
  ageGroupTarget: 'U17',
  suggestedPlayers: 9,
  targets: ['reception'],
  description: t(`
    Purpose: Improve serve reception and the team's handling of free balls: recognise and call the free ball, pass it high to target with the hands when possible, and convert it into a 3-contact attack.
    Session flow (about 80 min of work in a 90-min slot, leaving time for setup and water):
    1. Warm-up: full-body mobility — 10 min
    2. Warm-up: get the color reaction race — 5 min
    3. Reception: toss and pass in pairs — 10 min
    4. Free ball: overhead pass to target in pairs — 10 min
    5. Reception: serve-receive passing line — 12 min
    6. Free ball: call, drop off and attack — 15 min
    7. Game: free-ball wash — 18 min
    Levels: Designed for a mixed group (about 2 advanced, 4 developing, 3 beginner players). Advanced players use the "Harder" options and serve for the others in #5; beginners use the "Easier" options. Put a stronger passer next to a beginner in the reception line.
    Group size: Built for 9 (works from 6 to 12). With 6, play #7 3v3 and use one reception line. With 12, run two lines in #5 and #6 and play #7 6v6.
    What success looks like: Every free ball is called out loud; most go to target with a high overhead pass; the team converts them into an attack.
  `),
  steps: [
    { name: 'Warm-up: full-body mobility', minutes: 10 },
    { name: 'Warm-up: get the color reaction race', minutes: 5 },
    { name: 'Reception: toss and pass in pairs', minutes: 10 },
    { name: 'Free ball: overhead pass to target in pairs', minutes: 10 },
    { name: 'Reception: serve-receive passing line', minutes: 12 },
    { name: 'Free ball: call, drop off and attack', minutes: 15 },
    { name: 'Game: free-ball wash', minutes: 18 },
  ],
};
