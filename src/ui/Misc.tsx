import { useState } from 'react';
import {
  CARD_MAP, COPY_LIMIT, DECK_SIZE, OSHI_TYPES, TROPHIES, getCard, type GameState, SONG_METER_MOD, METERS, METER_LABEL,
} from '../game';
import { Bar, CardTile, Modal } from './common';
import { Icon } from './icons';
import { Medal } from './art';
import type { Dispatch } from './useGame';
import { buildFeedback, copyText } from './feedback';

export function ChoiceModal({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  const p = s.pending;
  if (!p) return null;
  return (
    <Modal title="カードを1枚選んで獲得" testId="choice-modal" wide>
      <p className="muted small">{p.source}：三択のうち1枚がコレクションに加わります。選ぶまで他の操作はできません。</p>
      <div className="choice-grid">
        {p.options.map((id) => {
          const c = getCard(id);
          const n = s.collection[id] ?? 0;
          return (
            <CardTile key={id} card={c} owned={n} testId="choice-card" onClick={() => dispatch({ type: 'pickCard', cardId: id })}
              extra={<div className="pick-hint">{n === 0 ? 'NEW 新規カード' : n >= COPY_LIMIT ? '（すでに2枚以上所持）' : `（${n}枚所持）`} タップで獲得</div>} />
          );
        })}
      </div>
    </Modal>
  );
}

export function Trophies({ s }: { s: GameState }) {
  const got = s.trophies.length;
  const total = TROPHIES.filter((t) => !t.locked).length;
  return (
    <div className="screen trophy-screen">
      <section className="panel trophy-head">
        <div className="row between">
          <h2><Icon name="trophy" /> トロフィー棚 <small className="muted" data-testid="trophy-count">{got}/{total}</small></h2>
          <span className="chip">{got >= total ? 'COMPLETE' : `あと${total - got}個`}</span>
        </div>
        <Bar value={got} max={total} cls="b-m" />
        <p className="muted small">達成すると自動で獲得。最終リザルトのスコアに反映されます。</p>
      </section>
      <ul className="trophies shelf">
        {TROPHIES.map((t, i) => {
          const on = s.trophies.includes(t.id);
          const pr = t.progress?.(s);
          return (
            <li key={t.id} className={`trophy${on ? ' on' : ''}${t.locked ? ' locked' : ''}`} data-testid={`trophy-${t.id}`}>
              <Medal on={on} locked={t.locked} tier={i} />
              <div className="trophy-body">
                <b>{t.name}</b>
                <p className="muted small">{t.desc}</p>
                {pr && !t.locked && <><Bar value={pr.cur} max={pr.max} cls="b-m" /><small className="muted">{on ? '達成' : `${pr.cur}/${pr.max}`}</small></>}
                {t.locked && <small className="muted">構想（試作版では未解放）</small>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const TUTORIAL = [
  { t: '12週間の推し活', b: '週ごとに4AP（行動ポイント）。仕事で資金を稼ぎ、休息で体力を戻し、マップで探索・移動します。AP・資金・体力が足りない行動は選べません。週末は+¥2,000、体力+10。' },
  { t: 'マップとカード', b: '全国マップで都市を選び、スポットを探索（1AP）すると三択でカードを獲得。地域・メンバー・曲タイプの傾向で出るカードが変わります。' },
  { t: 'デッキは20枚', b: '同名2枚まで、SR6・SSR2・UR1枚まで。新しいカードは「デッキ」画面で入れ替えて保存します。自動調整も使えます。' },
  { t: 'ライブバトル', b: '第4・8・12週にCPUと4曲勝負。各曲4EP、前半は2EPまで、後半は残りEP。カードを選んで「使う」→「終える」で進行。コンボ（直前や履歴の条件）で大きく伸びます。' },
  { t: '勝敗と報酬', b: '熱量:一体感:思い出=50:30:20で曲ごとにスコア化し、曲の勝者にMVP+2点。報酬の資金とカード三択、トロフィーで次の週へ。' },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = TUTORIAL[i]!;
  return (
    <Modal title={`遊び方 ${i + 1}/${TUTORIAL.length}`} testId="tutorial">
      <h3>{step.t}</h3>
      <p>{step.b}</p>
      <div className="row gap">
        {i > 0 && <button type="button" className="btn plain" onClick={() => setI(i - 1)}>戻る</button>}
        {i < TUTORIAL.length - 1
          ? <button type="button" className="btn primary" onClick={() => setI(i + 1)} data-testid="tutorial-next">次へ</button>
          : <button type="button" className="btn pink" onClick={onClose} data-testid="tutorial-close">はじめる</button>}
        <button type="button" className="btn ghost" onClick={onClose} data-testid="tutorial-skip">スキップ</button>
      </div>
    </Modal>
  );
}

export function Help({ s, onReset, onTutorial, toast }: { s: GameState; onReset: () => void; onTutorial: () => void; toast: (t: string, k: 'err' | 'ok') => void }) {
  const [confirm, setConfirm] = useState(false);
  const copy = async () => {
    const ok = await copyText(buildFeedback(s));
    toast(ok ? '感想メモをコピーしました（外部には送信していません）' : 'コピーできませんでした', ok ? 'ok' : 'err');
  };
  void CARD_MAP;
  return (
    <div className="screen">
      <section className="panel">
        <h2>ヘルプ・ルール</h2>
        <button type="button" className="btn pink" onClick={onTutorial} data-testid="open-tutorial">チュートリアルをもう一度見る</button>
      </section>

      <section className="panel doc">
        <h3>ゲームの流れ</h3>
        <ul>
          <li>期間は12週。毎週<b>4AP</b>。初期資金¥60,000・体力80（上限100）。</li>
          <li>仕事 2AP（+¥22,000・体力-12）／休息 2AP（体力+30）／探索 1AP（入場費・体力消費、カード三択）／移動 1〜2AP＋運賃／訓練 1AP／資産購入 1AP。</li>
          <li>週末に+¥2,000と体力+10。資産があれば追加収入。</li>
          <li>ライブは第4・8・12週。<b>現地</b>（移動込み・高報酬）／<b>配信</b>（低コスト）／<b>無料配信</b>（0AP・0円で必ず参加可能）。</li>
        </ul>
        <h3>デッキ</h3>
        <ul>
          <li>{DECK_SIZE}枚固定・同名{COPY_LIMIT}枚まで・SR6/SSR2/UR1まで。所持数を超える編成は不可。</li>
          <li>カードは attribute として メンバーA〜H・曲タイプ・地域を持ち、コンボ条件に使われます。</li>
        </ul>
        <h3>ライブのルール</h3>
        <ul>
          <li>山札をシャッフルして手札5枚。曲の切替で2枚、後半開始時に1枚引く（手札上限7）。山札が尽きたら捨て札を混ぜ直します。</li>
          <li>1曲=<b>4EP</b>。前半は合計<b>2EPまで</b>、後半は残りEP。フィニッシャーは後半専用。</li>
          <li>同名のSR以上は1公演に1回まで（使用済みの重複は曲の切替で自動的に捨てられます）。</li>
          <li>コンボは<b>この曲の使用順</b>や<b>この公演の使用履歴</b>で判定。手札・山札の移動とは独立。条件を満たさないと「不発」とログに出ます。</li>
          <li>曲スコア＝熱量×0.5＋一体感×0.3＋思い出×0.2（50:30:20）。曲の勝者にMVP+2点。合計が高い方が勝ち。目標スコア到達でボーナス。</li>
          <li>曲タイプ補正：{(Object.entries(SONG_METER_MOD) as [string, Record<'h' | 'u' | 'm', number>][]).map(([k, v]) => `${{ call: 'コール', unit: 'ユニット', ballad: 'バラード', all: '全体' }[k]}（${METERS.filter((m) => v[m] !== 1).map((m) => `${METER_LABEL[m]}×${v[m]}`).join('')}）`).join(' / ')}。カードの曲タイプが曲と一致すると+25%。</li>
          <li>CPUも同じ規則・同じEP・手札で、手札から合法カードを評価して選びます（前半はEPを温存することも）。</li>
          <li>体力が70以上で獲得値×1.05、30未満で×0.9。</li>
        </ul>
        <h3>推しタイプ</h3>
        <ul>{OSHI_TYPES.map((t) => <li key={t.id}><b>{t.name}</b>：{t.passive}</li>)}</ul>
        <h3>この試作版について</h3>
        <ul>
          <li>ソロプレイ＋CPU対戦のみ。<b>オンライン・対人対戦は未実装</b>（今後追加予定）。</li>
          <li>メンバーA〜H、スポット、施設、資産はすべて<b>架空</b>です。実在の人物・施設・団体との関連はありません。都市名は移動拠点としての地名のみです。</li>
          <li>「五大ドーム制覇」は長期モード向けの構想で、試作版ではロック表示のみです。</li>
          <li>数値は仮の値で、今後調整されます。</li>
        </ul>
      </section>

      <section className="panel">
        <h3>プレイテストの感想</h3>
        <p className="muted small">ボタンを押すと現在の進行状況つきのメモ用テキストを<b>この端末のクリップボードにコピー</b>します。外部への送信はしません。</p>
        <button type="button" className="btn plain" onClick={copy} data-testid="copy-feedback-help">感想メモをコピー</button>
      </section>

      <section className="panel">
        <h3>セーブデータ</h3>
        <p className="muted small">進行は自動でこのブラウザ（localStorage）に保存されます。シード：{s.seed}</p>
        <button type="button" className="btn danger" onClick={() => setConfirm(true)} data-testid="reset-btn">最初からやり直す（リセット）</button>
      </section>

      {confirm && (
        <Modal title="本当にリセットしますか？" testId="reset-confirm">
          <p>保存データを削除して、最初の画面に戻ります。この操作は取り消せません。</p>
          <div className="row gap">
            <button type="button" className="btn plain" onClick={() => setConfirm(false)}>やめる</button>
            <button type="button" className="btn danger" data-testid="reset-yes" onClick={() => { setConfirm(false); onReset(); }}>リセットする</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

