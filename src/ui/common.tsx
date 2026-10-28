import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MEMBER_COLOR } from './palette';
import { CardArt } from './art';
import { Icon, type IconName } from './icons';
import {
  describeEffect, KIND_LABEL, METERS, METER_LABEL, REGION_LABEL, SONG_TYPE_LABEL,
  type CardDef, type Gain3, type MemberId,
} from '../game';

export { MEMBER_COLOR };

export function MemberChip({ m }: { m: MemberId }) {
  return (
    <span className="chip member" style={{ borderColor: MEMBER_COLOR[m], color: MEMBER_COLOR[m] }}>
      メンバー{m}
    </span>
  );
}

export function GainLine({ g }: { g: Gain3 }) {
  return (
    <span className="gains">
      {METERS.map((k) => (
        <span key={k} className={`gain gain-${k}`}>
          {METER_LABEL[k]}+{g[k]}
        </span>
      ))}
    </span>
  );
}

export interface CardTileProps {
  card: CardDef;
  owned?: number;
  inDeck?: number;
  isNew?: boolean;
  selected?: boolean;
  onClick?: () => void;
  reason?: string | null;
  gains?: Gain3;
  comboText?: string | null;
  comboOk?: boolean;
  testId?: string;
  extra?: ReactNode;
  dim?: boolean;
  /** 今使える（ライブの手札用）。縁が光る */
  ready?: boolean;
}

export function CardTile(p: CardTileProps) {
  const { card } = p;
  const body = (
    <>
      <CardArt card={card} />
      <div className="card-top">
        <span className={`rar rar-${card.rarity}`}>{card.rarity}</span>
        <span className="card-name">{card.name}</span>
        <span className="cost" title="EPコスト">{card.cost}EP</span>
      </div>
      <div className="card-tags">
        <span className={`chip kind kind-${card.kind}`}>{KIND_LABEL[card.kind]}</span>
        <MemberChip m={card.member} />
        <span className="chip">{SONG_TYPE_LABEL[card.songType]}</span>
        <span className="chip">{REGION_LABEL[card.region]}</span>
      </div>
      <div className="card-base">
        基本 <GainLine g={card.base} />
      </div>
      <div className="card-effect">{describeEffect(card.effect)}</div>
      {p.gains && (
        <div className="card-preview">
          今使うと <GainLine g={p.gains} />
        </div>
      )}
      {p.comboText && <div className={p.comboOk ? 'combo-ok' : 'combo-ng'}>{p.comboText}</div>}
      {(p.owned !== undefined || p.isNew) && (
        <div className="card-counts">
          {p.owned !== undefined && <span>所持 {p.owned}</span>}
          {p.inDeck !== undefined && <span>デッキ {p.inDeck}</span>}
          {p.isNew && <span className="badge-new">NEW</span>}
        </div>
      )}
      {p.reason && <div className="card-reason"><Icon name="lock" /> {p.reason}</div>}
      {p.extra}
    </>
  );
  const cls = `card rar-bg-${card.rarity}${p.selected ? ' selected' : ''}${p.reason ? ' blocked' : ''}${p.dim ? ' dim' : ''}${p.ready ? ' ready' : ''}`;
  if (p.onClick) {
    return (
      <button type="button" className={cls} onClick={p.onClick} data-testid={p.testId} data-rarity={card.rarity} aria-pressed={p.selected}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} data-testid={p.testId} data-rarity={card.rarity}>
      {body}
    </div>
  );
}

export function Modal(props: { title?: string; children: ReactNode; onClose?: () => void; onEscape?: () => void; testId?: string; wide?: boolean; className?: string; labelledBy?: string }) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const escape = useRef(props.onEscape);
  escape.current = props.onEscape;
  useEffect(() => {
    const root = dialog.current!;
    const previous = document.activeElement;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
    (controls()[0] ?? root).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escape.current) { event.preventDefault(); escape.current(); return; }
      if (event.key !== 'Tab') return;
      const all = controls();
      const first = all[0] ?? root;
      const last = all[all.length - 1] ?? root;
      if (!root.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <div ref={dialog} className="modal-back" role="dialog" aria-modal="true" aria-labelledby={props.labelledBy ?? (props.title ? titleId : undefined)} tabIndex={-1} data-testid={props.testId}>
      <div className={`modal${props.wide ? ' wide' : ''}${props.className ? ` ${props.className}` : ''}`}>
        {props.title && <h2 id={titleId}>{props.title}</h2>}
        {props.children}
        {props.onClose && <button type="button" className="btn ghost" onClick={props.onClose}>閉じる</button>}
      </div>
    </div>
  );
}
export function Bar({ value, max, cls }: { value: number; max: number; cls?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`bar ${cls ?? ''}`} aria-hidden="true">
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ActionButton(props: {
  label: string;
  sub?: string;
  reason: string | null;
  onClick: () => void;
  testId?: string;
  tone?: 'primary' | 'pink' | 'plain';
}) {
  return (
    <div className="action">
      <button
        type="button"
        className={`btn ${props.tone ?? 'plain'}`}
        onClick={props.onClick}
        disabled={!!props.reason}
        data-testid={props.testId}
      >
        <span>{props.label}</span>
        {props.sub && <small>{props.sub}</small>}
      </button>
      {props.reason && <p className="reason">{props.reason}</p>}
    </div>
  );
}


export interface TileChip { text: string; icon?: IconName }

/** イラスト調の選択タイル（仕事/休息/訓練/旅）。disabled と理由表示は ActionButton と同じ。 */
export function ActionTile(props: {
  icon: IconName;
  label: string;
  chips: TileChip[];
  reason: string | null;
  onClick: () => void;
  testId?: string;
  tone: 'work' | 'rest' | 'travel' | 'h' | 'u' | 'm';
  hint?: string;
  /** 1行まるごと使う（グリッドの全幅） */
  wide?: boolean;
}) {
  return (
    <div className={`tile-wrap${props.wide ? ' wide' : ''}`}>
      <button type="button" className={`tile tone-${props.tone}`} onClick={props.onClick} disabled={!!props.reason} data-testid={props.testId}>
        <span className="tile-art" aria-hidden="true"><Icon name={props.icon} /></span>
        <span className="tile-body">
          <b className="tile-label">{props.label}</b>
          {props.hint && <span className="tile-hint">{props.hint}</span>}
          <span className="tile-chips">
            {props.chips.map((c) => <span key={c.text} className="tile-chip">{c.icon && <Icon name={c.icon} />}{c.text}</span>)}
          </span>
        </span>
      </button>
      {props.reason && <p className="reason">{props.reason}</p>}
    </div>
  );
}
