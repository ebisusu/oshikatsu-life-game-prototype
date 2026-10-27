// ライブバトルエンジン（UI非依存・決定的）。
// 1公演=4曲。1曲=各4EP、前半は合計2EPまで、後半は残りEP。プレイヤーとCPUは同じルールで進行する。
import { CARD_MAP, isHighRarity } from './data/cards';
import { CONCERT_MAP } from './data/world';
import { resolveEffect, type EffectCtx, type EffectResult } from './effects';
import { rand, randInt, shuffle } from './rng';
import {
  FIRST_HALF_EP, HAND_LIMIT, KIND_LABEL, MAX_PLAYS_PER_SONG, METERS, METER_LABEL, SONG_EP, SONGS_PER_LIVE,
  type CardDef, type Gain3, type LiveMode, type LiveSide, type LiveState, type OshiType,
  type PlayedRec, type MemberId, type Who, type SongType, type LogEntry,
} from './types';

export interface SideConfig {
  name: string;
  oshi: OshiType;
  member: MemberId | null;
  deck: string[];
  skills: Gain3;
  assetBonus: Gain3;
  gainMult: number;
  startHand: number;
}

const ZERO = (): Gain3 => ({ h: 0, u: 0, m: 0 });

/** 曲タイプごとのメーター補正（曲の特性） */
export const SONG_METER_MOD: Record<SongType, Gain3> = {
  call: { h: 1.3, u: 1, m: 1 },
  unit: { h: 1, u: 1.3, m: 1 },
  ballad: { h: 1, u: 1, m: 1.4 },
  all: { h: 1.1, u: 1.1, m: 1.1 },
};
export const SONG_MATCH_BONUS = 0.25;
export const COMBO_PASSIVE_MULT = 2.2;
export const COMBO_SONG_BUFF = 6; // コンボ成功ごとに曲内バフ+6%（最大+30%）
export const COMBO_SONG_BUFF_CAP = 30;
export const SOLO_PASSIVE_MULT = 1.5;
export const BOX_PER_MEMBER = 0.04;
export const BOX_MEMBER_CAP = 6;
export const BOX_UNITY_MULT = 1.1;
export const MVP_TENTHS = 20; // MVP +2点

export const weightedTenths = (g: Gain3): number => 5 * g.h + 3 * g.u + 2 * g.m;
export const sideTotalTenths = (s: LiveSide): number => s.songScores.reduce((a, b) => a + b, 0) + s.mvpTenths;
export const cpuMovesFirst = (songIndex: number): boolean => songIndex % 2 === 1;
export const fmtTenths = (t: number): string => (t / 10).toFixed(1);

function log(live: LiveState, who: LogEntry['who'], text: string, kind: LogEntry['kind'] = 'info'): void {
  live.log.push({ who, text, kind });
  if (live.log.length > 240) live.log.splice(0, live.log.length - 240);
}

function makeSide(cfg: SideConfig, box: { rng: number }): LiveSide {
  const deck = shuffle(box, [...cfg.deck]);
  const side: LiveSide = {
    name: cfg.name, oshi: cfg.oshi, oshiMember: cfg.member, deck, hand: [], discard: [],
    spent: 0, meters: ZERO(), song: ZERO(), songScores: [], mvpTenths: 0, mvpWins: 0, history: [],
    nextMult: 1, songBuffPct: 0, mvpExtra: 0, comboFired: 0, comboThisSong: 0, comboDrawUsed: false,
    skills: { ...cfg.skills }, assetBonus: { ...cfg.assetBonus }, gainMult: cfg.gainMult,
  };
  if (cfg.oshi === 'solo' && cfg.member) {
    const i = deck.findIndex((id) => CARD_MAP[id]?.member === cfg.member);
    if (i >= 0) side.hand.push(deck.splice(i, 1)[0] as string);
  }
  while (side.hand.length < cfg.startHand && drawOne(side, box)) { /* draw */ }
  return side;
}

function drawOne(side: LiveSide, box: { rng: number }): boolean {
  if (side.hand.length >= HAND_LIMIT) return false;
  if (side.deck.length === 0) {
    if (side.discard.length === 0) return false;
    side.deck = shuffle(box, side.discard.splice(0));
  }
  side.hand.push(side.deck.pop() as string);
  return true;
}

function drawN(side: LiveSide, n: number, box: { rng: number }): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (drawOne(side, box)) k++;
  return k;
}

