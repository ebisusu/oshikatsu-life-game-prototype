// バランス確認: 自動プレイヤーで多数シードを完走させ、公演ごとの勝率/目標達成率を表示する。
//   npm run balance            （既定 200 シード）
//   npm run balance -- 500
import { botPlayGame, randomOpts } from '../src/game/bot';
import { CONCERTS } from '../src/game/data/world';
import { finalSummary } from '../src/game/game';

const n = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 200;
const byType: Record<string, { w: number[]; t: number[]; games: number; score: number; money: number; totals: number[][]; cpu: number[][] }> = {};
for (let seed = 1; seed <= n; seed++) {
  const opts = randomOpts(seed * 7919);
  const s = botPlayGame(opts);
  const rec = (byType[opts.oshi] ??= { w: CONCERTS.map(() => 0), t: CONCERTS.map(() => 0), games: 0, score: 0, money: 0, totals: CONCERTS.map(() => []), cpu: CONCERTS.map(() => []) });
  rec.games++;
  rec.score += finalSummary(s).score;
  rec.money += s.money;
  CONCERTS.forEach((c, i) => {
    const r = s.concerts[c.id];
    if (r?.winner === 'player') (rec.w[i] as number)++;
    if (r?.targetReached) (rec.t[i] as number)++;
    if (r?.playerTotal !== undefined) (rec.totals[i] as number[]).push(r.playerTotal / 10);
    if (r?.cpuTotal !== undefined) (rec.cpu[i] as number[]).push(r.cpuTotal / 10);
  });
}
for (const [type, r] of Object.entries(byType)) {
  console.log(`\n[${type}] games=${r.games} avgScore=${(r.score / r.games).toFixed(0)} avgMoney=${(r.money / r.games).toFixed(0)}`);
  CONCERTS.forEach((c, i) => {
    const totals = r.totals[i] as number[];
    const avg = totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length);
    const cp = r.cpu[i] as number[];
    const cavg = cp.reduce((a, b) => a + b, 0) / Math.max(1, cp.length);
    console.log(
      `  ${c.id} target=${c.target} win=${(((r.w[i] as number) / r.games) * 100).toFixed(0)}% targetReached=${(((r.t[i] as number) / r.games) * 100).toFixed(0)}% avgPlayer=${avg.toFixed(1)} avgCpu=${cavg.toFixed(1)}`,
    );
  });
}
