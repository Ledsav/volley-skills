# Screenshots

Every page of the app, at desktop (1440 × 900) and phone (390 × 844) size, in the light theme.
All data is the fictional **Men 1** demo squad. The workbook-seeded team is removed first, because
its players are real minors.

## Regenerate

```bash
npm run dev:emulator                       # terminal 1: emulators + seed + Vite
node scripts/docs/seedShowcase.mjs         # drop the real-data team, fill Men 1 with plans, tests, calendar
node scripts/docs/captureScreenshots.mjs   # headless Chrome → docs/screenshots/{desktop,mobile}/
node scripts/docs/buildBrochure.mjs        # optional: rebuild docs/marketing/volley-skills-overview.pdf
```

`--only 04-home,13-player-skills` recaptures just those pages.

## Gallery

| Page | Desktop | Phone |
| --- | --- | --- |
| Sign in | <img src="desktop/01-login.png" width="420" /> | <img src="mobile/01-login.png" width="160" /> |
| Request access | <img src="desktop/02-request-access.png" width="420" /> | <img src="mobile/02-request-access.png" width="160" /> |
| Privacy policy | <img src="desktop/03-privacy.png" width="420" /> | <img src="mobile/03-privacy.png" width="160" /> |
| Home dashboard | <img src="desktop/04-home.png" width="420" /> | <img src="mobile/04-home.png" width="160" /> |
| Teams | <img src="desktop/05-teams.png" width="420" /> | <img src="mobile/05-teams.png" width="160" /> |
| Team · Roster | <img src="desktop/06-team-roster.png" width="420" /> | <img src="mobile/06-team-roster.png" width="160" /> |
| Team · Calendar | <img src="desktop/07-team-calendar.png" width="420" /> | <img src="mobile/07-team-calendar.png" width="160" /> |
| Team · Matches | <img src="desktop/08-team-matches.png" width="420" /> | <img src="mobile/08-team-matches.png" width="160" /> |
| Team · Stats | <img src="desktop/09-team-stats.png" width="420" /> | <img src="mobile/09-team-stats.png" width="160" /> |
| Team · Development plan | <img src="desktop/10-team-plan.png" width="420" /> | <img src="mobile/10-team-plan.png" width="160" /> |
| Team · Physical testing | <img src="desktop/11-team-physical.png" width="420" /> | <img src="mobile/11-team-physical.png" width="160" /> |
| Team · Settings | <img src="desktop/12-team-settings.png" width="420" /> | <img src="mobile/12-team-settings.png" width="160" /> |
| Player · Skills | <img src="desktop/13-player-skills.png" width="420" /> | <img src="mobile/13-player-skills.png" width="160" /> |
| Player · Matches | <img src="desktop/14-player-matches.png" width="420" /> | <img src="mobile/14-player-matches.png" width="160" /> |
| Player · Physical | <img src="desktop/15-player-physical.png" width="420" /> | <img src="mobile/15-player-physical.png" width="160" /> |
| Player · Plan | <img src="desktop/16-player-plan.png" width="420" /> | <img src="mobile/16-player-plan.png" width="160" /> |
| Match report | <img src="desktop/17-match-report.png" width="420" /> | <img src="mobile/17-match-report.png" width="160" /> |
| Live scouting | <img src="desktop/18-live-scouting.png" width="420" /> | <img src="mobile/18-live-scouting.png" width="160" /> |
| Season awards | <img src="desktop/19-season-awards.png" width="420" /> | <img src="mobile/19-season-awards.png" width="160" /> |
| Match awards | <img src="desktop/20-match-awards.png" width="420" /> | <img src="mobile/20-match-awards.png" width="160" /> |
| Exercises | <img src="desktop/21-exercises.png" width="420" /> | <img src="mobile/21-exercises.png" width="160" /> |
| Court diagram editor | <img src="desktop/22-diagram-editor.png" width="420" /> | <img src="mobile/22-diagram-editor.png" width="160" /> |
| Trainings | <img src="desktop/23-trainings.png" width="420" /> | <img src="mobile/23-trainings.png" width="160" /> |
| Training view | <img src="desktop/24-training-view.png" width="420" /> | <img src="mobile/24-training-view.png" width="160" /> |
| Guides | <img src="desktop/25-guides.png" width="420" /> | <img src="mobile/25-guides.png" width="160" /> |
| Access | <img src="desktop/26-access.png" width="420" /> | <img src="mobile/26-access.png" width="160" /> |
| Settings | <img src="desktop/27-settings.png" width="420" /> | <img src="mobile/27-settings.png" width="160" /> |
| Not found (404) | <img src="desktop/28-not-found.png" width="420" /> | <img src="mobile/28-not-found.png" width="160" /> |
