import { useEffect, useRef, useState } from 'react';
import {
  blockReason, CARD_MAP, CITY_MAP, CONCERTS, currentConcert, FIRST_HALF_EP, fmtTenths, HAND_LIMIT, liveCostFor,
  liveMoneyReward, LIVE_COST, METERS, METER_LABEL, playBlockReason, previewPlay, SONG_EP, SONG_TYPE_LABEL,
  sideTotalTenths, weightedTenths, yen, cpuMovesFirst, OSHI_MAP, KIND_LABEL,
  type Action, type GameState, type LiveMode, type LiveSide, type LiveState,
} from '../game';
import { ActionButton, Bar, CardTile, GainLine } from './common';
import { Icon } from './icons';
import { MEMBER_COLOR } from './palette';
import { liveFxFor, type LiveFx } from './liveFx';
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
          <h2><Icon name="mic" /> {concert.name}（今週開催）</h2>
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
                {r?.status === 'done' && <p className="small">結果：あなた {fmtTenths(r.playerTotal ?? 0)} vs CPU {fmtTenths(r.cpuTotal ?? 0)}／{r.targetReached ? '目標達成' : '目標未達'}／報酬 {yen(r.moneyReward ?? 0)}</p>}
              </li>
            );
          })}
        </ul>
        <p className="muted small"><Icon name="sparkle" /> セットリストの曲タイプに合うカード（曲マッチ+25%）を多く入れると有利です。</p>
      </section>
    </div>
  );
}

// ---------- バトル画面 ----------
const LIGHTS = [26, 74, 122, 170, 218, 266, 314];
const PENLIGHTS = Array.from({ length: 36 }, (_, i) => ({ x: 6 + i * 9.8 + (i % 2) * 3, row: i % 2, c: ['#4aa3ff', '#ff5fb7', '#a66bff', '#ffd36b'][i % 4]!, d: (i % 9) * 0.18 }));