export function createLive(opts: {
  concertId: string; mode: LiveMode; seed: number; player: SideConfig; cpu: SideConfig;
}): LiveState {
  const concert = CONCERT_MAP[opts.concertId];
  if (!concert) throw new Error(`unknown concert ${opts.concertId}`);
  const box = { rng: opts.seed >>> 0 || 1 };
  const live: LiveState = {
    version: 1, rng: box.rng, concertId: concert.id, mode: opts.mode,
    setlist: concert.setlist.map((s) => ({ ...s })), target: concert.target,
    songIndex: 0, phase: 'first', stage: 'playing',
    player: makeSide(opts.player, box), cpu: makeSide(opts.cpu, box),
    log: [], result: null,
  };
  live.rng = box.rng;
  log(live, 'sys', `開演！ ${concert.name} @ ${concert.venue}`, 'info');
  log(live, 'sys', `山札${opts.player.deck.length}枚をシャッフルし、手札${live.player.hand.length}枚を引いた。`, 'info');
  startSong(live, true);
  beginPhase(live);
  return live;
}

function startSong(live: LiveState, first: boolean): void {
  const song = live.setlist[live.songIndex];
  if (!song) return;
  for (const who of ['player', 'cpu'] as const) {
    const s = live[who];
    s.song = ZERO();
    s.spent = 0;
    s.comboThisSong = 0;
    s.comboDrawUsed = false;
    s.nextMult = 1;
    s.songBuffPct = 0;
    s.mvpExtra = 0;
    if (!first) {
      const n = drawN(s, 2, live);
      if (who === 'player') log(live, 'sys', `次の曲の準備でカードを${n}枚引いた。`, 'info');
    }
    // 使用制限で出せない同名SR以上は自動で捨てる（手札の詰まり防止）
    const stuck = s.hand.filter((id) => {
      const c = CARD_MAP[id];
      return !!c && isHighRarity(c.rarity) && s.history.some((r) => r.cardId === id);
    });
    for (const id of stuck) {
      s.hand.splice(s.hand.indexOf(id), 1);
      s.discard.push(id);
      if (who === 'player') log(live, 'player', `「${CARD_MAP[id]?.name}」は公演内の使用制限により自動で捨てた。`, 'fail');
    }
  }
  live.phase = 'first';
  log(live, 'sys',
    `♪ 第${live.songIndex + 1}曲「${song.name}」(${{ call: 'コール', unit: 'ユニット', ballad: 'バラード', all: '全体' }[song.type]}) 前半戦`,
    'info');
}

function beginPhase(live: LiveState): void {
  if (live.stage !== 'playing') return;
  if (cpuMovesFirst(live.songIndex)) cpuTurn(live);
}

// ---------- 合法判定 ----------
export function playBlockReason(live: LiveState, who: Who, cardId: string): string | null {
  if (live.stage !== 'playing') return 'ライブは終了しています';
  const side = live[who];
  const card = CARD_MAP[cardId];
  if (!card || !side.hand.includes(cardId)) return '手札にありません';
  const playedThisSong = side.history.filter((r) => r.songIndex === live.songIndex).length;
  if (playedThisSong >= MAX_PLAYS_PER_SONG) return `1曲に使えるのは${MAX_PLAYS_PER_SONG}枚までです`;
  if (card.kind === 'finisher' && live.phase === 'first') return 'フィニッシャーは後半専用です';
  if (live.phase === 'first') {
    if (side.spent + card.cost > FIRST_HALF_EP) return `前半は合計${FIRST_HALF_EP}EPまで（残り${Math.max(0, FIRST_HALF_EP - side.spent)}EP）`;
  } else if (side.spent + card.cost > SONG_EP) {
    return `EP不足（残り${Math.max(0, SONG_EP - side.spent)}EP）`;
  }
  if (isHighRarity(card.rarity) && side.history.some((r) => r.cardId === cardId)) {
    return '同名のSR以上はこの公演で1回まで';
  }
  return null;
}

// ---------- 解決（副作用なし） ----------
export interface PlayPreview {
  card: CardDef;
  gains: Gain3;
  effect: EffectResult;
  comboFired: boolean;
  comboText: string | null;
  spendEp: number;
  notes: string[];
}

function recOf(card: CardDef, songIndex: number, phase: LiveState['phase']): PlayedRec {
  return {
    cardId: card.id, songIndex, phase, member: card.member, songType: card.songType,
    region: card.region, kind: card.kind, rarity: card.rarity,
  };
}

