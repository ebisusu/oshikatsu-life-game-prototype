# Independent Codex audit — Oshikatsu Life Game

Date: 2026-10-28 (Asia/Tokyo). Workspace: `C:\Users\user\Documents\OshikatsuClaudeImplementation`.

## Result and scope

The tested offline game loop works after the fixes below: setup, weekly actions, exploration/card choice, legal deck editing, actual CPU LIVE battles in weeks 4/8/12, rewards, progression, week-12 results, reload and reset. This is a playable simulation/card game, not a screen-only demo.

The original implementation was **not** accepted on its existing passing tests alone. Source was reviewed before implementation edits. The baseline build, 81 unit tests and 3 browser tests passed, but additional regressions reproduced the defects below. Existing unit tests were retained unchanged; coverage was added, and the existing browser smoke was extended. No cosmetic redesign or dependency upgrade was made.

Final functional checks pass: **105 unit tests and 20 browser tests**. This is not a blanket security or cross-browser certification: development dependencies still have npm advisories, and the platform/verification limits below remain.

Read: `IMPLEMENTATION_BRIEF.md`, `README.md`, audit brief, all `src/game` definitions/rules, React UI, styles, tests and scripts. The user-selected workspace takes precedence over the older brief's different folder name. No writes to other project directories, pushes, repository creation, public publishing or deployment were performed. This directory is not a Git repository (`git status --short` reports `fatal: not a git repository`), so historical claims about the earlier implementation's changes to other projects cannot be independently proven here.

## Reproduced defects and fixes

| Finding | Evidence before fix | Final change |
|---|---|---|
| Invalid structured saves could crash or strand play | Missing live `player.song`, null setlist entries, absent statistics, invalid modes/history/log/results and other malformed states returned `status: ok`. The browser regression with missing song meters failed to recover to setup. Sixteen malformed-save regressions initially failed. Prototype-named city/card IDs were also accepted. | `src/game/save.ts` now validates required nested fields, finite counters/meters/multipliers, real own-property IDs, all concert records and chronology, four-song progress/results, hand limit, card-zone conservation, and mutually exclusive pending/live/finished states. Invalid saves fall back to the setup notice. Valid saves are not discarded: 30 seeded full games serialize/reload after every accepted action and finish all three concerts. |
| An impossible UR combo | c40 cost 3 EP, but its 3-kind condition needs at least two earlier cards costing at least 2 EP. `c01 -> c05 -> c40` was rejected with `EP不足（残り2EP）`; the advertised effect could not fire within 4 EP. | c40 costs 2 EP. The same legal sequence now fires its combo at 4 EP. Its rarity, three-kind requirement and bonus remain intact. |
| All-in finisher undercounted consumed EP | c37 consumed 4 EP but rewarded only the 2 remaining after its printed cost: `{h:8,u:4,m:2}` instead of `{h:16,u:8,m:4}`. | `allIn` counts printed cost plus remaining EP, matching its description. Actual expenditure still consumes all remaining EP. |
| Echo missed the combo-type multiplier | c38 reported a successful combo but put its copied bonus in `extraBase`, bypassing the 2.2 combo multiplier. A controlled call-song preview produced heat 12 instead of 17. | The copied bonus uses `comboBonus`, so the documented passive applies consistently. |
| Stale saves across tabs | After a work action in one tab, another stayed at ¥60,000 while the stored/current game was ¥82,000. The old hook had no external-change check and could save from its stale state; a reset was also unknown to other open tabs. | Accepted actions save synchronously. Storage events refresh other tabs without writing them back, and a pre-action check rejects stale hand/deck input while loading the latest save. Browser checks now observe ¥82,000 then ¥104,000 across tabs, and propagate reset without resurrecting the old game. The synchronous state ref still prevents rapid React actions from losing updates. |
| Modal keyboard focus escaped the dialog | Opening the tutorial left active focus outside the modal; the new browser regression failed. The original modal had no focus containment. | Modal now has an accessible title, initial focus, forward/reverse Tab containment and focus restoration. Pointer interaction and mandatory card choices remain unchanged. |
| Incorrect score formula in Help | Built Help displayed `熱量×5＋一体感×3＋思い出×2`, while the engine stores tenths and displays one tenth of that value. The browser formula assertion failed. | Help now states `熱量×0.5＋一体感×0.3＋思い出×0.2`. The correct scoring implementation was preserved. |
| Prototype card ID bypassed deck legality | Replacing one card in a 20-card deck with `__proto__` still made `applyAction(...setDeck...)` return `ok: true`. A normal object used as a counter dropped that key, and inherited object properties were not real cards. | Card lookup and ID counters use prototype-free dictionaries. Regression tests reject both `__proto__` and `constructor` as cards. |