function Stage({ live, lead }: { live: LiveState; lead: 'you' | 'cpu' | 'tie' }) {
  const song = live.setlist[live.songIndex];
  const youColor = live.player.oshiMember ? MEMBER_COLOR[live.player.oshiMember] : '#4aa3ff';
  return (
    <div className={`stage lead-${lead}`} data-testid="stage">
      <div className="stage-art">
      <svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="st-bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0a0622" /><stop offset="1" stopColor="#2a1670" /></linearGradient>
          <linearGradient id="st-b1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4aa3ff" stopOpacity=".9" /><stop offset="1" stopColor="#4aa3ff" stopOpacity="0" /></linearGradient>
          <linearGradient id="st-b2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff5fb7" stopOpacity=".9" /><stop offset="1" stopColor="#ff5fb7" stopOpacity="0" /></linearGradient>
          <linearGradient id="st-b3" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a66bff" stopOpacity=".9" /><stop offset="1" stopColor="#a66bff" stopOpacity="0" /></linearGradient>
        </defs>
        <rect width="360" height="150" fill="url(#st-bg)" />
        <g className="beams">
          <polygon className="beam beam1" points="40,8 62,8 150,118 20,118" fill="url(#st-b1)" />
          <polygon className="beam beam2" points="150,8 172,8 250,118 100,118" fill="url(#st-b2)" />
          <polygon className="beam beam3" points="256,8 278,8 350,118 196,118" fill="url(#st-b3)" />
        </g>
        <rect x="8" y="4" width="344" height="6" rx="3" fill="#1a1050" stroke="#6a60a8" strokeWidth=".8" />
        {LIGHTS.map((x, i) => <circle key={x} className="lamp" cx={x} cy="7" r="3.2" fill={['#4aa3ff', '#ff5fb7', '#a66bff'][i % 3]} style={{ animationDelay: `${i * 0.2}s` }} />)}
        <rect x="122" y="22" width="116" height="40" rx="5" fill="#07041a" stroke="#4aa3ff" strokeOpacity=".7" />
        <rect x="126" y="26" width="108" height="32" rx="3" fill="#150d3d" className="led" />
        <g className="eq" fill="#4aa3ff">{Array.from({ length: 12 }, (_, i) => <rect key={i} className="eq-bar" x={131 + i * 8.6} y="30" width="5" height="24" rx="1.5" style={{ animationDelay: `${(i % 5) * 0.13}s` }} />)}</g>
        <path d="M0 108h360v14H0z" fill="#1a1050" />
        <path d="M0 108h360" stroke="#ff5fb7" strokeOpacity=".7" strokeWidth="1.2" />
        {([[70, youColor], [104, youColor], [256, '#ff5fb7'], [290, '#ff8ad8']] as const).map(([x, c], i) => (
          <g key={i} className={`dancer d${i}`} transform={`translate(${x} 0)`}>
            <circle cx="0" cy="82" r="5" fill="#0a0622" stroke={c} strokeWidth="1.6" />
            <path d="M-7 108 L-5 90 Q0 86 5 90 L7 108Z" fill="#0a0622" stroke={c} strokeWidth="1.6" />
          </g>
        ))}
        <rect y="124" width="360" height="26" fill="#0d0830" />
        {PENLIGHTS.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.row ? 140 : 131})`}>
            <g className="penlight" style={{ animationDelay: `${p.d}s` }}>
              <rect x="-1.2" y="-12" width="2.4" height="12" rx="1.2" fill={p.c} />
              <rect x="-2.6" y="-14" width="5.2" height="5" rx="2" fill={p.c} opacity=".5" />
            </g>
            <circle cy="3" r="4.2" fill="#07041a" />
          </g>
        ))}
      </svg>
      <div className="stage-vs" aria-hidden="true">
        <span className="you"><small>あなた</small><b>{fmtTenths(weightedTenths(live.player.song))}</b></span>
        <span className="vs-badge">VS</span>
        <span className="cpu"><small>CPU</small><b>{fmtTenths(weightedTenths(live.cpu.song))}</b></span>
      </div>
      </div>
      <div className="stage-text">
        <small>第{live.songIndex + 1}曲 / {live.setlist.length}</small>
        <b>♪ {song?.name}</b>
        <span className="chip">{SONG_TYPE_LABEL[song?.type ?? 'call']}</span>
      </div>
    </div>
  );
}

function SongTrack({ live }: { live: LiveState }) {
  return (
    <ol className="songtrack" aria-label="セットリスト進行">
      {live.setlist.map((x, i) => (
        <li key={x.id} className={i < live.songIndex ? 'done' : i === live.songIndex ? 'now' : ''} aria-current={i === live.songIndex ? 'step' : undefined}>
          <Icon name={i < live.songIndex ? 'check' : 'note'} /><span>{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}

function ScoreRow({ label, side, live, you }: { label: string; side: LiveSide; live: LiveState; you?: boolean }) {
  const songNow = weightedTenths(side.song);
  const foe = you ? live.cpu : live.player;
  const leading = songNow > weightedTenths(foe.song);
  return (
    <div className={`score-row${you ? ' you' : ' foe'}${leading ? ' leading' : ''}`} data-testid={you ? 'score-player' : 'score-cpu'}>
      <div className="score-head">
        <b>{leading && <Icon name="star" className="crown" />}{label}</b>
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
  const [fx, setFx] = useState<{ id: number; data: LiveFx } | null>(null);
  const armed = useRef<LiveState | null>(null);
  const fxTimer = useRef<number | undefined>(undefined);
  useEffect(() => { setSel(null); }, [live.songIndex, live.phase, live.stage]);
  useEffect(() => () => window.clearTimeout(fxTimer.current), []);
  // 演出は「このタブでの操作が成功した直後」だけ、操作前後の実状態の差分から作る（リロード・別タブ同期・失敗では出ない）
  useEffect(() => {
    const before = armed.current;
    if (!before || before === live) return;
    armed.current = null;
    const data = liveFxFor(before, live);
    if (!data) return;
    setFx({ id: Date.now(), data });
    window.clearTimeout(fxTimer.current);
    fxTimer.current = window.setTimeout(() => setFx(null), 2800);
  }, [live]);
  const act = (a: Action): boolean => {
    const before = live;
    const ok = dispatch(a);
    if (ok) armed.current = before;
    return ok;
  };

  if (live.stage === 'result' && live.result) return <LiveResultView s={s} live={live} dispatch={dispatch} />;

  const p = live.player;
  const selId = sel !== null ? p.hand[sel] : undefined;
  const selPv = selId ? previewPlay(live, 'player', selId) : null;
  const selReason = selId ? playBlockReason(live, 'player', selId) : null;
  const youNow = weightedTenths(p.song);
  const cpuNow = weightedTenths(live.cpu.song);
  const lead: 'you' | 'cpu' | 'tie' = youNow > cpuNow ? 'you' : cpuNow > youNow ? 'cpu' : 'tie';
  const songPlays = p.history.filter((r) => r.songIndex === live.songIndex);
  const last = songPlays[songPlays.length - 1];
  const play = () => {
    if (sel === null) return;
    if (act({ type: 'livePlay', handIndex: sel })) setSel(null);
  };

  return (
    <div className="screen battle" data-testid="battle">
      <LiveFxView fx={fx} />
      <Stage live={live} lead={lead} />
      <SongTrack live={live} />
      <div className="phase-bar">
        <span className={`phase-pill ${live.phase}`} data-testid="phase-pill">{live.phase === 'first' ? '前半（上限2EP）' : '後半（残りEP）'}</span>
        <span className="small muted">{cpuMovesFirst(live.songIndex) ? 'この曲はCPU先攻' : 'この曲はあなた先攻'}／ 目標 {live.target}</span>
      </div>

      <div className="scoreboard">
        <ScoreRow label="あなた" side={live.player} live={live} you />
        <ScoreRow label="CPU" side={live.cpu} live={live} />
      </div>

      <div className="combo-state" data-testid="combo-state">
        <b><Icon name="link" /> コンボ状況</b>
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
            <CardTile key={`${id}-${i}`} card={card} selected={sel === i} reason={reason} gains={pv.gains} ready={!reason}
              comboText={pv.comboText} comboOk={pv.comboFired} testId={`hand-${i}`} onClick={() => setSel(sel === i ? null : i)} />
          );
        })}
      </div>

      <div className="play-bar">
        {selPv && selId && (
          <div className="sel-info" data-testid="sel-info">
            <span><b>「{CARD_MAP[selId]?.name}」</b> <GainLine g={selPv.gains} />（{fmtTenths(weightedTenths(selPv.gains))}点）</span>
            {selReason && <small className="ng-text"><Icon name="lock" /> {selReason}</small>}
          </div>
        )}
        <div className="row gap">
          <button type="button" className="btn pink" onClick={play} disabled={sel === null || !!selReason} data-testid="play-card">
            {sel === null ? 'カードを選ぶ' : selReason ? '使えません' : 'このカードを使う'}
          </button>
          <button type="button" className="btn primary" onClick={() => act({ type: 'liveEndPhase' })} data-testid="end-phase">
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

function LiveFxView({ fx }: { fx: { id: number; data: LiveFx } | null }) {
  const d = fx?.data;
  return (
    <div className="live-fx" role="status" aria-live="polite" data-testid="live-fx-layer">
      {fx && d && (
        <div key={fx.id} className="live-fx-stack" data-testid="live-fx">
          {d.play && (
            <div className={`fx-play rar-${d.play.rarity}${d.play.combo ? ' is-combo' : ''}`} data-testid="live-fx-play">
              <span className="fx-card">{d.play.card}</span>
              <b className="fx-score">+{fmtTenths(d.play.delta)}<small>点</small></b>
              <span className="fx-gains">熱量+{d.play.gains.h} 一体感+{d.play.gains.u} 思い出+{d.play.gains.m}</span>
              {d.play.combo && <span className="fx-combo" data-testid="combo-burst"><Icon name="link" /> {d.play.combo}</span>}
              {!d.play.combo && d.play.comboMiss && <span className="fx-miss">{d.play.comboMiss}</span>}
            </div>
          )}
          {d.cpu && (
            <div className="fx-cpu" data-testid="live-fx-cpu">
              <span className="fx-who">CPU</span>
              <span>{d.cpu.cards.map((c) => `「${c.name}」`).join('')}を使用{d.cpu.delta !== null ? `（+${fmtTenths(d.cpu.delta)}点）` : ''}</span>
            </div>
          )}
          {d.song && <div className="fx-song" data-testid="live-fx-song">{d.song}</div>}
          {d.advance && <div className="fx-advance" data-testid="live-fx-advance">{d.advance}</div>}
        </div>
      )}
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
        {r.winner === 'player' && <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.12}s`, background: ['#ff5fb7', '#4aa3ff', '#ffd36b', '#a66bff'][i % 4] }} />)}</div>}
        <p className="eyebrow">{CONCERTS[idx]?.name} 終演</p>
        <h2 data-testid="live-verdict">{r.winner === 'player' ? '勝利！' : r.winner === 'draw' ? '引き分け' : '惜敗…'}</h2>
        <div className="vs">
          <div><small>あなた</small><b>{fmtTenths(r.playerTotal)}</b></div>
          <span>VS</span>
          <div><small>CPU</small><b>{fmtTenths(r.cpuTotal)}</b></div>
        </div>
        <p className="target-line">{r.targetReached ? <><Icon name="star" /> 目標スコア {r.target} 達成！</> : `目標スコア ${r.target} には届きませんでした。`}</p>
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

