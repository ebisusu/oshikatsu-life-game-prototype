// 自作SVG/CSSのアート部品（外部画像・実在の写真/ロゴは使わない）。
import { CONCERTS, TOTAL_WEEKS, type CardDef, type CardKind, type GameState, type SongType } from '../game';
import { Icon, type IconName } from './icons';
import { MEMBER_COLOR } from './palette';

// ---------- ホームのポスター ----------
const STARS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 53 + 17) % 352 + 4, y: (i * 29 + 7) % 78 + 4, r: i % 5 === 0 ? 1.6 : 1, d: (i % 7) * 0.4,
}));
const TOWERS = [
  [6, 44, 20], [28, 60, 16], [46, 36, 22], [70, 52, 14], [86, 66, 20], [110, 40, 18], [132, 58, 24],
  [226, 46, 20], [248, 62, 16], [266, 38, 22], [290, 54, 18], [310, 44, 20], [334, 58, 22],
] as const;

export function HomeScene({ live }: { live: boolean }) {
  return (
    <svg className={`home-scene${live ? ' is-live' : ''}`} viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hs-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b0820" /><stop offset=".55" stopColor="#2a1a6a" /><stop offset="1" stopColor="#8a3a9a" />
        </linearGradient>
        <linearGradient id="hs-b1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4aa3ff" stopOpacity=".85" /><stop offset="1" stopColor="#4aa3ff" stopOpacity="0" /></linearGradient>
        <linearGradient id="hs-b2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff5fb7" stopOpacity=".85" /><stop offset="1" stopColor="#ff5fb7" stopOpacity="0" /></linearGradient>
        <radialGradient id="hs-moon" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff6d6" /><stop offset=".6" stopColor="#ffd36b" stopOpacity=".5" /><stop offset="1" stopColor="#ffd36b" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="360" height="150" fill="url(#hs-sky)" />
      {STARS.map((s, i) => <circle key={i} className="hs-star" cx={s.x} cy={s.y} r={s.r} fill="#fff" style={{ animationDelay: `${s.d}s` }} />)}
      <circle cx="304" cy="30" r="26" fill="url(#hs-moon)" />
      <circle cx="304" cy="30" r="10" fill="#fff3c8" />
      <g className="hs-beams">
        <polygon className="hs-beam b1" points="96,150 108,150 150,0 70,0" fill="url(#hs-b1)" />
        <polygon className="hs-beam b2" points="176,150 190,150 232,0 150,0" fill="url(#hs-b2)" />
        <polygon className="hs-beam b3" points="250,150 262,150 330,0 250,0" fill="url(#hs-b1)" />
      </g>
      <path d="M0 112 Q60 92 120 108 T240 104 T360 110 V150 H0Z" fill="#1a1050" opacity=".9" />
      {TOWERS.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={134 - h} width={w} height={h + 16} fill={i % 2 ? '#150d3d' : '#1c1250'} />
          {Array.from({ length: Math.floor(h / 12) }).map((_, j) => (
            <rect key={j} x={x + 3 + ((i + j) % 2) * 6} y={134 - h + 5 + j * 12} width="3" height="4" fill={(i + j) % 3 === 0 ? '#ffd36b' : '#7fb6ff'} opacity=".7" />
          ))}
        </g>
      ))}
      {/* 中央の会場（ドーム）。ライブ週は照明が強まる */}
      <g>
        <path d="M150 140 Q150 96 180 96 T210 140Z" fill="#241862" stroke="#ff5fb7" strokeWidth="1.2" strokeOpacity=".8" />
        <path d="M162 140 Q162 108 180 108 T198 140Z" fill="#150d3d" />
        <rect x="174" y="116" width="12" height="24" rx="2" fill="#ffd36b" opacity={live ? 0.95 : 0.55} />
        <path d="M180 96V84M176 88h8" stroke="#ff5fb7" strokeWidth="1.6" strokeLinecap="round" />
        <circle className="hs-pulse" cx="180" cy="82" r="3" fill="#ff5fb7" />
      </g>
      <rect y="140" width="360" height="10" fill="#0b0820" />
      <path d="M0 145H360" stroke="#4aa3ff" strokeWidth="1" strokeDasharray="6 8" opacity=".6" />
    </svg>
  );
}

