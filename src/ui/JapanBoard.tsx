// 日本列島の模式図による「旅する盤面」。地形は概略の自作イラストで、正確な地図ではない。
// 都市の座標（CITIES.x/y）と経路（ROUTES）はゲームデータそのものを使う。
import { CITIES, CITY_MAP, REGION_LABEL, ROUTES, shortestPath, type CityId, type GameState, type RegionId } from '../game';

const HOKKAIDO = 'M238 62C236 42 262 24 286 19C312 10 342 22 350 45C354 64 331 78 313 75C301 94 270 94 262 84C250 82 240 74 238 62Z';
const HONSHU = 'M286 98C304 102 318 124 316 150C314 176 306 192 302 212C306 222 300 232 290 236C282 244 278 258 266 280C254 286 244 296 234 296C224 290 214 286 206 292C196 286 192 282 188 286C182 304 176 322 170 326C162 326 152 318 148 312C142 306 134 302 122 300C108 306 94 306 80 313C72 322 70 336 64 343C48 345 30 342 16 331C14 322 22 316 34 310C52 297 78 285 98 273C118 262 134 252 144 244C152 240 164 232 172 220C182 204 194 184 202 172C210 160 216 166 226 172C232 160 240 146 244 132C248 118 256 110 268 98C274 94 280 94 286 98Z';
const SHIKOKU = 'M96 341C104 327 128 321 150 327C161 333 153 349 134 353C114 357 98 353 96 341Z';
const KYUSHU = 'M18 361C27 350 52 350 66 358C79 356 97 366 103 381C113 393 109 417 121 437C131 453 135 477 121 493C105 507 88 491 82 475C76 471 70 463 62 457C48 451 36 441 34 427C28 413 22 397 22 383C16 375 14 367 18 361Z';
const ISLETS = ['M205 150a5 8 -20 1 0 8 4z', 'M58 270a6 3 -15 1 0 9 2z', 'M132 308a3 7 20 1 0 5 3z', 'M8 392a4 2 0 1 0 7 1z'];

const REGION_TINT: Record<RegionId, string> = {
  hokkaido: '#6ec6ff', tohoku: '#7be0b0', kanto: '#ff8ad8', chubu: '#ffd36b', kinki: '#ff9a6b', chugoku: '#b793ff', kyushu: '#ff6f91',
};

/** 2都市を結ぶ、ほんのり曲がった路線のパス */
function routePath(a: { x: number; y: number }, b: { x: number; y: number }, bend: number): { d: string; mx: number; my: number; ang: number } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bend * len;
  const cy = my + (dx / len) * bend * len;
  // 2次ベジェの中点
  const px = 0.25 * a.x + 0.5 * cx + 0.25 * b.x;
  const py = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
  return { d: `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`, mx: px, my: py, ang: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** 都市名の置き場所。近接する都市同士（京都/名古屋、東京/横浜…）の文字が重ならないよう個別に調整する */
const LABEL_POS: Partial<Record<CityId, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }>> = {
  tokyo: { dx: 12, dy: 4, anchor: 'start' },
  yokohama: { dx: 12, dy: 5, anchor: 'start' },
  nagoya: { dx: 0, dy: -12, anchor: 'middle' },
  kyoto: { dx: -10, dy: 15, anchor: 'end' },
  kobe: { dx: -11, dy: 4, anchor: 'end' },
  osaka: { dx: 2, dy: 21, anchor: 'middle' },
};

export interface BoardProps {
  s: GameState;
  sel: CityId;
  venueCity: CityId | null;
  onSelect: (id: CityId) => void;
}

