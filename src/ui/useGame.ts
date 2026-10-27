import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyAction, clearSave, loadGame, newGame, parseSave, SAVE_KEY, saveGame,
  type Action, type GameState, type NewGameOpts, type StorageLike,
} from '../game';
import { weekIntroData, type WeekIntroData } from './weekTransition';

function getStorage(): StorageLike | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
function readRaw(): string | null | undefined {
  try { return getStorage()?.getItem(SAVE_KEY); } catch { return undefined; }
}
export interface Toast { id: number; text: string; kind: 'err' | 'ok'; }

export function useGame() {
  const [boot] = useState(() => ({ loaded: loadGame(getStorage()), raw: readRaw() }));
  const [state, setState] = useState<GameState | null>(boot.loaded.status === 'ok' ? boot.loaded.state : null);
  const [notice, setNotice] = useState<string | null>(boot.loaded.status === 'invalid' ? boot.loaded.reason : null);
  const [toast, setToast] = useState<Toast | null>(null);
  // 週開始アイキャッチ。endWeek を実行したこのタブの操作でだけ立てる（保存データには含めない）。
  const [weekIntro, setWeekIntro] = useState<WeekIntroData | null>(null);
  const ref = useRef<GameState | null>(state);
  const savedRaw = useRef(boot.raw);
  const timer = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string, kind: Toast['kind']) => {
    setToast({ id: Date.now() + Math.random(), text, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commit = useCallback((s: GameState | null) => { ref.current = s; setState(s); }, []);

  // Incoming storage updates must never be written back as new saves (no echo loop).
  const syncStorage = useCallback((): boolean => {
    const raw = readRaw();
    if (raw === undefined || raw === savedRaw.current) return false;
    savedRaw.current = raw;
    setWeekIntro(null);
    const loaded = parseSave(raw);
    setNotice(loaded.status === 'invalid' ? loaded.reason : null);
    commit(loaded.status === 'ok' ? loaded.state : null);
    return true;
  }, [commit]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if ((event.key === SAVE_KEY || event.key === null) && event.storageArea === getStorage()) syncStorage();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [syncStorage]);

  const persist = useCallback((s: GameState) => {
    if (saveGame(getStorage(), s)) savedRaw.current = readRaw();
    else showToast('自動保存できませんでした。この画面ではプレイを続けられます。', 'err');
    commit(s);
  }, [commit, showToast]);
  const dispatch = useCallback((a: Action): boolean => {
    // A click can race the storage event. Refresh first; never apply an old hand index
    // or an old deck draft to a different tab's newer state.
    if (syncStorage()) { showToast('別タブの最新の進行を読み込みました。操作を確認してください。', 'err'); return false; }
    const cur = ref.current;
    if (!cur) return false;
    const r = applyAction(cur, a);
    if (!r.ok) { showToast(r.reason, 'err'); return false; }
    persist(r.state);
    if (a.type === 'endWeek') setWeekIntro(weekIntroData(cur, r.state));
    return true;
  }, [persist, showToast, syncStorage]);
  const start = useCallback((opts: NewGameOpts): boolean => {
    if (syncStorage()) return false;
    setNotice(null);
    setWeekIntro(null);
    persist(newGame(opts));
    return true;
  }, [persist, syncStorage]);
  const reset = useCallback(() => {
    clearSave(getStorage());
    savedRaw.current = readRaw();
    setNotice(null);
    setWeekIntro(null);
    commit(null);
  }, [commit]);
  const dismissWeekIntro = useCallback(() => setWeekIntro(null), []);
  return { state, dispatch, start, reset, toast, notice, dismissNotice: () => setNotice(null), showToast, weekIntro, dismissWeekIntro };
}
export type Dispatch = (a: Action) => boolean;
