import { useState } from 'react';
import {
  blockReason, CONCERTS, currentConcert, finalSummary, METERS, METER_LABEL, OSHI_MAP, TOTAL_WEEKS, TRAIN_MAX,
  trainCost, WORK_INCOME, yen, TROPHIES,
  type GameState, type Meter,
} from '../game';
import { ActionButton, Modal } from './common';
import type { Dispatch } from './useGame';
import type { Tab } from './App';
import { buildFeedback, copyText } from './feedback';

export function Home(props: { s: GameState; dispatch: Dispatch; go: (t: Tab) => void; onReset: () => void; toast: (t: string, k: 'err' | 'ok') => void }) {
  const { s, dispatch } = props;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const concert = currentConcert(s);
  const livePending = !!concert && s.concerts[concert.id]?.status === 'pending';
  const nextConcert = CONCERTS.find((c) => c.week >= s.week && s.concerts[c.id]?.status === 'pending');

  if (s.finished) return <FinalResult {...props} />;

  const endWeek = () => {
    if (livePending) setConfirmEnd(true);
    else dispatch({ type: 'endWeek' });
  };

  return (
    <div className="screen">
      <section className="panel week-panel">
        <div className="row between">
          <h2>第{s.week}週 / {TOTAL_WEEKS}</h2>
          <span className="chip type">{OSHI_MAP[s.oshi].name}{s.oshiMember ? `（メンバー${s.oshiMember}）` : ''}</span>
        </div>
        {livePending && concert ? (
          <div className="live-banner" data-testid="live-banner">
            <b>🎤 今週は「{concert.name}」開催週！</b>
            <span>会場：{concert.venue}（{concert.city === s.city ? 'いまここ' : '別の都市'}）。参加はライブ画面から。</span>
            <button type="button" className="btn pink" onClick={() => props.go('live')} data-testid="go-live">ライブ画面へ</button>
          </div>
        ) : nextConcert ? (
          <p className="muted">次の公演：第{nextConcert.week}週「{nextConcert.name}」（あと{nextConcert.week - s.week}週）。それまでにカードを集めてデッキを整えよう。</p>
        ) : (
          <p className="muted">すべての公演が終了しました。残りの週を好きに過ごして完走しよう。</p>
        )}
      </section>

      <section className="panel">
        <h2>今週の行動（残りAP {s.ap}）</h2>
        <div className="actions">
          <ActionButton label="仕事" sub={`2AP・+${yen(WORK_INCOME)}・体力-12`} tone="primary" testId="act-work"
            reason={blockReason(s, { type: 'work' })} onClick={() => dispatch({ type: 'work' })} />
          <ActionButton label="休息" sub="2AP・体力+30" testId="act-rest"
            reason={blockReason(s, { type: 'rest' })} onClick={() => dispatch({ type: 'rest' })} />
          <ActionButton label="マップで探索・移動" sub="探索1AP／移動1〜2AP" tone="pink" testId="act-map"
            reason={null} onClick={() => props.go('map')} />
        </div>
        <h3>訓練（1AP・体力-6）：ライブの各メーター+5%/Lv</h3>
        <div className="actions three">
          {METERS.map((k: Meter) => (
            <ActionButton key={k} label={`${METER_LABEL[k]} Lv${s.skills[k]}`}
              sub={s.skills[k] >= TRAIN_MAX ? 'MAX' : yen(trainCost(s.skills[k]))} testId={`act-train-${k}`}
              reason={blockReason(s, { type: 'train', skill: k })} onClick={() => dispatch({ type: 'train', skill: k })} />
          ))}
        </div>
      </section>

      <section className="panel">
        <button type="button" className="btn primary big" onClick={endWeek} data-testid="end-week">
          {s.week >= TOTAL_WEEKS ? '最終週を終える（結果へ）' : s.ap === 0 ? '週を終える（AP0）' : '週を終える'}
        </button>
        <p className="muted small">週末：資金+¥2,000（資産収入込み）、体力+10。APは4に戻ります。</p>
      </section>

      <section className="panel">
        <h2>最近の出来事</h2>
        <ul className="log" data-testid="home-log">
          {[...s.log].slice(-8).reverse().map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </section>

      {confirmEnd && concert && (
        <Modal title="ライブに参加せず週を終えますか？" testId="confirm-end">
          <p>今週は「{concert.name}」の開催週です。参加しないまま週を終えると、この公演は<b>不参加</b>になります（無料配信なら0AP・0円で参加できます）。</p>
          <div className="row gap">
            <button type="button" className="btn pink" onClick={() => { setConfirmEnd(false); props.go('live'); }}>ライブ画面へ</button>
            <button type="button" className="btn plain" data-testid="confirm-end-yes" onClick={() => { setConfirmEnd(false); dispatch({ type: 'endWeek' }); }}>不参加で終える</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FinalResult(props: { s: GameState; onReset: () => void; toast: (t: string, k: 'err' | 'ok') => void }) {
  const { s } = props;
  const f = finalSummary(s);
  const copy = async () => {
    const ok = await copyText(buildFeedback(s));
    props.toast(ok ? '感想メモをクリップボードにコピーしました（外部には送信していません）' : 'コピーできませんでした。Helpの欄から手動で選択してください', ok ? 'ok' : 'err');
  };
  return (
    <div className="screen" data-testid="final-result">
      <section className="panel final">
        <p className="eyebrow">12週間 完走！</p>
        <h2>最終リザルト</h2>
        <div className="rank" data-testid="final-rank">{f.rank}</div>
        <p className="score">総合スコア {f.score}</p>
        <ul className="parts">
          {f.parts.map((p) => <li key={p.label}><span>{p.label}</span><b>+{p.value}</b></li>)}
        </ul>
      </section>
      <section className="panel">
        <h3>公演の結果</h3>
        <ul className="parts">
          {CONCERTS.map((c) => {
            const r = s.concerts[c.id];
            const t = r?.status === 'done' ? `${r.winner === 'player' ? '勝利' : r.winner === 'draw' ? '引き分け' : '敗北'}（${((r.playerTotal ?? 0) / 10).toFixed(1)} vs ${((r.cpuTotal ?? 0) / 10).toFixed(1)}）${r.targetReached ? ' 🎯目標達成' : ''}` : '不参加';
            return <li key={c.id}><span>第{c.week}週 {c.name}</span><b>{t}</b></li>;
          })}
        </ul>
        <h3>トロフィー {s.trophies.length}/{TROPHIES.filter((t) => !t.locked).length}</h3>
        <p className="muted small">{s.trophies.length ? s.trophies.map((id) => TROPHIES.find((t) => t.id === id)?.name).join(' / ') : 'なし'}</p>
      </section>
      <section className="panel">
        <div className="row gap wrap">
          <button type="button" className="btn pink" onClick={copy} data-testid="copy-feedback">感想メモをコピー</button>
          <button type="button" className="btn primary" onClick={props.onReset} data-testid="play-again">もう一度はじめから</button>
        </div>
        <p className="muted small">コピーは端末内のクリップボードだけを使います。データはどこにも送信されません。</p>
      </section>
    </div>
  );
}
