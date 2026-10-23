#!/usr/bin/env bash
# Self-check for the plan-team-training scripts: seeds a throwaway Firestore emulator on side
# ports (so a running dev emulator is untouched), then runs recon, validate (incl. a deliberate
# player-fit error), apply dry run, apply, duplicate refusal and rollback. Prints "E2E PASSED".
#   bash .claude/skills/plan-team-training/scripts/e2e.sh
set -euo pipefail
CFG=firebase.plan-training-e2e.local.json
node -e '
const c=require("./firebase.json");
c.emulators={firestore:{port:8096},ui:{enabled:false},hub:{port:4406},logging:{port:4506}};
require("fs").writeFileSync(process.argv[1], JSON.stringify(c,null,2));' "$CFG"
trap 'rm -f "$CFG"' EXIT
npx firebase --config "$CFG" emulators:exec --only firestore "bash .claude/skills/plan-team-training/scripts/e2e-inner.sh"
