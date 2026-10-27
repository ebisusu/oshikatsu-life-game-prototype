import { useEffect, useMemo, useState } from 'react';
import {
  CARDS, CARD_MAP, COPY_LIMIT, countIds, countRarities, DECK_SIZE, RARITIES, RARITY_LIMIT, validateDeck,
  type GameState, type Rarity,
} from '../game';
import { CardTile } from './common';
import type { Dispatch } from './useGame';

export function Collection({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  const [rar, setRar] = useState<Rarity | 'all'>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const deckCount = countIds(s.deck);
  const owned = Object.values(s.collection).filter((n) => n > 0).length;
  const newSet = useMemo(() => new Set(s.newCards), [s.newCards]);
  // 画面を離れたら「NEW」を確認済みにする
  useEffect(() => () => { dispatch({ type: 'markCardsSeen' }); }, [dispatch]);
  const list = CARDS.filter((c) => (rar === 'all' || c.rarity === rar) && (!ownedOnly || (s.collection[c.id] ?? 0) > 0));
  return (
    <div className="screen">
      <section className="panel">
        <h2>コレクション <small className="muted" data-testid="owned-count">{owned}/{CARDS.length}種</small></h2>
        <p className="muted small">カードはマップの探索とライブ報酬で増えます。「所持」と「デッキ」の差が未編成の分です。NEWは未確認の新規入手。</p>
        <div className="chips">
          {(['all', ...RARITIES] as const).map((r) => (
            <button key={r} type="button" className={`chip-btn${rar === r ? ' on' : ''}`} onClick={() => setRar(r)} aria-pressed={rar === r}>{r === 'all' ? 'すべて' : r}</button>
          ))}
          <label className="chip-btn check"><input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> 所持のみ</label>
        </div>
      </section>
      <div className="card-grid">
        {list.map((c) => {
          const n = s.collection[c.id] ?? 0;
          return <CardTile key={c.id} card={c} owned={n} inDeck={deckCount[c.id] ?? 0} isNew={newSet.has(c.id)} dim={n === 0}
            testId={`col-${c.id}`} extra={n === 0 ? <div className="card-reason">未入手</div> : undefined} />;
        })}
      </div>
      <section className="panel">
        <h3>収集品（スポット探索で入手・{s.souvenirs.length}個）</h3>
        <p className="muted small">{s.souvenirs.length ? s.souvenirs.join(' / ') : 'まだありません。スポットを探索しよう。'}</p>
      </section>
    </div>
  );
}

export function DeckScreen({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  const [draft, setDraft] = useState<string[]>(s.deck);
  useEffect(() => { setDraft(s.deck); }, [s.deck]);
  useEffect(() => () => { dispatch({ type: 'markCardsSeen' }); }, [dispatch]);

  const counts = countIds(draft);
  const rc = countRarities(draft);
  const errors = validateDeck(draft, s.collection);
  const dirty = draft.join() !== s.deck.join();
  const newSet = new Set(s.newCards);
  const owned = CARDS.filter((c) => (s.collection[c.id] ?? 0) > 0);

  const addReason = (id: string): string | null => {
    const c = CARD_MAP[id];
    if (!c) return '不明';
    if (draft.length >= DECK_SIZE) return `${DECK_SIZE}枚です。先に外してください`;
    if ((counts[id] ?? 0) >= COPY_LIMIT) return `同名${COPY_LIMIT}枚まで`;
    if ((counts[id] ?? 0) >= (s.collection[id] ?? 0)) return '所持数を超えます';
    if (rc[c.rarity] + 1 > RARITY_LIMIT[c.rarity]) return `${c.rarity}は${RARITY_LIMIT[c.rarity]}枚まで`;
    return null;
  };
  const add = (id: string) => setDraft((d) => (addReason(id) ? d : [...d, id]));
  const remove = (id: string) => setDraft((d) => { const i = d.lastIndexOf(id); return i < 0 ? d : [...d.slice(0, i), ...d.slice(i + 1)]; });

  const diffNew = owned.filter((c) => (s.collection[c.id] ?? 0) > (counts[c.id] ?? 0)).length;

  return (
    <div className="screen">
      <section className="panel">
        <div className="row between">
          <h2>デッキ編成 <span className={draft.length === DECK_SIZE ? 'ok-text' : 'ng-text'} data-testid="deck-count">{draft.length}/{DECK_SIZE}</span></h2>
          <span className="muted small deck-head-limits">SR {rc.SR}/6 ・ SSR {rc.SSR}/2 ・ UR {rc.UR}/1 ・ 同名{COPY_LIMIT}枚まで</span>
        </div>
        {errors.length > 0 && <ul className="errors" data-testid="deck-errors">{errors.map((e) => <li key={e}>⚠ {e}</li>)}</ul>}
        {errors.length === 0 && <p className="ok-text small">✓ 合法なデッキです{dirty ? '（未保存）' : '（保存済み）'}</p>}
        <div className="row gap wrap">
          <button type="button" className="btn primary" disabled={!dirty || errors.length > 0} onClick={() => dispatch({ type: 'setDeck', deck: draft })} data-testid="deck-save">保存</button>
          <button type="button" className="btn plain" onClick={() => dispatch({ type: 'autoDeck' })} data-testid="deck-auto">自動調整</button>
          <button type="button" className="btn plain" onClick={() => dispatch({ type: 'resetDeck' })} data-testid="deck-reset">おすすめにリセット</button>
          <button type="button" className="btn ghost" disabled={!dirty} onClick={() => setDraft(s.deck)}>変更を破棄</button>
        </div>
        <p className="muted small">未編成の所持カードが{diffNew}種類あります。{s.live ? '※ライブ中のデッキはライブ開始時点のものを使用します。' : ''}</p>
      </section>

      <div className="minibar" data-testid="deck-minibar">
        <b className={draft.length === DECK_SIZE ? 'ok-text' : 'ng-text'}>{draft.length}/{DECK_SIZE}</b>
        <span className="small">{errors.length ? '⚠ 違法' : dirty ? '未保存' : '保存済み'}</span>
        <button type="button" className="btn primary small" disabled={!dirty || errors.length > 0} onClick={() => dispatch({ type: 'setDeck', deck: draft })}>保存</button>
      </div>
      <section className="panel">
        <h3>所持カード（＋で追加、−で外す）</h3>
        <div className="deck-rows">
          {owned.map((c) => {
            const n = counts[c.id] ?? 0;
            const reason = addReason(c.id);
            return (
              <div key={c.id} className="deck-row" data-testid={`deckrow-${c.id}`}>
                <CardTile card={c} owned={s.collection[c.id] ?? 0} inDeck={n} isNew={newSet.has(c.id)} />
                <div className="stepper">
                  <button type="button" className="btn plain" onClick={() => remove(c.id)} disabled={n === 0} aria-label={`${c.name}を外す`} data-testid={`rm-${c.id}`}>−</button>
                  <b>{n}</b>
                  <button type="button" className="btn pink" onClick={() => add(c.id)} disabled={!!reason} aria-label={`${c.name}を追加`} data-testid={`add-${c.id}`}>＋</button>
                </div>
                {reason && n < (s.collection[c.id] ?? 0) && <p className="reason">{reason}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
