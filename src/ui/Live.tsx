import { useEffect, useState } from 'react';
import {
  blockReason, CARD_MAP, CITY_MAP, CONCERTS, currentConcert, FIRST_HALF_EP, fmtTenths, HAND_LIMIT, liveCostFor,
  liveMoneyReward, LIVE_COST, METERS, METER_LABEL, playBlockReason, previewPlay, SONG_EP, SONG_TYPE_LABEL,
  sideTotalTenths, weightedTenths, yen, cpuMovesFirst, OSHI_MAP, KIND_LABEL,
  type GameState, type LiveMode, type LiveSide, type LiveState,
} from '../game';
import { ActionButton, Bar, CardTile, GainLine } from './common';
import type { Dispatch } from './useGame';

const MODE_DESC: Record<LiveMode, string> = {
  onsite: '会場へ移動して参加。獲得値×1.10・報酬×1.5・限定の収集品。',
  stream: '自宅から視聴参加。獲得値×1.0・報酬×1.0。',
  free: '公式の無料ダイジェスト配信。0AP・0円で参加でき、いつでも本編を進められる救済枠。獲得値×0.92・報酬×0.5。',
};

export function LiveScreen({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  if (s.live) return <Battle s={s} live={s.live} dispatch={dispatch} />;
  const concert = currentConcert(s);
  const pending = concert && s.concerts[concert.id]?.status === 'pending';
  return (
    <div className="screen">
      <section className="panel">
        <h2>ライブ</h2>
        <p className="muted small">全12週のうち第4・8・12週に公演があります。20枚のデッキでCPUと4曲を競う、ソロ＋CPU対戦です（対人対戦は今後追加予定・未実装）。</p>
      </section>

      {pending && concert && (
        <section className="panel glow" data-testid="live-join">
          <h2>🎤 {concert.name}（今週開催）</h2>
          <p>会場：{concert.venue}（{CITY_MAP[concert.city].name}）／目標スコア {concert.target}</p>
          <p className="muted small">{concert.blurb}</p>
          <div className="modes">
            {(['onsite', 'stream', 'free'] as const).map((m) => {
              const c = liveCostFor(s, m);
              const reason = blockReason(s, { type: 'startLive', mode: m });
              return (
                <div key={m} className="mode">
                  <h3>{LIVE_COST[m].label}</h3>
                  <p className="muted small">{MODE_DESC[m]}</p>
                  <p className="small">{c ? `${c.ap}AP・${yen(c.money)}・体力-${c.stamina}${m === 'onsite' && c.path.length > 1 ? `（経路：${c.path.map((id) => CITY_MAP[id].name).join('→')}）` : ''}` : '—'}</p>
                  <ActionButton label={`${LIVE_COST[m].label}で参加`} tone={m === 'free' ? 'plain' : 'pink'} testId={`join-${m}`} reason={reason}
                    onClick={() => dispatch({ type: 'startLive', mode: m })} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel">
        <h2>公演スケジュール</h2>
        <ul className="concerts">
          {CONCERTS.map((c) => {
            const r = s.concerts[c.id];
            return (
              <li key={c.id} className="concert">
                <div className="row between">
                  <b>第{c.week}週 {c.name}</b>
                  <span className={`chip ${r?.status === 'done' ? 'ok' : r?.status === 'missed' ? 'ng' : ''}`}>
                    {r?.status === 'done' ? (r.winner === 'player' ? '勝利' : r.winner === 'draw' ? '引き分け' : '敗北') : r?.status === 'missed' ? '不参加' : c.week === s.week ? '今週' : '未開催'}
                  </span>
                </div>
                <p className="muted small">{c.venue}（{CITY_MAP[c.city].name}）／ 目標 {c.target} ／ {c.cpu.name}（{OSHI_MAP[c.cpu.oshi].name}）</p>
                <p className="small">セットリスト：{c.setlist.map((x) => `${x.name}［${SONG_TYPE_LABEL[x.type]}］`).join(' → ')}</p>
                {r?.status === 'done' && <p className="small">結果：あなた {fmtTenths(r.playerTotal ?? 0)} vs CPU {fmtTenths(r.cpuTotal ?? 0)}／{r.targetReached ? '🎯目標達成' : '目標未達'}／報酬 {yen(r.moneyReward ?? 0)}</p>}
              </li>
            );
          })}
        </ul>
        <p className="muted small">💡 セットリストの曲タイプに合うカード（曲マッチ+25%）を多く入れると有利です。</p>
      </section>
    </div>
  );
}

// ---------- バトル画面 ----------
function Stage({ live }: { live: LiveState }) {
  const song = live.setlist[live.songIndex];
  return (
    <div className="stage" aria-hidden="true">
      <svg viewBox="0 0 360 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id="b1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4aa3ff" stopOpacity=".9" /><stop offset="1" stopColor="#4aa3ff" stopOpacity="0" /></linearGradient>
          <linearGradient id="b2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff5fb7" stopOpacity=".9" /><stop offset="1" stopColor="#ff5fb7" stopOpacity="0" /></linearGradient>
          <linearGradient id="b3" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a66bff" stopOpacity=".9" /><stop offset="1" stopColor="#a66bff" stopOpacity="0" /></linearGradient>
        </defs>
        <polygon className="beam beam1" points="60,0 90,0 150,120 0,120" fill="url(#b1)" />
        <polygon className="beam beam2" points="165,0 195,0 260,120 100,120" fill="url(#b2)" />
        <polygon className="beam beam3" points="270,0 300,0 360,120 210,120" fill="url(#b3)" />
        <rect x="0" y="104" width="360" height="16" fill="#120b33" />
        <g className="crowd">{Array.from({ length: 24 }).map((_, i) => (
          <circle key={i} cx={8 + i * 15} cy={112 + (i % 3)} r="3.2" fill={['#4aa3ff', '#ff5fb7', '#a66bff'][i % 3]} className={`pl pl${i % 4}`} />
        ))}</g>
      </svg>
      <div className="stage-text">
        <small>第{live.songIndex + 1}曲 / {live.setlist.length}</small>
        <b>♪ {song?.name}</b>
        <span className="chip">{SONG_TYPE_LABEL[song?.type ?? 'call']}</span>
      </div>
    </div>
  );
}

function ScoreRow({ label, side, live, you }: { label: string; side: LiveSide; live: LiveState; you?: boolean }) {
  const songNow = weightedTenths(side.song);
  return (
    <div className={`score-row${you ? ' you' : ''}`} data-testid={you ? 'score-player' : 'score-cpu'}>
      <div className="score-head">
        <b>{label}</b>
        <span className="total">合計 <em>{fmtTenths(sideTotalTenths(side))}</em></span>
        <span className="song-now">この曲 {fmtTenths(songNow)}</span>
        <span className="small muted">MVP {side.mvpWins}</span>
      </div>
      <div className="meters">
        {METERS.map((k) => (
          <div key={k} className={`meter m-${k}`}>
            <span>{METER_LABEL[k]} <b>{side.song[k]}</b></span>
            <Bar value={side.song[k]} max={Math.max(24, live.target / 2.2)} cls={`b-${k}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EpGauge({ live }: { live: LiveState }) {
  const p = live.player;
  const cap = live.phase === 'first' ? FIRST_HALF_EP : SONG_EP;
  return (
    <div className="ep" data-testid="ep-gauge">
      <div className="ep-pips" aria-hidden="true">
        {Array.from({ length: SONG_EP }).map((_, i) => (
          <span key={i} className={`pip${i < p.spent ? ' used' : ''}${i >= cap ? ' locked' : ''}${i === FIRST_HALF_EP ? ' split' : ''}`} />
        ))}
      </div>
      <div className="ep-text">
        <b>EP {SONG_EP - p.spent}/{SONG_EP}</b>
        <span>{live.phase === 'first' ? `前半：あと${Math.max(0, FIRST_HALF_EP - p.spent)}EPまで` : `後半：あと${SONG_EP - p.spent}EP使える`}</span>
      </div>
    </div>
  );
}

function Battle({ s, live, dispatch }: { s: GameState; live: LiveState; dispatch: Dispatch }) {
  const [sel, setSel] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  useEffect(() => { setSel(null); }, [live.songIndex, live.phase, live.stage]);

  if (live.stage === 'result' && live.result) return <LiveResultView s={s} live={live} dispatch={dispatch} />;

  const p = live.player;
  const selId = sel !== null ? p.hand[sel] : undefined;
  const selPv = selId ? previewPlay(live, 'player', selId) : null;
  const selReason = selId ? playBlockReason(live, 'player', selId) : null;
  const songPlays = p.history.filter((r) => r.songIndex === live.songIndex);
  const last = songPlays[songPlays.length - 1];
  const play = () => {
    if (sel === null) return;
    if (dispatch({ type: 'livePlay', handIndex: sel })) setSel(null);
  };

  return (
    <div className="screen battle" data-testid="battle">
      <Stage live={live} />
      <div className="phase-bar">
        <span className={`phase-pill ${live.phase}`} data-testid="phase-pill">{live.phase === 'first' ? '前半（上限2EP）' : '後半（残りEP）'}</span>
        <span className="small muted">{cpuMovesFirst(live.songIndex) ? 'この曲はCPU先攻' : 'この曲はあなた先攻'}／ 目標 {live.target}</span>
      </div>

      <div className="scoreboard">
        <ScoreRow label="あなた" side={live.player} live={live} you />
        <ScoreRow label="CPU" side={live.cpu} live={live} />
      </div>

      <div className="combo-state" data-testid="combo-state">
        <b>🔗 コンボ状況</b>
        <span>この曲の使用：{songPlays.length ? songPlays.map((r) => CARD_MAP[r.cardId]?.name).join(' → ') : 'まだなし'}</span>
        <span className="small muted">直前：{last ? `${CARD_MAP[last.cardId]?.name}（メンバー${last.member}・${KIND_LABEL[last.kind]}・${SONG_TYPE_LABEL[last.songType]}）` : 'なし'}／この公演のコンボ発動 {p.comboFired}回{p.songBuffPct ? `／曲バフ+${p.songBuffPct}%` : ''}{p.nextMult !== 1 ? `／次のカード×${p.nextMult}` : ''}</span>
      </div>

      <EpGauge live={live} />

      <div className="hand-head">
        <b>手札 {p.hand.length}/{HAND_LIMIT}</b>
        <span className="small muted">山札 {p.deck.length} ・ 捨て札 {p.discard.length}</span>
      </div>
      <p className="muted small">カードをタップで選択→下の「使う」。何も使わず「終える」だけでも進行できます（前半に余ったEPは後半へ）。</p>
      <div className="hand" data-testid="hand">
        {p.hand.length === 0 && <p className="muted">手札がありません。フェーズを終えて次へ進もう。</p>}
        {p.hand.map((id, i) => {
          const card = CARD_MAP[id]!;
          const reason = playBlockReason(live, 'player', id);
          const pv = previewPlay(live, 'player', id);
          return (
            <CardTile key={`${id}-${i}`} card={card} selected={sel === i} reason={reason} gains={pv.gains}
              comboText={pv.comboText} comboOk={pv.comboFired} testId={`hand-${i}`} onClick={() => setSel(sel === i ? null : i)} />
          );
        })}
      </div>

      <div className="play-bar">
        {selPv && selId && (
          <div className="sel-info" data-testid="sel-info">
            <span><b>「{CARD_MAP[selId]?.name}」</b> <GainLine g={selPv.gains} />（{fmtTenths(weightedTenths(selPv.gains))}点）</span>
            {selReason && <small className="ng-text">🚫 {selReason}</small>}
          </div>
        )}
        <div className="row gap">
          <button type="button" className="btn pink" onClick={play} disabled={sel === null || !!selReason} data-testid="play-card">
            {sel === null ? 'カードを選ぶ' : selReason ? '使えません' : 'このカードを使う'}
          </button>
          <button type="button" className="btn primary" onClick={() => dispatch({ type: 'liveEndPhase' })} data-testid="end-phase">
            {live.phase === 'first' ? '前半を終える' : live.songIndex === live.setlist.length - 1 ? '最終曲を締める' : '後半を終えて次の曲へ'}
          </button>
        </div>
      </div>

      <button type="button" className="btn ghost small" onClick={() => setLogOpen(!logOpen)} data-testid="toggle-log">{logOpen ? 'ログを閉じる' : 'ライブログを開く'}</button>
      <ul className={`livelog${logOpen ? ' open' : ''}`} data-testid="live-log">
        {[...live.log].slice(logOpen ? -60 : -6).reverse().map((e, i) => (
          <li key={i} className={`lg-${e.kind} who-${e.who}`}>{e.text}</li>
        ))}
      </ul>
    </div>
  );
}

function LiveResultView({ s, live, dispatch }: { s: GameState; live: LiveState; dispatch: Dispatch }) {
  const r = live.result!;
  const idx = CONCERTS.findIndex((c) => c.id === live.concertId);
  const money = liveMoneyReward(idx, r.winner, r.targetReached, live.mode);
  const mvpP = live.player.mvpWins;
  void s;
  return (
    <div className="screen" data-testid="live-result">
      <section className={`panel result ${r.winner}`}>
        <p className="eyebrow">{CONCERTS[idx]?.name} 終演</p>
        <h2 data-testid="live-verdict">{r.winner === 'player' ? '勝利！' : r.winner === 'draw' ? '引き分け' : '惜敗…'}</h2>
        <div className="vs">
          <div><small>あなた</small><b>{fmtTenths(r.playerTotal)}</b></div>
          <span>VS</span>
          <div><small>CPU</small><b>{fmtTenths(r.cpuTotal)}</b></div>
        </div>
        <p>{r.targetReached ? `🎯 目標スコア ${r.target} 達成！` : `目標スコア ${r.target} には届きませんでした。`}</p>
        <table className="songs">
          <thead><tr><th>曲</th><th>あなた</th><th>CPU</th><th>MVP</th></tr></thead>
          <tbody>
            {r.songResults.map((x, i) => (
              <tr key={i}><td>{x.song}</td><td>{fmtTenths(x.player)}</td><td>{fmtTenths(x.cpu)}</td><td>{x.mvp === 'player' ? 'あなた +2' : x.mvp === 'cpu' ? 'CPU +2' : '—'}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">あなたのMVP {mvpP}回／コンボ発動 {live.player.comboFired}回</p>
        <p>報酬：<b>{yen(money)}</b> ＋ カード三択（{r.winner === 'player' ? 'SR以上が出やすい' : 'R中心'}）</p>
        <button type="button" className="btn primary big" onClick={() => dispatch({ type: 'liveClaim' })} data-testid="claim-reward">報酬を受け取る</button>
      </section>
    </div>
  );
}

