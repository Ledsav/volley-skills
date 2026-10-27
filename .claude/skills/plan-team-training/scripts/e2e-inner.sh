#!/usr/bin/env bash
# End-to-end check of the plan-team-training scripts on a throwaway emulator (multi-club layout). Run through e2e.sh.
set -euo pipefail
S=.claude/skills/plan-team-training
W=.superpowers/plan-training-e2e/work
rm -rf "$W" && mkdir -p "$W"

node scripts/seed/seed.mjs --emulator --reset >/dev/null
node scripts/seed/seedLibrary.mjs >/dev/null
# Owner users doc (the seed signs nobody in).
node -e "
const a=require('firebase-admin'); a.initializeApp({projectId:JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).projects.default});
a.firestore().doc('users/e2e-owner').set({email:'coach@example.com'}).then(()=>process.exit(0));"
TEAM=$(node -e "
const a=require('firebase-admin'); a.initializeApp({projectId:JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).projects.default});
a.firestore().collection('clubs/demo/teams').limit(1).get().then(s=>{console.log(s.docs[0].data().name);process.exit(0)});")
PLAYERS=$(node -e "
const a=require('firebase-admin'); a.initializeApp({projectId:JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).projects.default});
a.firestore().collection('clubs/demo/teams').limit(1).get().then(async s=>{const p=await s.docs[0].ref.collection('players').limit(3).get();console.log(p.docs.map(d=>d.data().fullName).join('; ')+'; Olivia Sanchez');process.exit(0)});")

echo "== recon without --club (must refuse on the multi-club layout)"
OUT=$(node $S/scripts/recon.mjs --team "$TEAM" --emulator --out "$W" 2>&1 || true)
if echo "$OUT" | grep -q "multi-club layout"; then echo "refused OK"; else echo "FAIL: did not refuse"; exit 1; fi

echo "== recon"
node $S/scripts/recon.mjs --team "$TEAM" --players "$PLAYERS" --club demo --emulator --out "$W"

echo "== build a test proposal from the seeded library"
node -e "
const r=require('./$W/recon.json');
const lib=r.exercises.slice(0,3).map(e=>e.name);
const src=require('fs').readFileSync('$S/proposal.example.mjs','utf8')
  .replace(\"from './scripts/scene.mjs'\",\"from '../../../$S/scripts/scene.mjs'\")
  .replace(/team: 'U17'/,'team: '+JSON.stringify(r.team.name))
  .replace(/expectedPlayers: 9/,'expectedPlayers: 7')
  .replace(/name: 'Reception \+ free ball: control and convert'/,\"name: 'Reception + free ball: e2e check'\")
  .replace(/suggestedPlayers: 9/,'suggestedPlayers: 7')
  .replace(/steps: \[[\s\S]*?\],\r?\n};/,'steps: '+JSON.stringify([...lib.map(n=>({name:n,minutes:15})),{name:'Free ball: call, drop off and attack',minutes:15}])+',\n};');
require('fs').writeFileSync('$W/proposal.mjs',src);"

echo "== validate (expect OK, warnings allowed)"
npx vite-node $S/scripts/validate.ts "$W/proposal.mjs" --recon "$W/recon.json" --out "$W/preview.pdf" 2>&1 | grep -v "access policy"

echo "== validate catches a player-fit error"
sed 's/minPlayers: 4,/minPlayers: 8,/' "$W/proposal.mjs" > "$W/proposal-bad.mjs"
OUT=$(npx vite-node $S/scripts/validate.ts "$W/proposal-bad.mjs" --recon "$W/recon.json" 2>&1 || true)
if echo "$OUT" | grep -q "needs 8 players but the session must run with 4"; then echo "fit error caught OK"; else echo "FAIL: fit error not caught"; exit 1; fi

echo "== apply dry run"
node $S/scripts/apply.mjs "$W/proposal.mjs" --owner coach@example.com --club demo --emulator --calendar 2026-10-24
echo "== apply"
node $S/scripts/apply.mjs "$W/proposal.mjs" --owner coach@example.com --club demo --emulator --calendar 2026-10-24 --apply
echo "== apply again (must refuse duplicate)"
OUT=$(node $S/scripts/apply.mjs "$W/proposal.mjs" --owner coach@example.com --club demo --emulator 2>&1 || true)
if echo "$OUT" | grep -q "refusing to duplicate"; then echo "duplicate refused OK"; else echo "FAIL: duplicate not refused"; exit 1; fi

LOG=$(ls "$W"/applied-*.json | head -1)
echo "== rollback"
node $S/scripts/apply.mjs --rollback "$LOG" --emulator
node $S/scripts/apply.mjs --rollback "$LOG" --emulator --apply
node -e "
const a=require('firebase-admin'); a.initializeApp({projectId:JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).projects.default});
const db=a.firestore(); const log=require('./$LOG');
Promise.all([log.training.path, log.calendar, ...log.exercises.map(e=>e.path)].map(p=>db.doc(p).get())).then(s=>{
  const left=s.filter(d=>d.exists).length; console.log(left? 'FAIL: '+left+' docs left' : 'rollback removed everything OK'); process.exit(left?1:0);});"
echo "E2E PASSED"
