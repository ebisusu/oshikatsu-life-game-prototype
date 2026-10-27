import { useEffect, useId } from 'react';
import { yen } from '../game';
import { Modal } from './common';
import type { WeekIntroData } from './weekTransition';

const pad = (n: number) => String(n).padStart(2, '0');
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${yen(Math.abs(n))}`;

/** 背景（ヘッダー・本文・タブ）を操作・読み上げ対象から外す。Modal 側がフォーカストラップと ESC を担当。 */
function useInertBackground() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.status, .content, .tabs'));
    els.forEach((el) => { el.setAttribute('inert', ''); });
    return () => { els.forEach((el) => { el.removeAttribute('inert'); }); };
  }, []);
}

export function WeekIntro({ data, onClose }: { data: WeekIntroData; onClose: () => void }) {
  const headId = useId();
  useInertBackground();
  const { stamina, ap } = data;
  const capped = stamina.after - stamina.before < 10 && stamina.after >= 100;
  return (
    <Modal testId="week-intro" className="week-intro" labelledBy={headId} onEscape={onClose}>
      <div className="wi-hero" aria-hidden="true">
        <span className="wi-spark s1" /><span className="wi-spark s2" /><span className="wi-spark s3" />
        <span className="wi-label">WEEK</span>
        <span className="wi-num" data-testid="week-intro-num">{pad(data.week)}</span>
        <span className="wi-total">/ {pad(data.totalWeeks)}</span>
      </div>
      <h2 id={headId} className="wi-title" data-testid="week-intro-title">第{data.week}週 スタート！</h2>

      <section className="wi-block" aria-label="週末の精算">
        <h3>第{data.fromWeek}週の週末精算</h3>
        <ul className="wi-list">
          {data.income.map((row) => (
            <li key={row.label}><span>{row.label}</span><b className="ok-text" data-testid="week-intro-income">{signed(row.amount)}</b></li>
          ))}
          <li><span>資金</span><b data-testid="week-intro-money">{yen(data.money.before)} → {yen(data.money.after)}</b></li>
          <li>
            <span>体力の自然回復</span>
            <b data-testid="week-intro-stamina">{stamina.before} → {stamina.after}{capped ? '（上限）' : `（+${stamina.gain}）`}</b>
          </li>
          <li><span>行動ポイント</span><b data-testid="week-intro-ap">AP {ap.before} → {ap.after} に回復</b></li>
        </ul>
        {data.missed && <p className="wi-note ng-text" data-testid="week-intro-missed">「{data.missed.name}」は不参加になりました。</p>}
      </section>

      <section className="wi-block" aria-label="今週の予定">
        <h3>今週の予定</h3>
        {data.thisWeek ? (
          <p className="wi-event" data-testid="week-intro-event">🎤 今週は「{data.thisWeek.name}」開催週！<br /><small className="muted">会場：{data.thisWeek.venue}。参加はライブ画面から。</small></p>
        ) : data.next ? (
          <p className="wi-event" data-testid="week-intro-event">今週は公演なし。次は第{data.next.week}週「{data.next.name}」（あと{data.next.weeksAway}週）。</p>
        ) : (
          <p className="wi-event" data-testid="week-intro-event">残りの公演はありません。好きに過ごして完走しよう。</p>
        )}
      </section>

      <button type="button" className="btn pink big" onClick={onClose} data-testid="week-intro-start">今週の推し活を始める</button>
    </Modal>
  );
}