// ---------- 12週の旅程トラック ----------
export function JourneyTrack({ s }: { s: GameState }) {
  const liveWeeks = new Set(CONCERTS.map((c) => c.week));
  return (
    <ol className="journey" aria-label={`12週の旅程。いま第${s.week}週`} data-testid="journey">
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => {
        const w = i + 1;
        const live = liveWeeks.has(w);
        const rec = CONCERTS.find((c) => c.week === w);
        const st = s.concerts[rec?.id ?? '']?.status;
        const cls = `${w < s.week ? 'past' : w === s.week ? 'now' : 'future'}${live ? ' live' : ''}${st === 'done' ? ' done' : st === 'missed' ? ' missed' : ''}`;
        return (
          <li key={w} className={`jn ${cls}`} aria-current={w === s.week ? 'step' : undefined}>
            <span className="jn-dot">{live ? <Icon name={st === 'done' ? 'check' : 'mic'} /> : w === s.week ? <Icon name="pin" /> : null}</span>
            <span className="jn-num">{w}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- カードのイラスト帯 ----------
const KIND_ICON: Record<CardKind, IconName> = { action: 'bolt', support: 'heart', combo: 'link', finisher: 'sparkle' };

function Motif({ type, color }: { type: SongType; color: string }) {
  switch (type) {
    case 'call':
      return <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".55">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M60 46 L${12 + i * 12} 2`} />)}</g>;
    case 'unit':
      return <g fill={color} opacity=".4"><circle cx="46" cy="26" r="16" /><circle cx="70" cy="26" r="16" /></g>;
    case 'ballad':
      return <g fill="none" stroke={color} strokeWidth="2" opacity=".55">{[0, 1, 2].map((i) => <path key={i} d={`M0 ${18 + i * 9} Q30 ${6 + i * 9} 60 ${18 + i * 9} T120 ${18 + i * 9}`} />)}</g>;
    default:
      return <g fill={color} opacity=".5">{[[20, 14, 5], [48, 32, 7], [76, 12, 6], [100, 30, 5], [62, 20, 4]].map(([x, y, r], i) => <path key={i} d={`M${x} ${y! - r!}l${r! * 0.35} ${r! * 0.65} ${r! * 0.65} ${r! * 0.35}-${r! * 0.65} ${r! * 0.35}-${r! * 0.35} ${r! * 0.65}-${r! * 0.35}-${r! * 0.65}-${r! * 0.65}-${r! * 0.35} ${r! * 0.65}-${r! * 0.35}z`} />)}</g>;
  }
}

export function CardArt({ card }: { card: CardDef }) {
  const color = MEMBER_COLOR[card.member];
  const stars = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 }[card.rarity];
  return (
    <div className={`card-art art-${card.rarity}`} style={{ ['--mc' as string]: color }} aria-hidden="true">
      <svg viewBox="0 0 120 46" preserveAspectRatio="xMidYMid slice" focusable="false">
        <Motif type={card.songType} color="#fff" />
        <text x="104" y="40" textAnchor="end" className="art-letter" fill="#fff" opacity=".35" fontSize="44" fontWeight="900">{card.member}</text>
      </svg>
      <span className="art-kind"><Icon name={KIND_ICON[card.kind]} /></span>
      <span className="art-stars">{Array.from({ length: stars }, (_, i) => <Icon key={i} name="star" />)}</span>
    </div>
  );
}

// ---------- トロフィーのメダル ----------
export function Medal({ on, locked, tier }: { on: boolean; locked?: boolean; tier: number }) {
  const gold = tier % 3 === 0;
  const c1 = on ? (gold ? '#ffe28a' : tier % 3 === 1 ? '#ff9ad6' : '#8fd0ff') : '#4a4270';
  const c2 = on ? (gold ? '#d8982a' : tier % 3 === 1 ? '#c2428f' : '#3d7fd8') : '#2c2650';
  const id = `md-${tier}-${on ? 1 : 0}`;
  return (
    <svg className={`medal${on ? ' on' : ''}`} viewBox="0 0 48 56" aria-hidden="true" focusable="false">
      <defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
      <path d="M14 2h8l4 18h-8zM34 2h-8l-4 18h8z" fill={on ? '#ff5fb7' : '#3a3366'} />
      <circle cx="24" cy="34" r="17" fill={`url(#${id})`} stroke={on ? '#fff7d6' : '#5a5090'} strokeWidth="2" />
      <circle cx="24" cy="34" r="12" fill="none" stroke="#ffffff" strokeOpacity={on ? 0.55 : 0.2} strokeWidth="1.5" strokeDasharray="2 3" />
      {locked ? (
        <path d="M19 36v-4a5 5 0 0 1 10 0v4M17 36h14v8H17z" fill="#9d93d9" opacity=".8" />
      ) : on ? (
        <path d="m24 26 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="#fff" />
      ) : (
        <circle cx="24" cy="34" r="3.5" fill="#6a60a8" />
      )}
    </svg>
  );
}