export function previewPlay(live: LiveState, who: Who, cardId: string): PlayPreview {
  const side = live[who];
  const foe = live[who === 'player' ? 'cpu' : 'player'];
  const card = CARD_MAP[cardId] as CardDef;
  const song = live.setlist[live.songIndex] as LiveState['setlist'][number];
  const songPlays = side.history.filter((r) => r.songIndex === live.songIndex);
  const prev = songPlays.length ? (songPlays[songPlays.length - 1] as PlayedRec) : null;
  const ctx: EffectCtx = {
    card, side, foe, songIndex: live.songIndex, phase: live.phase, song,
    songPlays, livePlays: side.history, prev,
    prevCard: prev ? (CARD_MAP[prev.cardId] ?? null) : null,
    handAfter: Math.max(0, side.hand.length - 1),
    epAfter: Math.max(0, SONG_EP - side.spent - card.cost),
  };
  const effect = resolveEffect(card.effect, ctx);
  const comboFired = !!effect.combo?.fired;
  const comboMult = side.oshi === 'combo' ? COMBO_PASSIVE_MULT : 1;

  const notes: string[] = [];
  const match = card.songType === song.type ? SONG_MATCH_BONUS : card.songType === 'all' ? 0.1 : 0;
  if (match > 0) notes.push(`曲マッチ+${Math.round(match * 100)}%`);
  if (side.nextMult !== 1) notes.push(`直前の効果 ×${side.nextMult}`);
  if (side.songBuffPct > 0) notes.push(`曲バフ+${side.songBuffPct}%`);
  let passiveAll = 1;
  let passiveUnity = 1;
  if (side.oshi === 'solo' && side.oshiMember === card.member) {
    passiveAll = SOLO_PASSIVE_MULT;
    notes.push(`単推しパッシブ ×${SOLO_PASSIVE_MULT}`);
  } else if (side.oshi === 'box') {
    const k = Math.min(new Set(side.history.map((r) => r.member)).size, BOX_MEMBER_CAP);
    passiveAll = 1 + BOX_PER_MEMBER * k;
    passiveUnity = BOX_UNITY_MULT;
    if (k > 0) notes.push(`箱推しパッシブ+${Math.round(BOX_PER_MEMBER * k * 100)}%`);
  }
  if (comboFired && side.oshi === 'combo') notes.push(`コンボ型パッシブ ×${COMBO_PASSIVE_MULT}`);

  const gains: Gain3 = ZERO();
  for (const k of METERS) {
    const raw =
      card.base[k] + (effect.bonus?.[k] ?? 0) + (effect.extraBase?.[k] ?? 0) + (effect.comboBonus?.[k] ?? 0) * comboMult;
    const mult =
      SONG_METER_MOD[song.type][k] * (1 + match) * side.nextMult * (1 + side.songBuffPct / 100) *
      passiveAll * (k === 'u' ? passiveUnity : 1) * (1 + side.skills[k]) * (1 + side.assetBonus[k]) *
      side.gainMult * (effect.doubleMeter === k ? 2 : 1);
    gains[k] = Math.max(0, Math.round(raw * mult));
  }
  const spendEp = effect.consumeAllEp ? Math.max(card.cost, SONG_EP - side.spent) : card.cost;
  const comboText = effect.combo
    ? effect.combo.fired ? `コンボ「${effect.combo.label}」発動` : `コンボ不発（${effect.combo.reason ?? '条件未達'}）`
    : null;
  return { card, gains, effect, comboFired, comboText, spendEp, notes };
}

const fmtGains = (g: Gain3): string => METERS.map((k) => `${METER_LABEL[k]}+${g[k]}`).join(' ');

