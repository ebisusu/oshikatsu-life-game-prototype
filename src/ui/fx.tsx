// 操作結果の「実データ差分」だけを短く見せる演出。
// dispatch が成功して状態が変わったときだけ、操作前後の差分から作る（失敗・リロード・別タブ同期では出ない）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { METER_LABEL, yen, type Action, type GameState } from '../game';
import { Icon, type IconName } from './icons';
import type { Dispatch } from './useGame';

export interface FxItem { key: string; icon: IconName; text: string; tone: 'gain' | 'loss' | 'info' }

export function diffState(a: GameState, b: GameState): FxItem[] {
  const out: FxItem[] = [];
  const dm = b.money - a.money;
  if (dm !== 0) out.push({ key: 'money', icon: 'coin', text: `${dm > 0 ? '+' : '-'}${yen(Math.abs(dm))}`, tone: dm > 0 ? 'gain' : 'loss' });
  const ds = b.stamina - a.stamina;
  if (ds !== 0) out.push({ key: 'stamina', icon: 'heart', text: `体力 ${ds > 0 ? '+' : '-'}${Math.abs(ds)}`, tone: ds > 0 ? 'gain' : 'loss' });
  const da = b.ap - a.ap;
  if (da !== 0) out.push({ key: 'ap', icon: 'bolt', text: `AP ${da > 0 ? '+' : '-'}${Math.abs(da)}`, tone: da > 0 ? 'gain' : 'info' });
  for (const k of ['h', 'u', 'm'] as const) {
    if (b.skills[k] !== a.skills[k]) out.push({ key: `skill-${k}`, icon: 'train', text: `${METER_LABEL[k]} Lv${a.skills[k]} → Lv${b.skills[k]}`, tone: 'gain' });
  }
  if (b.assets.length > a.assets.length) out.push({ key: 'asset', icon: 'star', text: '資産を購入', tone: 'info' });
  return out;
}

export function useDeltaFx(s: GameState, dispatch: Dispatch) {
  const armed = useRef<GameState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [items, setItems] = useState<FxItem[]>([]);
  const [seq, setSeq] = useState(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    const before = armed.current;
    if (!before || before === s) return;
    armed.current = null;
    const d = diffState(before, s);
    if (!d.length) return;
    setItems(d);
    setSeq((n) => n + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setItems([]), 2200);
  }, [s]);
  /** dispatch が成功したときだけ、直前の状態を覚えて差分演出を予約する */
  const run = useCallback((a: Action): boolean => {
    const ok = dispatch(a);
    if (ok) armed.current = s;
    return ok;
  }, [dispatch, s]);
  return { run, items, seq };
}

export function FxLayer({ items, seq }: { items: FxItem[]; seq: number }) {
  return (
    <div className="fx-layer" role="status" aria-live="polite" data-testid="fx-layer">
      {items.length > 0 && (
        <ul key={seq} className="fx-list" data-testid="fx-delta">
          {items.map((it, i) => (
            <li key={it.key} className={`fx-chip ${it.tone}`} data-fx={it.key} style={{ animationDelay: `${i * 70}ms` }}>
              <Icon name={it.icon} /> {it.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
