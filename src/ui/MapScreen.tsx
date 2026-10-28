import { useEffect, useRef, useState } from 'react';
import {
  ASSETS, blockReason, CITY_MAP, MOVE_STAMINA, REGION_LABEL, SPOTS, SPOT_TYPE_LABEL, SONG_TYPE_LABEL, CITIES,
  neighbors, shortestPath, yen, currentConcert, CONCERTS,
  type CityId, type GameState,
} from '../game';
import { ActionButton } from './common';
import { FxLayer, useDeltaFx } from './fx';
import { Icon, modeIcon } from './icons';
import { JapanBoard } from './JapanBoard';
import type { Dispatch } from './useGame';

interface Arrival { id: number; city: CityId }

export function MapScreen({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  const [sel, setSel] = useState<CityId>(s.city);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const { run, items, seq } = useDeltaFx(s, dispatch);
  const city = CITY_MAP[sel];
  const here = sel === s.city;
  const adj = neighbors(s.city).find((n) => n.to === sel);
  const path = !here && !adj ? shortestPath(s.city, sel) : null;
  const firstHop = path ? path.path[1] : undefined;
  const hopRoute = firstHop ? neighbors(s.city).find((n) => n.to === firstHop)?.route : undefined;
  const concert = currentConcert(s);
  const venueCity = concert && s.concerts[concert.id]?.status === 'pending' ? concert.city : null;
  const spots = SPOTS.filter((x) => x.city === sel);
  const spotsLeft = spots.filter((x) => !s.visitedSpots.includes(x.id)).length;

  // 到着スタンプ：この画面で移動に成功したときだけ出す。短く自動で消え、タップ/Escでも閉じられる。
  const arrivalTimer = useRef<number | undefined>(undefined);
  const closeArrival = () => { window.clearTimeout(arrivalTimer.current); setArrival(null); };
  useEffect(() => () => window.clearTimeout(arrivalTimer.current), []);
  useEffect(() => {
    if (!arrival) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeArrival(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [arrival]);
  const moveTo = (to: CityId): boolean => {
    if (!run({ type: 'move', to })) return false;
    window.clearTimeout(arrivalTimer.current);
    setArrival({ id: Date.now(), city: to });
    arrivalTimer.current = window.setTimeout(() => setArrival(null), 2400);
    return true;
  };

  return (
    <div className="screen mapscreen">
      <FxLayer items={items} seq={seq} />
      {arrival && (
        <button type="button" className="arrival" key={arrival.id} onClick={closeArrival} data-testid="arrival-stamp" aria-label={`${CITY_MAP[arrival.city].name}に到着しました。タップで閉じる`}>
          <span className="arrival-stamp">
            <Icon name="stamp" />
            <small>{REGION_LABEL[CITY_MAP[arrival.city].region]} ・ ARRIVED</small>
            <b>{CITY_MAP[arrival.city].name}到着！</b>
          </span>
        </button>
      )}
      <section className="panel board-panel">
        <div className="row between">
          <h2><Icon name="map" /> 全国旅行盤面 <small className="muted">（模式図）</small></h2>
          <span className="chip">旅券 {s.visitedCities.length}/{CITIES.length}</span>
        </div>
        <JapanBoard s={s} sel={sel} venueCity={venueCity} onSelect={setSel} />
        <ul className="legend" aria-label="凡例">
          <li><i className="lg-rail" />鉄道・新幹線</li>
          <li><i className="lg-air" />空路（2AP）</li>
          <li><i className="lg-bus" />高速バス</li>
          <li><i className="lg-venue" />今週の公演会場</li>
        </ul>
      </section>

      <section className="panel ticket-panel" data-testid="city-panel">
        <div className="travel-ticket">
          <div className="tt-main">
            <p className="eyebrow">{here ? 'YOU ARE HERE' : 'TRAVEL TICKET'}</p>
            <h2>{city.name} <small className="muted">{REGION_LABEL[city.region]}</small></h2>
            <p className="tt-route">
              {here ? <><Icon name="pin" /> 現在地</> : <><span>{CITY_MAP[s.city].name}</span><Icon name="rail" /><b>{city.name}</b></>}
            </p>
          </div>
          <div className="tt-stub" aria-hidden="true">
            <b>{spots.length}</b><small>スポット</small>
            <span>{spotsLeft ? `未探索${spotsLeft}` : '制覇！'}</span>
          </div>
        </div>
        {venueCity === sel && concert && <p className="chip type venue-chip"><Icon name="mic" /> 今週の公演会場「{concert.name}」</p>}

        {!here && adj && (
          <>
            <ul className="fare" aria-label="運賃">
              <li><Icon name={modeIcon(adj.route.mode)} />{adj.route.mode}</li>
              <li><Icon name="bolt" />{adj.route.ap}AP</li>
              <li><Icon name="coin" />{yen(adj.route.money)}</li>
              <li><Icon name="heart" />体力-{MOVE_STAMINA}</li>
            </ul>
            <ActionButton label={`${city.name}へ移動`} sub={`${adj.route.ap}AP・${yen(adj.route.money)}・${adj.route.mode}`} tone="primary" testId="move-btn"
              reason={blockReason(s, { type: 'move', to: sel })} onClick={() => moveTo(sel)} />
          </>
        )}
        {!here && !adj && path && firstHop && hopRoute && (
          <>
            <ol className="stations" aria-label="最短経路">
              {path.path.map((id) => <li key={id} className={id === s.city ? 'from' : id === sel ? 'to' : ''}>{CITY_MAP[id].name}</li>)}
            </ol>
            <p className="muted">直通経路はありません。最短経路：{path.path.map((id) => CITY_MAP[id].name).join(' → ')}（合計 {path.ap}AP・{yen(path.money)}）</p>
            <ActionButton label={`まず${CITY_MAP[firstHop].name}へ移動`} sub={`${hopRoute.ap}AP・${yen(hopRoute.money)}`} testId="move-hop-btn"
              reason={blockReason(s, { type: 'move', to: firstHop })} onClick={() => { if (moveTo(firstHop)) setSel(firstHop); }} />
          </>
        )}

        {here && (
          <>
            <h3>街ガイド：スポット（探索：1AP・入場費・体力。1か所1回・カード三択）</h3>
            <ul className="spots">
              {spots.map((sp) => {
                const done = s.visitedSpots.includes(sp.id);
                const reason = blockReason(s, { type: 'explore', spotId: sp.id });
                return (
                  <li key={sp.id} className={`spot t${sp.tier}${done ? ' done' : ''}`}>
                    <div className="spot-head">
                      <span className="spot-icon" aria-hidden="true"><Icon name={sp.type} /></span>
                      <div>
                        <b>{sp.name}</b>
                        <small>{SPOT_TYPE_LABEL[sp.type]}・{'★'.repeat(sp.tier)}・{SONG_TYPE_LABEL[sp.songType]}・推し傾向 {sp.members.join('/')}</small>
                      </div>
                    </div>
                    <p className="muted small">{sp.blurb} 入場費{yen(sp.fee)}・体力-{sp.stamina}
                      {sp.reward.money ? `・報酬 ${yen(sp.reward.money)}` : ''}{sp.reward.stamina ? `・体力+${sp.reward.stamina}` : ''}
                      ／収集品「{sp.souvenir}」</p>
                    {done ? <span className="chip ok"><Icon name="check" /> 探索済み</span> : (
                      <ActionButton label="ここを探索する" sub="1AP" tone="pink" testId={`explore-${sp.id}`} reason={reason}
                        onClick={() => run({ type: 'explore', spotId: sp.id })} />
                    )}
                  </li>
                );
              })}
            </ul>

            {ASSETS.some((a) => a.city === sel) && (
              <>
                <h3>ゲーム内資産の購入（1AP・※すべて架空の資産です）</h3>
                <ul className="spots">
                  {ASSETS.filter((a) => a.city === sel).map((a) => {
                    const owned = s.assets.includes(a.id);
                    return (
                      <li key={a.id} className={`spot${owned ? ' done' : ''}`}>
                        <b>{a.name}</b>
                        <p className="muted small">{a.blurb} 価格{yen(a.price)}</p>
                        {owned ? <span className="chip ok"><Icon name="check" /> 所有中</span> : (
                          <ActionButton label={`購入 ${yen(a.price)}`} testId={`buy-${a.id}`} reason={blockReason(s, { type: 'buyAsset', assetId: a.id })}
                            onClick={() => run({ type: 'buyAsset', assetId: a.id })} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
        {!here && spots.length > 0 && <p className="muted small">この街には探索スポットが{spots.length}か所あります（未探索{spotsLeft}）。移動して探索しよう。</p>}
        {!here && ASSETS.some((a) => a.city === sel) && <p className="muted small">この都市には購入できる架空資産があります。移動して確認しよう。</p>}
      </section>

      <section className="panel">
        <h3>他の資産・公演会場</h3>
        <ul className="plain-list iconlist">
          {ASSETS.map((a) => <li key={a.id} className={s.assets.includes(a.id) ? 'own' : ''}><Icon name={s.assets.includes(a.id) ? 'check' : 'star'} /> {a.name} — {CITY_MAP[a.city].name}（{yen(a.price)}）</li>)}
          {CONCERTS.map((c) => <li key={c.id}><Icon name="mic" /> 第{c.week}週 {c.name} — {CITY_MAP[c.city].name}（{c.venue}）</li>)}
        </ul>
      </section>
    </div>
  );
}