export function JapanBoard({ s, sel, venueCity, onSelect }: BoardProps) {
  const planned = new Set<string>();
  if (sel !== s.city) {
    const sp = shortestPath(s.city, sel);
    if (sp) for (let i = 0; i < sp.path.length - 1; i++) planned.add([sp.path[i], sp.path[i + 1]].sort().join('|'));
  }
  return (
    <svg viewBox="0 0 360 520" className="board" role="group" aria-label="日本列島の旅行盤面（模式図）。12都市を選べます" data-testid="board">
      <defs>
        <linearGradient id="bd-sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10215a" /><stop offset="1" stopColor="#0a1238" /></linearGradient>
        <pattern id="bd-wave" width="22" height="12" patternUnits="userSpaceOnUse"><path d="M0 7q5.5-5 11 0t11 0" fill="none" stroke="#4aa3ff" strokeOpacity=".16" strokeWidth="1" /></pattern>
        <linearGradient id="bd-land" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#3a2f86" /><stop offset="1" stopColor="#241a62" /></linearGradient>
        <linearGradient id="bd-hot" x1="0" x2="1"><stop offset="0" stopColor="#4aa3ff" /><stop offset="1" stopColor="#ff5fb7" /></linearGradient>
        <filter id="bd-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
        <clipPath id="bd-clip"><path d={HOKKAIDO} /><path d={HONSHU} /><path d={SHIKOKU} /><path d={KYUSHU} /></clipPath>
        <radialGradient id="bd-spot" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffd36b" stopOpacity=".75" /><stop offset="1" stopColor="#ffd36b" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="360" height="520" fill="url(#bd-sea)" />
      <rect width="360" height="520" fill="url(#bd-wave)" />
      <g className="bd-grid" stroke="#9fd0ff" strokeOpacity=".08" strokeDasharray="2 6">
        {[100, 200, 300, 400].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} />)}
        {[90, 180, 270].map((x) => <line key={x} y1="0" y2="520" x1={x} x2={x} />)}
      </g>
      {/* 陸地：外縁の光 → 本体 → 区域の色 → 縁取り */}
      <g className="bd-land">
        <g fill="none" stroke="#6a8cff" strokeOpacity=".35" strokeWidth="7" strokeLinejoin="round">
          <path d={HOKKAIDO} /><path d={HONSHU} /><path d={SHIKOKU} /><path d={KYUSHU} />
        </g>
        <g fill="url(#bd-land)"><path d={HOKKAIDO} /><path d={HONSHU} /><path d={SHIKOKU} /><path d={KYUSHU} /></g>
        <g clipPath="url(#bd-clip)"><g filter="url(#bd-soft)">
          <rect x="230" y="0" width="130" height="96" fill={REGION_TINT.hokkaido} opacity=".14" />
          <rect x="225" y="96" width="135" height="94" fill={REGION_TINT.tohoku} opacity=".15" />
          <rect x="228" y="190" width="132" height="110" fill={REGION_TINT.kanto} opacity=".15" />
          <rect x="168" y="150" width="62" height="150" fill={REGION_TINT.chubu} opacity=".15" />
          <rect x="118" y="225" width="52" height="93" fill={REGION_TINT.kinki} opacity=".16" />
          <rect x="0" y="262" width="118" height="95" fill={REGION_TINT.chugoku} opacity=".16" />
          <rect x="0" y="348" width="150" height="172" fill={REGION_TINT.kyushu} opacity=".15" />
        </g></g>
        <g fill="none" stroke="#b9b0e8" strokeOpacity=".55" strokeWidth="1.4" strokeLinejoin="round">
          <path d={HOKKAIDO} /><path d={HONSHU} /><path d={SHIKOKU} /><path d={KYUSHU} />
        </g>
        <g fill="#2f2478" stroke="#b9b0e8" strokeOpacity=".4">{ISLETS.map((d) => <path key={d} d={d} />)}</g>
      </g>
      {/* 区域名（地図の雰囲気づくり） */}
      <g className="bd-region" aria-hidden="true">
        <text x="318" y="12">{REGION_LABEL.hokkaido}</text>
        <text x="310" y="126">{REGION_LABEL.tohoku}</text>
        <text x="304" y="278">{REGION_LABEL.kanto}</text>
        <text x="186" y="190">{REGION_LABEL.chubu}</text>
        <text x="186" y="338">{REGION_LABEL.kinki}</text>
        <text x="30" y="290">{REGION_LABEL.chugoku}</text>
        <text x="22" y="504">{REGION_LABEL.kyushu}</text>
      </g>
      {/* 路線：下地 → 破線の線路 / 空路の点線 */}
      <g className="bd-routes" fill="none" strokeLinecap="round">
        {ROUTES.map((r) => {
          const a = CITY_MAP[r.a];
          const b = CITY_MAP[r.b];
          const air = r.mode.includes('飛行機');
          const key = [r.a, r.b].sort().join('|');
          const hot = r.a === s.city || r.b === s.city;
          const path = routePath(a, b, air ? 0.2 : r.mode.includes('バス') ? 0.08 : 0.04);
          return (
            <g key={key} className={`bd-route ${air ? 'air' : r.mode.includes('バス') ? 'bus' : 'rail'}${hot ? ' hot' : ''}${planned.has(key) ? ' plan' : ''}`}>
              {!air && <path d={path.d} className="rt-bed" />}
              <path d={path.d} className="rt-line" />
              {air && <g transform={`translate(${path.mx} ${path.my})`} className="rt-plane"><circle r="6" className="rt-badge" /><path d="M-3.8 -2.8 L4 0 L-3.8 2.8 L-2 0Z" className="rt-plane-body" transform={`rotate(${path.ang})`} /></g>}
            </g>
          );
        })}
      </g>
      {/* 都市（駅） */}
      {CITIES.map((c) => {
        const visited = s.visitedCities.includes(c.id);
        const isHere = c.id === s.city;
        const isVenue = venueCity === c.id;
        const isSel = sel === c.id;
        return (
          <g key={c.id} transform={`translate(${c.x},${c.y})`}
            className={`bd-node${visited ? ' visited' : ''}${isHere ? ' here' : ''}${isSel ? ' sel' : ''}${isVenue ? ' venue' : ''}`}
            role="button" tabIndex={0} aria-label={`${c.name}${isHere ? '（現在地）' : ''}${isVenue ? '（今週の会場）' : ''}${visited ? '（訪問済み）' : ''}`}
            aria-pressed={isSel}
            onClick={() => onSelect(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.id); } }}
            data-testid={`city-${c.id}`}>
            <circle r="22" className="hit" />
            {isVenue && <circle r="26" fill="url(#bd-spot)" className="bd-spotlight" />}
            {isVenue && <circle r="16" className="venue-ring" />}
            {isSel && <circle r="15" className="sel-ring" />}
            <circle r={isHere ? 9 : 7} className="st-dot" style={{ ['--tint' as string]: REGION_TINT[c.region] }} />
            {visited && !isHere && <path d="m-3.2 0.2 2.2 2.4 4.4-4.8" className="st-check" />}
            {isHere && <circle r="13" className="here-halo" />}
            {isHere && (
              <g className="bd-token">
                <path d="M0 -10C-7 -10 -9 -17 -9 -21a9 9 0 0 1 18 0c0 4 -2 11 -9 11z" className="tk-body" />
                <circle cy="-21" r="3.4" className="tk-eye" />
              </g>
            )}
            {isVenue && <g className="bd-mic" transform="translate(9 -22)"><circle r="6.5" /><rect x="-1.7" y="-4" width="3.4" height="5.6" rx="1.7" className="mic-body" /><path d="M-3.2 0.4a3.2 3.2 0 0 0 6.4 0M0 3.6v1.6" className="mic-stand" /></g>}
            <text x={(LABEL_POS[c.id]?.dx ?? 0)} y={LABEL_POS[c.id]?.dy ?? (isHere ? 22 : 20)} textAnchor={LABEL_POS[c.id]?.anchor ?? 'middle'} className="bd-label">{c.name}</text>
          </g>
        );
      })}
      <text x="352" y="514" textAnchor="end" className="bd-note">模式図（実際の地形・距離とは異なります）</text>
    </svg>
  );
}
