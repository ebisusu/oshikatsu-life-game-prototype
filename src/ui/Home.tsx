import { useState } from 'react';
import {
  blockReason, CITIES, CONCERTS, currentConcert, finalSummary, METERS, METER_LABEL, OSHI_MAP, TOTAL_WEEKS, TRAIN_MAX,
  trainCost, WORK_INCOME, WORK_AP, WORK_STAMINA, REST_AP, REST_STAMINA, TRAIN_AP, TRAIN_STAMINA, yen, TROPHIES,
  type GameState, type Meter,
} from '../game';
import { ActionTile, Modal } from './common';
import { HomeScene, JourneyTrack } from './art';
import { FxLayer, useDeltaFx } from './fx';
import { Icon } from './icons';
import type { Dispatch } from './useGame';
import type { Tab } from './App';
import { buildFeedback, copyText } from './feedback';

export function Home(props: { s: GameState; dispatch: Dispatch; go: (t: Tab) => void; onReset: () => void; toast: (t: string, k: 'err' | 'ok') => void }) {
  const { s, dispatch } = props;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { run, items, seq } = useDeltaFx(s, dispatch);
  const concert = currentConcert(s);
  const livePending = !!concert && s.concerts[concert.id]?.status === 'pending';
  const nextConcert = CONCERTS.find((c) => c.week >= s.week && s.concerts[c.id]?.status === 'pending');

  if (s.finished) return <FinalResult {...props} />;

  const endWeek = () => {
    if (livePending) setConfirmEnd(true);
    else dispatch({ type: 'endWeek' });
  };

  return (
    <div className="screen home">
      <FxLayer items={items} seq={seq} />
      <section className="panel week-panel poster">
        <HomeScene live={livePending} />
        <div className="poster-body">
          <div className="row between poster-head">
            <div>
              <p className="eyebrow">WEEK {String(s.week).padStart(2, '0')} / {TOTAL_WEEKS}</p>
              <h2>第{s.week}週 / {TOTAL_WEEKS}</h2>
            </div>
            <span className="chip type">{OSHI_MAP[s.oshi].name}{s.oshiMember ? `（メンバー${s.oshiMember}）` : ''}</span>
          </div>
          {livePending && concert ? (
            <div className="live-banner" data-testid="live-banner">
              <span className="lb-tag"><Icon name="mic" /> LIVE WEEK</span>
              <b>今週は「{concert.name}」開催週！</b>
              <span>会場：{concert.venue}（{concert.city === s.city ? 'いまここ' : '別の都市'}）。参加はライブ画面から。</span>
              <button type="button" className="btn pink" onClick={() => props.go('live')} data-testid="go-live"><Icon name="mic" /> ライブ画面へ</button>
            </div>
          ) : nextConcert ? (
            <div className="ticket" data-testid="next-ticket">
              <div className="ticket-main">
                <span className="ticket-tag">NEXT LIVE</span>
                <b>第{nextConcert.week}週「{nextConcert.name}」</b>
                <small>それまでにカードを集めてデッキを整えよう。</small>
              </div>
              <div className="ticket-stub" aria-label={`次の公演まであと${nextConcert.week - s.week}週`}>
                <small>あと</small><b>{nextConcert.week - s.week}</b><small>週</small>
              </div>
            </div>
          ) : (
            <p className="muted">すべての公演が終了しました。残りの週を好きに過ごして完走しよう。</p>
          )}
          <JourneyTrack s={s} />
          <div className="passport" data-testid="passport" aria-label={`旅券スタンプ ${s.visitedCities.length}/${CITIES.length}`}>
            <span className="passport-title"><Icon name="stamp" /> 旅券 {s.visitedCities.length}/{CITIES.length}</span>
            <ul>
              {CITIES.map((c, i) => (
                <li key={c.id} className={s.visitedCities.includes(c.id) ? 'got' : ''} style={{ ['--rot' as string]: `${((i * 37) % 17) - 8}deg` }}>{c.name}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2><Icon name="bolt" /> 今週の行動（残りAP {s.ap}）</h2>
        <div className="tiles">
          <ActionTile tone="work" icon="work" label="仕事" hint="コツコツ稼ぐ" testId="act-work"
            chips={[{ text: `${WORK_AP}AP`, icon: 'bolt' }, { text: `+${yen(WORK_INCOME)}`, icon: 'coin' }, { text: `体力-${WORK_STAMINA}`, icon: 'heart' }]}
            reason={blockReason(s, { type: 'work' })} onClick={() => run({ type: 'work' })} />
          <ActionTile tone="rest" icon="rest" label="休息" hint="体力を回復" testId="act-rest"
            chips={[{ text: `${REST_AP}AP`, icon: 'bolt' }, { text: `体力+${REST_STAMINA}`, icon: 'heart' }]}
            reason={blockReason(s, { type: 'rest' })} onClick={() => run({ type: 'rest' })} />
          <ActionTile tone="travel" wide icon="ticket" label="マップで探索・移動" hint="旅に出る" testId="act-map"
            chips={[{ text: '探索1AP', icon: 'bolt' }, { text: '移動1〜2AP', icon: 'rail' }]}
            reason={null} onClick={() => props.go('map')} />
        </div>
        <h3>訓練（{TRAIN_AP}AP・体力-{TRAIN_STAMINA}）：ライブの各メーター+5%/Lv</h3>
        <div className="tiles train">
          {METERS.map((k: Meter) => (
            <ActionTile key={k} tone={k} icon="train" label={`${METER_LABEL[k]} Lv${s.skills[k]}`} testId={`act-train-${k}`}
              chips={[s.skills[k] >= TRAIN_MAX ? { text: 'MAX', icon: 'star' } : { text: yen(trainCost(s.skills[k])), icon: 'coin' }]}
              reason={blockReason(s, { type: 'train', skill: k })} onClick={() => run({ type: 'train', skill: k })} />
          ))}
        </div>
      </section>

      <section className="panel end-panel">
        <button type="button" className="btn primary big cta-end" onClick={endWeek} data-testid="end-week">
          <Icon name="sparkle" />
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