Implementation files changed: `src/game/data/cards.ts`, `src/game/deck.ts`, `src/game/effects.ts`, `src/game/save.ts`, `src/ui/useGame.ts`, `src/ui/App.tsx`, `src/ui/common.tsx`, `src/ui/Misc.tsx`. Also updated README test/balance figures, Playwright configuration, browser smoke, and added `tests/audit.test.ts` / `e2e/audit.spec.ts`. Generated `dist` and audit screenshots are local artifacts.

The preview configuration now owns its server (`reuseExistingServer: false`) and runs one worker, with explicit mobile and desktop projects. It no longer silently attaches to another process's preview. No test was removed or weakened to obtain a pass.

## Requirements verified

| Area | Findings and evidence |
|---|---|
| Forty distinct card effects | 40 cards: N12 / R14 / SR8 / SSR4 / UR2. There are 34 registry handlers with differing parameters where shared. The original signature/description uniqueness checks pass; an added behavioral check compares actual resolver outputs over 80 varied contexts per card, excluding descriptions/combo labels, and produces 40 distinct behavior profiles. The three broken card behaviors above were fixed rather than counting names alone. This is finite behavioral coverage, not exhaustive proof of every combination. |
| Deck legality | Exactly 20 owned copies; same name <=2; SR<=6, SSR<=2, UR<=1. All three CPU deck definitions are legal 20-card decks. Illegal drafts cannot save. Unknown/prototype IDs are rejected. Starter collections and auto adjustment are tested. |
| Real battle zones and EP | Seeded shuffle and initial hand 5, back-half +1 draw, new-song +2 draw, hand cap 7, discard reshuffle and recycling are implemented/tested. Zone totals remain 20. Each song has 4 net EP with first-half cap 2; refund effects reduce net spent EP. Finishers are second-half only; same-name SR+ can be played once per concert. History is separate from hand/deck/discard. |
| CPU legality and autonomy | CPU owns its deck, hand, discard, history and EP. It evaluates its own playable cards using the same legality/preview/application path; scores are derived from its plays. Songs 2/4 give it first action. No fixed-result substitute was found. |
| Scoring and rewards | Displayed song score is `0.5h + 0.3u + 0.2m`, stored as integer tenths (`5h+3u+2m`). Song winner receives MVP +2; c28 can add +1 more. Concert winner uses four song scores plus MVP points; concert targets determine target bonus. Card/song/passive/training/asset/mode/stamina modifiers apply before scoring. Currency and three card choices are real state updates. An added browser test explores, takes a reward, equips it, saves/reloads, and verifies that copy is in the next LIVE's card zones. |
| Resource safety/action limits | Existing rejection and seeded fuzz tests cover insufficient money/stamina/AP, unchanged input on refusal, maximum training and stamina, city/spot/asset rules and weekly limits. Rapid double-click work is tested in the browser: exactly two work actions, ¥104,000, AP0, then disabled. These checks apply to legitimate engine states; arbitrary localStorage tampering is not an anti-cheat security boundary. |
| Schedule/progression/end | Only weeks 4/8/12 offer the configured concerts. Zero-money/AP/stamina states can use free participation. Unclaimed rewards/live play block conflicting actions. Skipping a live marks it missed without trapping progression. Both viewports complete weeks 1–12 and all three actual battles via UI, claim rewards, reach final results/trophies and reset. Week-12 completion blocks further gameplay actions. |
| Wins and losses | The seeded 300-game run produces both outcomes for every type/concert. The fixed browser smoke also visibly wins week 4 and loses weeks 8/12. These are computed results. |
| Collection/world/trophies | 12 connected cities, 36 explicit exploration spots and 6 fictional assets. Exploration reward bias uses region/member/song type. Collection counts and saved deck counts are distinct. All 16 trophy predicates are implemented and feed final scoring; the five-dome concept remains locked and cannot be earned. |
| Saves/React consistency | Versioned envelopes, malformed JSON/version/shape fallback, storage exceptions, reset, exact LIVE/RNG reload equality and cross-tab updates are covered. Thirty seeded games additionally reload after every action. The hook uses current synchronous state for consecutive actions. Storage failures now show a save-failure toast while allowing in-memory play. |
| Mobile/desktop UI | Tested Edge at 390x844 (touch/mobile emulation) and 1280x800. All seven navigation screens checked for horizontal overflow; active battle states checked during the complete smoke. No overflow >1 px or unreachable enabled controls was detected. Enabled screen controls undergo Playwright trial clicks, and actual battle, deck, reward, tutorial and reset controls are exercised. Modal keyboard focus is tested. See the accessibility limits below. |
| Fictional provenance/online claims | Setup, Help and LIVE explicitly describe solo+CPU and unimplemented future online PvP. Placeholder members A–H, spots/venues/assets are fictional; cities are geographic travel locations. No real-idol images, logos, biography/origin claims or fake networking were found in reviewed source. |
| Injection/secrets | React text rendering is used for input/log text; no runtime `dangerouslySetInnerHTML`, `eval`, or game network submission was found. A stored `<img ... onerror=...>` payload renders as text without creating an image/executing. Invalid nested saves and prototype card IDs are covered above. Filename-only secret-pattern searches outside dependencies/generated screenshots found no matching embedded private keys/common credential patterns. This is a scoped source review, not an exhaustive secret-history scan. |
| Static hosting | `base: './'` is unchanged. Final `dist/index.html` references `./assets/...`. A plain Node static file server with no SPA rewrite serves the built artifact under `/oshikatsu-life/`; both viewports start, battle, reload mid-LIVE, claim rewards and reload at week5 without missing assets or browser errors. This verifies GitHub Pages-style subdirectory hosting locally; nothing was uploaded to GitHub Pages. |