// ---------- 適用（draft を破壊的に更新） ----------
function applyPlay(live: LiveState, who: Who, handIndex: number): void {
  const side = live[who];
  const foe = live[who === 'player' ? 'cpu' : 'player'];
  const cardId = side.hand[handIndex] as string;
  const pv = previewPlay(live, who, cardId);
  const { card, effect } = pv;
  const label = who === 'player' ? 'あなた' : 'CPU';

  side.hand.splice(handIndex, 1);
  side.spent = effect.consumeAllEp ? SONG_EP : side.spent + card.cost;
  side.nextMult = 1;
  for (const k of METERS) {
    side.song[k] += pv.gains[k];
    side.meters[k] += pv.gains[k];
  }
  side.history.push(recOf(card, live.songIndex, live.phase));
  const sideNotes = pv.notes.length ? `（${pv.notes.join('、')}）` : '';
  log(live, who,
    `${label}:「${card.name}」[${card.rarity}/${KIND_LABEL[card.kind]}/${card.cost}EP] → ${fmtGains(pv.gains)}${sideNotes}`, 'play');
  if (pv.comboText) log(live, who, `　${pv.comboText}`, pv.comboFired ? 'combo' : 'fail');

  if (pv.comboFired) {
    side.comboFired++;
    side.comboThisSong++;
    if (side.oshi === 'combo') {
      const before = side.songBuffPct;
      side.songBuffPct = Math.min(COMBO_SONG_BUFF_CAP, side.songBuffPct + COMBO_SONG_BUFF);
      if (side.songBuffPct > before) {
        log(live, who, `　コンボ型パッシブ：この曲の獲得値+${COMBO_SONG_BUFF}%（累計+${side.songBuffPct}%）`, 'combo');
      }
    }
    if (side.oshi === 'combo' && !side.comboDrawUsed) {
      side.comboDrawUsed = true;
      const n = drawN(side, 1, live);
      if (n) log(live, who, '　コンボ型パッシブ：カードを1枚引いた。', 'combo');
    }
  }
  if (effect.nextMult) side.nextMult = effect.nextMult;
  if (effect.songBuffPct) {
    side.songBuffPct += effect.songBuffPct;
    log(live, who, `　この曲の以降の獲得値+${effect.songBuffPct}%（累計+${side.songBuffPct}%）`, 'info');
  }
  if (effect.refund) {
    const before = side.spent;
    side.spent = Math.max(0, side.spent - effect.refund);
    log(live, who, `　EPを${before - side.spent}回復`, 'info');
  }
  if (effect.draw) {
    const n = drawN(side, effect.draw, live);
    log(live, who, `　カードを${n}枚引いた（手札上限${HAND_LIMIT}）`, 'info');
  }
  if (effect.tutor) {
    const t = effect.tutor;
    let found = -1;
    for (let i = side.deck.length - 1; i >= 0; i--) {
      const c = CARD_MAP[side.deck[i] as string];
      if (c && (!t.kind || c.kind === t.kind) && (!t.member || c.member === t.member)) { found = i; break; }
    }
    if (found >= 0 && side.hand.length < HAND_LIMIT) {
      const id = side.deck.splice(found, 1)[0] as string;
      side.hand.push(id);
      log(live, who, `　山札から「${CARD_MAP[id]?.name}」を手札に加えた。`, 'info');
    } else {
      log(live, who, '　山札に該当カードがない（または手札上限）。', 'fail');
    }
  }
  if (effect.recycle) {
    for (let i = 0; i < effect.recycle; i++) {
      if (side.discard.length && side.hand.length < HAND_LIMIT) {
        const id = side.discard.splice(randInt(live, side.discard.length), 1)[0] as string;
        side.hand.push(id);
        log(live, who, `　捨て札から「${CARD_MAP[id]?.name}」を手札に戻した。`, 'info');
      }
    }
  }
  if (effect.suppressPct) {
    const cut = Math.floor((foe.song.h * effect.suppressPct) / 100);
    foe.song.h -= cut;
    foe.meters.h -= cut;
    log(live, who, `　${who === 'player' ? 'CPU' : 'あなた'}の熱量を${cut}減らした。`, 'info');
  }
  if (effect.mvpExtra) side.mvpExtra += effect.mvpExtra;
  side.discard.push(card.id);
}

// ---------- CPU ----------
function cardValue(pv: PlayPreview, live: LiveState, who: Who): number {
  const foe = live[who === 'player' ? 'cpu' : 'player'];
  const e = pv.effect;
  let v = weightedTenths(pv.gains) / 10;
  v += (e.draw ?? 0) * 1.2 + (e.refund ?? 0) * 2 + (e.songBuffPct ?? 0) * 0.08 + (e.mvpExtra ?? 0) * 2;
  if (e.nextMult) v += (e.nextMult - 1) * 5;
  if (e.tutor) v += 1;
  if (e.recycle) v += 1;
  if (e.suppressPct) v += (foe.song.h * e.suppressPct) / 200;
  return v;
}

/** CPUが次に出す手札インデックス。出さないなら null（前半はEPを温存することがある）。rng を消費する */
export function chooseCard(live: LiveState, who: Who): number | null {
  const side = live[who];
  let best: { i: number; eff: number } | null = null;
  side.hand.forEach((id, i) => {
    if (playBlockReason(live, who, id)) return;
    const pv = previewPlay(live, who, id);
    const eff = (cardValue(pv, live, who) / Math.max(1, pv.spendEp)) * (0.94 + rand(live) * 0.12);
    if (!best || eff > best.eff) best = { i, eff };
  });
  const pick = best as { i: number; eff: number } | null;
  if (!pick) return null;
  if (live.phase === 'first' && pick.eff < 2.0) return null; // 効率が悪ければ後半に温存
  if (pick.eff <= 0) return null;
  return pick.i;
}

