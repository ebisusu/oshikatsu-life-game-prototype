import { CONCERTS, finalSummary, OSHI_MAP, TROPHIES, type GameState } from '../game';

/** プレイテスト感想用のテキスト。クリップボードにコピーするだけで外部送信はしない。 */
export function buildFeedback(s: GameState): string {
  const f = finalSummary(s);
  const lives = CONCERTS.map((c) => {
    const r = s.concerts[c.id];
    return `  第${c.week}週 ${c.name}: ${r?.status === 'done' ? `${r.winner} (${((r.playerTotal ?? 0) / 10).toFixed(1)} vs ${((r.cpuTotal ?? 0) / 10).toFixed(1)})` : r?.status ?? '-'}`;
  }).join('\n');
  return [
    '【推し活人生ゲーム 試作版 プレイメモ】',
    `推しタイプ: ${OSHI_MAP[s.oshi].name}${s.oshiMember ? ` / メンバー${s.oshiMember}` : ''} / 開始都市: ${s.startCity} / シード: ${s.seed}`,
    `進行: 第${s.week}週${s.finished ? '（完走）' : ''} / 資金 ${s.money} / 体力 ${s.stamina}`,
    `ライブ:\n${lives}`,
    `カード種類: ${Object.values(s.collection).filter((n) => n > 0).length}/40 / 探索スポット: ${s.visitedSpots.length} / 訪問都市: ${s.visitedCities.length}/12`,
    `トロフィー: ${s.trophies.map((id) => TROPHIES.find((t) => t.id === id)?.name).join(', ') || 'なし'}`,
    `スコア: ${f.score} (${f.rank})`,
    '',
    '■ 面白かった点:',
    '■ 分かりにくかった点:',
    '■ バランス（難しすぎ/簡単すぎ）:',
    '■ 不具合:',
  ].join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