## Commands and actual results

Environment: Windows, PowerShell, Node `v24.14.1`, npm `11.11.0`, Vite `5.4.21`, Vitest `2.1.9`, Playwright using installed Microsoft Edge. Existing `node_modules` and lockfile were used; no install or package version change was performed.

| Command | Actual result |
|---|---|
| `npm run build` | PASS, exit0. TypeScript and Vite build succeeded. Final assets: JS `index-DDjAvZh_.js` 236.01 kB (83.19 kB gzip); CSS 19.11 kB (5.01 kB gzip). |
| `npm test` | PASS, exit0: 5 files, **105/105 tests**, including all original 81 unchanged unit tests. |
| `npm run test:e2e` | PASS, exit0: **20/20 tests**, 10 in each viewport project, including the complete 12-week/three-LIVE UI smoke in each. Zero skipped/unexpected tests. Machine report: `test-results/e2e-results.json`. |
| `npm run balance -- 300` | PASS, exit0; 300 seeded games processed. Results below. |
| `npm audit --omit=dev --json` | PASS, exit0: production dependency advisories **0**. |
| `npm audit --json` | Exit1: **6 development dependency findings — critical2, high1, moderate3**. Unresolved; details below. This security audit command did not pass. |

Baseline and intermediate failures were not hidden:

- First sandboxed `npm test` could not start: esbuild reported `Cannot read directory "../..": Access is denied.` and `Could not resolve "C:\\Users\\user\\Documents\\OshikatsuClaudeImplementation\\vite.config.ts"`. Authorized execution outside the read-only sandbox then passed the original 81 tests. Build/test outputs require local writes; this was an environment restriction, not evidence of a source failure.
- Before implementation fixes, `npm test -- tests/audit.test.ts` produced **19 failures / 1 pass**, reproducing three card defects and sixteen malformed-save cases. The three initial added browser regressions also failed before their fixes.
- The Help formula assertion and `__proto__` deck regression were separately run and failed before their fixes.
- During audit-harness development, one reused preview process stopped and caused `page.reload: net::ERR_CONNECTION_REFUSED`; ownership of the local preview was corrected. An audit screenshot extension initially had `ReferenceError: info is not defined`; its test fixture parameter was corrected. Final complete runs pass. These were not game-rule fixes and no assertions were removed to conceal them.

Post-fix seeded balance (rounded win percentages; numerical balance remains provisional):

| Type | Games | Week4 win | Week8 win | Week12 win | Average final funds |
|---|---:|---:|---:|---:|---:|
| Box | 98 | 74% | 57% | 24% | ¥335,929 |
| Solo | 99 | 84% | 48% | 34% | ¥339,362 |
| Combo | 103 | 63% | 32% | 16% | ¥319,614 |

## Screenshots inspected

The browser suite generated 18 fresh `docs/screenshots/codex-*.png` files. Representative actual images were opened and visually reviewed, including mobile battle/stage, selected hand, deck and final results, and desktop battle, map and selected hand. Text wraps within panels; battle actions remain visible above bottom navigation. The full-page final-result capture includes a fixed-nav capture artifact; actual controls remain reachable by scrolling/clicks.

- [Mobile battle](docs/screenshots/codex-mobile-week4-battle.png)
- [Mobile selected card/action controls](docs/screenshots/codex-mobile-week4-hand.png)
- [Mobile deck](docs/screenshots/codex-mobile-deck.png)
- [Mobile final result](docs/screenshots/codex-mobile-final.png)
- [Desktop battle](docs/screenshots/codex-desktop-week4-battle.png)
- [Desktop selected hand](docs/screenshots/codex-desktop-week12-hand.png)
- [Desktop map](docs/screenshots/codex-desktop-map.png)

## Remaining limitations and security findings

1. **Development toolchain advisories remain unresolved.** npm reports critical findings on `tinypool` and `vitest`, high on `vite`, and moderate on `@vitest/mocker`, `esbuild`, and `vite-node`. Reported examples: [Vitest UI arbitrary file execution](https://github.com/advisories/GHSA-5xrq-8626-4rwp), [Tinypool prototype gadget](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), [Vite/launch-editor Windows command handling](https://github.com/advisories/GHSA-587h-7wmj-h5pm). These findings concern development tooling; those packages are not runtime dependencies of the static game. Exploits were not reproduced in this audit. npm proposes major Vite/Vitest upgrades; those upgrades were not silently introduced as part of reproduced game-bug fixes. A separate dependency update and compatibility/security verification is still needed. Do not interpret the clean production dependency result as a clean full toolchain audit.
2. Real iPhone/iOS Safari, Android hardware and other browser engines were not tested. Tests use installed Edge, mobile emulation and desktop viewport changes. Screen-reader/VoiceOver/NVDA auditing and a complete WCAG/contrast assessment were not performed; the keyboard/clickability checks above are narrower than certification of all assistive technologies.
3. The game remains a provisional 12-week offline prototype. Funds are generous and the combo bot is weaker, especially at the final concert. No speculative balance redesign was done. Map geography is schematic; spots/venues/assets are fictional; online play, payments, audio and long-term dome mode remain absent as documented.
4. localStorage is client-controlled and has no cryptographic authenticity, server authority or multi-device synchronization. Structural validation and stale-tab checks prevent the reproduced crashes/overwrites; they are not an anti-cheat system or a transactional multiplayer store. Storage-denied/quota behavior is handled, but persistence cannot be guaranteed when the browser refuses storage.
5. GitHub Pages compatibility was tested using the production artifact on a plain local static server under a subpath. Actual GitHub account/repository settings, workflow deployment and public-site behavior were intentionally not exercised because publication was prohibited. Historical changes outside this non-Git workspace cannot be attested.