export const cpuChoose = (live: LiveState): number | null => chooseCard(live, 'cpu');

function cpuTurn(live: LiveState): void {
  let played = 0;
  for (let guard = 0; guard < 10; guard++) {
    const i = cpuChoose(live);
    if (i === null) break;
    applyPlay(live, 'cpu', i);
    played++;
  }
  log(live, 'cpu', played ? `CPU:${live.phase === 'first' ? '前半' : '後半'}を終えた（${played}枚）` : `CPU:${live.phase === 'first' ? '前半' : '後半'}は温存・パス`, 'info');
}

// ---------- 進行 ----------
function finishSong(live: LiveState): void {
  const song = live.setlist[live.songIndex] as LiveState['setlist'][number];
  const p = live.player;
  const c = live.cpu;
  const ps = weightedTenths(p.song);
  const cs = weightedTenths(c.song);
  p.songScores.push(ps);
  c.songScores.push(cs);
  let mvp = 'なし（同点）';
  if (ps > cs) {
    p.mvpTenths += MVP_TENTHS + p.mvpExtra * 10;
    p.mvpWins++;
    mvp = `あなた +${fmtTenths(MVP_TENTHS + p.mvpExtra * 10)}`;
  } else if (cs > ps) {
    c.mvpTenths += MVP_TENTHS + c.mvpExtra * 10;
    c.mvpWins++;
    mvp = `CPU +${fmtTenths(MVP_TENTHS + c.mvpExtra * 10)}`;
  }
  log(live, 'sys',
    `第${live.songIndex + 1}曲「${song.name}」終了 あなた${fmtTenths(ps)} - CPU${fmtTenths(cs)}  MVP:${mvp}`, 'score');
}

function finishLive(live: LiveState): void {
  const p = sideTotalTenths(live.player);
  const c = sideTotalTenths(live.cpu);
  live.stage = 'result';
  live.result = {
    playerTotal: p, cpuTotal: c,
    winner: p > c ? 'player' : c > p ? 'cpu' : 'draw',
    targetReached: p / 10 >= live.target,
    target: live.target,
    songResults: live.setlist.map((s, i) => {
      const a = live.player.songScores[i] ?? 0;
      const b = live.cpu.songScores[i] ?? 0;
      return { song: s.name, player: a, cpu: b, mvp: a > b ? 'player' : b > a ? 'cpu' : 'none' };
    }),
  };
  log(live, 'sys', `全${SONGS_PER_LIVE}曲終了！ あなた${fmtTenths(p)} - CPU${fmtTenths(c)}（目標${live.target}）`, 'score');
}

function advance(live: LiveState): void {
  if (live.phase === 'first') {
    live.phase = 'second';
    const a = drawN(live.player, 1, live);
    drawN(live.cpu, 1, live);
    log(live, 'sys', `後半戦！ カードを${a}枚引いた。残りEPを使えます。`, 'info');
    beginPhase(live);
    return;
  }
  finishSong(live);
  if (live.songIndex >= live.setlist.length - 1) {
    finishLive(live);
    return;
  }
  live.songIndex++;
  startSong(live, false);
  beginPhase(live);
}

export type LiveOutcome = { ok: true; live: LiveState } | { ok: false; reason: string };

export function playerPlay(live: LiveState, handIndex: number): LiveOutcome {
  const id = live.player.hand[handIndex];
  if (id === undefined) return { ok: false, reason: '手札にありません' };
  const reason = playBlockReason(live, 'player', id);
  if (reason) return { ok: false, reason };
  const d = structuredClone(live);
  applyPlay(d, 'player', handIndex);
  return { ok: true, live: d };
}

/** フェーズ終了。CPUの手番→フェーズ移行/曲終了/公演終了まで一括で進める（詰まらない） */
export function playerEndPhase(live: LiveState): LiveOutcome {
  if (live.stage !== 'playing') return { ok: false, reason: 'ライブは終了しています' };
  const d = structuredClone(live);
  log(d, 'player', `あなた:${d.phase === 'first' ? '前半' : '後半'}を終えた（使用EP ${d.player.spent}/${d.phase === 'first' ? FIRST_HALF_EP : SONG_EP}）`, 'info');
  if (!cpuMovesFirst(d.songIndex)) cpuTurn(d);
  advance(d);
  return { ok: true, live: d };
}
