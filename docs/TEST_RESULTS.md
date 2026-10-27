# テスト結果（2026-10-28）

実行環境: Windows 10 / Node v24.14.1 / npm 11.11.0 / ブラウザ: Microsoft Edge（Playwright channel=msedge）

```
## npm ci
6 vulnerabilities (3 moderate, 1 high, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

## npm run build

vite v5.4.21 building for production...
transforming...
✓ 52 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.83 kB │ gzip:  0.62 kB
dist/assets/index-oBHaevfs.css   19.11 kB │ gzip:  5.01 kB
dist/assets/index-DJRyOv13.js   231.21 kB │ gzip: 81.41 kB
✓ built in 865ms

## npm test


 RUN  v2.1.9 C:/Users/user/Documents/OshikatsuClaudeImplementation

 ✓ tests/cards-deck.test.ts (18 tests) 25ms
 ✓ tests/save.test.ts (7 tests) 53ms
 ✓ tests/live.test.ts (27 tests) 264ms
 ✓ tests/game.test.ts (29 tests) 778ms

 Test Files  4 passed (4)
      Tests  81 passed (81)
   Start at  02:00:50
   Duration  1.39s (transform 381ms, setup 0ms, collect 703ms, tests 1.12s, environment 1ms, prepare 688ms)


## npm run test:e2e (Playwright, Edge channel, 390x844)

Running 3 tests using 1 worker

  ok 1 e2e\smoke.spec.ts:54:1 › スマホ幅で12週を完走できる (6.8s)
  ok 2 e2e\smoke.spec.ts:148:1 › 壊れたセーブデータでも新規開始できる (487ms)
  ok 3 e2e\smoke.spec.ts:158:1 › PC幅でも崩れず表示できる (556ms)

  3 passed (9.9s)

## npm run balance -- 300

[box] games=98 avgScore=2923 avgMoney=333714
  live1 target=42 win=74% targetReached=96% avgPlayer=54.6 avgCpu=46.8
  live2 target=52 win=46% targetReached=62% avgPlayer=55.9 avgCpu=55.6
  live3 target=58 win=39% targetReached=21% avgPlayer=52.2 avgCpu=56.4

[solo] games=99 avgScore=2914 avgMoney=340170
  live1 target=42 win=83% targetReached=99% avgPlayer=57.4 avgCpu=46.8
  live2 target=52 win=42% targetReached=59% avgPlayer=55.5 avgCpu=57.1
  live3 target=58 win=54% targetReached=40% avgPlayer=56.5 avgCpu=53.9

[combo] games=103 avgScore=2618 avgMoney=321060
  live1 target=42 win=60% targetReached=90% avgPlayer=51.6 avgCpu=48.2
  live2 target=52 win=31% targetReached=42% avgPlayer=49.6 avgCpu=58.2
  live3 target=58 win=27% targetReached=15% avgPlayer=48.1 avgCpu=57.1
```

- `npm audit --omit=dev`: 0 vulnerabilities（本番依存はreact/react-domのみ）。開発用依存（vitest/esbuild系）に既知の警告があるが、配布物（dist）には含まれない。
