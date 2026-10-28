# Design

Everything about how Volley Skills looks and feels, in one place.

| Folder | What's in it |
|---|---|
| [`design-system/`](design-system/README.md) | **The UI rules (v2):** principles, colour and data colours, type, space, materials, motion, layout and navigation, patterns, accessibility. Also [`mockups/`](design-system/mockups/), HTML pages and screenshots in light and dark. |
| [`brand/`](brand/README.md) | **The identity:** the Spin mark, wordmark, lockups, colour, clear space, minimum sizes, misuse, and the web and app icons in [`logo/`](brand/logo/). The concept exploration is in [`exploration/`](brand/exploration/). |

Related documents elsewhere:

- [`../superpowers/specs/2026-10-28-ui-redesign-design.md`](../superpowers/specs/2026-10-28-ui-redesign-design.md):
  the redesign *project*. It covers agreed behaviour changes, bug fixes, exact pattern behaviour, per-screen design
  and delivery.
- [`../superpowers/specs/ui-redesign-inventory/`](../superpowers/specs/ui-redesign-inventory/README.md): the parity
  contract, meaning every feature and how it must keep behaving.
- [`../superpowers/specs/2026-09-04-volley-skills-design-system.md`](../superpowers/specs/2026-09-04-volley-skills-design-system.md)
  and [`../brand/README.md`](../brand/README.md): the **current** design system and logo, in force until
  `feature/ui-redesign` merges. Then they are retired.

To view the mockups locally, run `python -m http.server 5180 --directory docs/design` and open
`http://localhost:5180/design-system/mockups/volley-skills-v2.html`.
