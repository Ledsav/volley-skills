# Operator security checklist

The operator holds administrative access to production, and so can technically read every
club's data. GDPR allows that for a processor, if the access is limited, purposeful,
protected and written down (Art. 28(3)(b), Art. 32). This list is how. The DPA's
security annex (legal design D4) describes these same controls, so keep both in step.

Design: `docs/superpowers/specs/2026-10-22-volley-skills-backup-and-operator-access-design.md` §5.

| # | Control | How | Status |
|---|---|---|---|
| 1 | 2-step verification or a passkey on the Google account that owns the Firebase project | myaccount.google.com, then Security | ☐ |
| 2 | Only the operator is Owner | Google Cloud console, IAM & Admin, then IAM: remove anyone else | ☐ |
| 3 | The deploy account cannot read data | IAM: the account behind the GitHub secret `FIREBASE_SERVICE_ACCOUNT_VOLLEY_SKILLS` needs only the roles to deploy hosting, rules and indexes (for example Firebase Hosting Admin, Firebase Rules Admin, Cloud Datastore Index Admin). It must not hold Owner, Editor, Firebase Admin, or Cloud Datastore User/Owner, all of which can read data. Change the roles, then confirm the next deploy still passes. | ☐ |
| 4 | Service-account key encrypted and rotated | `scripts/ops/README.md`, first-time setup steps 1 and 2 | ☐ |
| 5 | Data access audit logs on | Google Cloud console, IAM & Admin, Audit Logs, Cloud Datastore API: tick Data Read and Data Write. They record who read or wrote what, the operator included, and are kept 30 days in the `_Default` bucket. If the console asks for billing, write down here that it is not available on Spark. The entries hold document paths, and member ids are emails, so the logs are personal data kept 30 days: name them in the privacy notice once on. The DPA mentions audit logs only after this row is ticked. | ☐ |
| 6 | Laptop disk encrypted | BitLocker on (Settings, Privacy & security, Device encryption) | ☐ |
| 7 | External backup drive encrypted | BitLocker To Go on the drive | ☐ |
| 8 | Weekly encrypted backup, check and prune | `scripts/ops/README.md`: backup, `--check`, copy to the external drive, `backup:prune` there | ☐ |
| 9 | No plain copies of production on disk | Scripts log counts only. Do not keep app exports of a club's data longer than needed. `npm run seed:export-prod-players` writes `reference/prod-players.json` in plain text: avoid it now that a backup can be restored into the emulator, and delete the file after use if you run it. | ☐ |

## Operator access policy (goes into the DPA)

- The operator reads a club's data only:
  - to run the service, as automated processing;
  - on the club's documented request, such as a support case or a restore;
  - when the law requires it.
- The operator notes each such access in the club's status log, with the date, the
  reason and who asked. The audit logs (row 5), once on, record it too.
- Backups are opened only to check that they open, or to restore. A restore of
  production data into the emulator is stopped as soon as the work is done.

## Gaps to close later

- **Support access inside the app** (club platform spec §1): a consented, time-limited
  grant. Until it exists, support means the club shares its screen.
- **Plain copies of player data in the repo's `reference/` folder** (the original
  spreadsheet, used for seeding the emulator). It belongs to the operator's home club.
  Replace it with synthetic data before any outside developer touches the repo.
