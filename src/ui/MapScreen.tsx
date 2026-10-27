import { useState } from 'react';
import {
  ASSETS, blockReason, CITIES, CITY_MAP, REGION_LABEL, ROUTES, SPOTS, SPOT_TYPE_ICON, SPOT_TYPE_LABEL, SONG_TYPE_LABEL,
  neighbors, shortestPath, yen, currentConcert, CONCERTS,
  type CityId, type GameState,
} from '../game';
import { ActionButton } from './common';
import type { Dispatch } from './useGame';

export function MapScreen({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  const [sel, setSel] = useState<CityId>(s.city);
  const city = CITY_MAP[sel];
  const here = sel === s.city;
  const adj = neighbors(s.city).find((n) => n.to === sel);
  const path = !here && !adj ? shortestPath(s.city, sel) : null;
  const firstHop = path ? path.path[1] : undefined;
  const hopRoute = firstHop ? neighbors(s.city).find((n) => n.to === firstHop)?.route : undefined;
  const concert = currentConcert(s);
  const venueCity = concert && s.concerts[concert.id]?.status === 'pending' ? concert.city : null;

  return (
    <div className="screen">
      <section className="panel">
        <h2>全国マップ <small className="muted">（模式図）</small></h2>
        <svg viewBox="0 0 360 520" className="map" role="img" aria-label="全国12都市の移動マップ">
          <defs>
            <linearGradient id="routeg" x1="0" x2="1">
              <stop offset="0" stopColor="#4aa3ff" /><stop offset="1" stopColor="#ff5fb7" />
            </linearGradient>
          </defs>
          {ROUTES.map((r) => {
            const a = CITY_MAP[r.a];
            const b = CITY_MAP[r.b];
            const hot = r.a === s.city || r.b === s.city;
            return <line key={`${r.a}-${r.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`route${hot ? ' hot' : ''}${r.ap === 2 ? ' far' : ''}`} />;
          })}
          {CITIES.map((c) => {
            const visited = s.visitedCities.includes(c.id);
            const isHere = c.id === s.city;
            const isVenue = venueCity === c.id;
            return (
              <g key={c.id} transform={`translate(${c.x},${c.y})`} className={`node${visited ? ' visited' : ''}${isHere ? ' here' : ''}${sel === c.id ? ' sel' : ''}`}
                role="button" tabIndex={0} aria-label={`${c.name}${isHere ? '（現在地）' : ''}`}
                onClick={() => setSel(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(c.id); }}
                data-testid={`city-${c.id}`}>
                <circle r="22" className="hit" />
                <circle r={isHere ? 12 : 9} className="dot" />
                {isVenue && <circle r="16" className="venue-ring" />}
                <text y="-16" textAnchor="middle" className="city-label">{c.name}</text>
                {isHere && <text x="16" y="-2" textAnchor="start" className="here-label">現在地</text>}
                {isVenue && !isHere && <text x="16" y="-2" textAnchor="start" className="venue-label">会場</text>}
              </g>
            );
          })}
        </svg>
        <p className="muted small">点線は2APの長距離ルート。●は訪問済み。🎤リングは今週の公演会場。</p>
      </section>

      <section className="panel" data-testid="city-panel">
        <div className="row between">
          <h2>{city.name} <small className="muted">{REGION_LABEL[city.region]}</small></h2>
          {here ? <span className="chip">現在地</span> : null}
        </div>

        {!here && adj && (
          <ActionButton label={`${city.name}へ移動`} sub={`${adj.route.ap}AP・${yen(adj.route.money)}・${adj.route.mode}`} tone="primary" testId="move-btn"
            reason={blockReason(s, { type: 'move', to: sel })} onClick={() => dispatch({ type: 'move', to: sel })} />
        )}
        {!here && !adj && path && firstHop && hopRoute && (
          <>
            <p className="muted">直通経路はありません。最短経路：{path.path.map((id) => CITY_MAP[id].name).join(' → ')}（合計 {path.ap}AP・{yen(path.money)}）</p>
            <ActionButton label={`まず${CITY_MAP[firstHop].name}へ移動`} sub={`${hopRoute.ap}AP・${yen(hopRoute.money)}`} testId="move-hop-btn"
              reason={blockReason(s, { type: 'move', to: firstHop })} onClick={() => { dispatch({ type: 'move', to: firstHop }); setSel(firstHop); }} />
          </>
        )}

        {here && (
          <>
            <h3>スポット（探索：1AP・入場費・体力。1か所1回・カード三択）</h3>
            <ul className="spots">
              {SPOTS.filter((x) => x.city === sel).map((sp) => {
                const done = s.visitedSpots.includes(sp.id);
                const reason = blockReason(s, { type: 'explore', spotId: sp.id });
                return (
                  <li key={sp.id} className={`spot${done ? ' done' : ''}`}>
                    <div className="spot-head">
                      <span className="spot-icon" aria-hidden="true">{SPOT_TYPE_ICON[sp.type]}</span>
                      <div>
                        <b>{sp.name}</b>
                        <small>{SPOT_TYPE_LABEL[sp.type]}・★{sp.tier}・{SONG_TYPE_LABEL[sp.songType]}・推し傾向 {sp.members.join('/')}</small>
                      </div>
                    </div>
                    <p className="muted small">{sp.blurb} 入場費{yen(sp.fee)}・体力-{sp.stamina}
                      {sp.reward.money ? `・報酬 ${yen(sp.reward.money)}` : ''}{sp.reward.stamina ? `・体力+${sp.reward.stamina}` : ''}
                      ／収集品「{sp.souvenir}」</p>
                    {done ? <span className="chip ok">探索済み ✓</span> : (
                      <ActionButton label="ここを探索する" sub="1AP" tone="pink" testId={`explore-${sp.id}`} reason={reason}
                        onClick={() => dispatch({ type: 'explore', spotId: sp.id })} />
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
                        {owned ? <span className="chip ok">所有中 ✓</span> : (
                          <ActionButton label={`購入 ${yen(a.price)}`} testId={`buy-${a.id}`} reason={blockReason(s, { type: 'buyAsset', assetId: a.id })}
                            onClick={() => dispatch({ type: 'buyAsset', assetId: a.id })} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
        {!here && ASSETS.some((a) => a.city === sel) && <p className="muted small">この都市には購入できる架空資産があります。移動して確認しよう。</p>}
      </section>

      <section className="panel">
        <h3>他の資産・公演会場</h3>
        <ul className="plain-list">
          {ASSETS.map((a) => <li key={a.id}>{s.assets.includes(a.id) ? '✅' : '▫️'} {a.name} — {CITY_MAP[a.city].name}（{yen(a.price)}）</li>)}
          {CONCERTS.map((c) => <li key={c.id}>🎤 第{c.week}週 {c.name} — {CITY_MAP[c.city].name}（{c.venue}）</li>)}
        </ul>
      </section>
    </div>
  );
}
