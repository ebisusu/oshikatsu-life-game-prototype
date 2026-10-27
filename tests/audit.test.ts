import { describe, expect, it } from 'vitest';
import { CARDS, CARD_MAP } from '../src/game/data/cards';
import { applyAction, newGame } from '../src/game/game';
import { COMBO_PASSIVE_MULT, playerEndPhase, playerPlay, previewPlay, playBlockReason } from '../src/game/live';
import { parseSave, serialize } from '../src/game/save';
import { mkLive, setHand } from './helpers';
import type { LiveState } from '../src/game/types';

const play = (l: LiveState, id: string) => {
  const r = playerPlay(l, l.player.hand.indexOf(id));
  if (!r.ok) throw new Error(r.reason);
  return r.live;
};
const end = (l: LiveState) => {
  const r = playerEndPhase(l);
  if (!r.ok) throw new Error(r.reason);
  return r.live;
};
const fresh = () => newGame({ oshi: 'combo', city: 'tokyo', seed: 51 });
const liveGame = () => {
  let s = fresh();
  for (let i = 0; i < 3; i++) { const r = applyAction(s, { type: 'endWeek' }); if (!r.ok) throw Error(r.reason); s = r.state; }
  const r = applyAction(s, { type: 'startLive', mode: 'free' });
  if (!r.ok) throw Error(r.reason);
  return r.state;
};

describe('independent audit regressions', () => {
  it('all-in rewards every EP consumed, including the printed cost', () => {
    const l = end(mkLive());
    setHand(l, ['c37']);
    expect(previewPlay(l, 'player', 'c37').effect.bonus).toEqual({ h: 16, u: 8, m: 4 });
    expect(play(l, 'c37').player.spent).toBe(4);
  });
  it('echo receives the combo passive on its copied bonus', () => {
    let l = mkLive(1, 'combo');
    setHand(l, ['c01', 'c38']);
    l = end(play(l, 'c01'));
    l.player.songBuffPct = 0;
    const pv = previewPlay(l, 'player', 'c38');
    expect(pv.comboFired).toBe(true);
    // unit card in a call song: h multiplier 1.3; copied h = 4 * .8.
    expect(pv.gains.h).toBe(Math.round((6 + 4 * .8 * COMBO_PASSIVE_MULT) * 1.3));
  });
  it('UR three-kind combo can actually be activated within four EP', () => {
    let l = mkLive(1, 'combo');
    setHand(l, ['c01', 'c05', 'c40']);
    l = play(l, 'c01');
    l = play(l, 'c05');
    l = end(l);
    expect(playBlockReason(l, 'player', 'c40')).toBeNull();
    l = play(l, 'c40');
    expect(l.player.comboFired).toBe(1);
    expect(l.player.spent).toBe(4);
  });
  const corruptions: [string, (s: any) => void][] = [
    ['missing statistics', s => { s.stats = {}; }],
    ['prototype city ID', s => { s.city = '__proto__'; }],
    ['prototype card ID', s => { s.pending = { source: 'x', options: ['constructor'] }; }],
    ['missing concert record', s => { delete s.concerts.live1; }],
    ['inconsistent finished week', s => { s.finished = true; }],
    ['missing live meters', s => { delete s.live.player.song; }],
    ['malformed setlist', s => { s.live.setlist[0] = null; }],
    ['invalid live mode', s => { s.live.mode = 'bogus'; }],
    ['oversized hand', s => { s.live.player.hand.push(...Array(8).fill('c01')); }],
    ['malformed history', s => { s.live.player.history.push(null); }],
    ['missing multiplier', s => { delete s.live.player.gainMult; }],
    ['wrong concert week', s => { s.live.concertId = 'live2'; }],
    ['impossible first half EP', s => { s.live.player.spent = 4; }],
    ['malformed live log', s => { s.live.log.push(null); }],
    ['malformed result', s => { s.live.stage = 'result'; s.live.result = {}; }],
    ['reward and live simultaneously', s => { s.pending = { source: 'x', options: ['c01'] }; }],
  ];
  it.each(corruptions)('rejects %s without loading a state that can crash', (_name, mutate) => {
    const s = liveGame();
    mutate(s);
    expect(parseSave(serialize(s)).status).toBe('invalid');
  });
  it('all cards use genuinely different effect definitions (not only names)', () => {
    expect(new Set(CARDS.map(c => JSON.stringify(c.effect))).size).toBe(40);
    expect(CARD_MAP.c40.effect.id).toBe('distinctKindsSong');
  });
});

describe('audit: valid saves and behavioral effect coverage', () => {
  it('40 effects produce distinct behavior across varied contexts, ignoring description/labels', () => {
    const results = new Map<string, string>();
    for (const card of CARDS) {
      const signatures: unknown[] = [];
      for (let sample = 0; sample < 80; sample++) {
        const l = mkLive(sample + 1);
        l.phase = sample % 2 ? 'first' : 'second';
        l.player.song = { h: sample % 11, u: sample % 7, m: sample % 5 };
        l.cpu.song = { h: 5, u: 3, m: 4 };
        l.player.comboFired = sample % 6;
        l.player.songScores = [sample * 10];
        l.player.discard = Array(sample % 8).fill('c01');
        l.player.hand = Array(1 + sample % 7).fill(card.id);
        l.player.spent = sample % 2;
        const history = Array.from({ length: sample % 7 }, (_, i) => {
          const c = CARDS[(sample + i * 7) % CARDS.length]!;
          return { cardId: c.id, songIndex: 0, phase: 'first' as const, member: c.member, songType: c.songType, region: c.region, kind: c.kind, rarity: c.rarity };
        });
        l.player.history = history;
        const effect = previewPlay(l, 'player', card.id).effect;
        const { combo, ...behavior } = effect;
        signatures.push({ ...behavior, comboFired: combo?.fired });
      }
      const sig = JSON.stringify(signatures);
      expect(results.has(sig), `effect duplicates ${results.get(sig)}: ${card.id}`).toBe(false);
      results.set(sig, card.id);
    }
    expect(results.size).toBe(40);
  });
  it('every accepted action in full seeded games can save, reload and continue', () => {
    for (const oshi of ['solo', 'combo', 'box'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        let s = newGame({ oshi, member: 'H', city: 'osaka', seed });
        for (let guard = 0; guard < 300 && !s.finished; guard++) {
          const loaded = parseSave(serialize(s));
          expect(loaded.status, JSON.stringify(loaded)).toBe('ok');
          if (loaded.status !== 'ok') throw Error('valid state rejected');
          s = loaded.state;
          let action: import('../src/game/state').Action;
          if (s.pending) action = { type: 'pickCard', cardId: s.pending.options[seed % 3]! };
          else if (s.live?.stage === 'result') action = { type: 'liveClaim' };
          else if (s.live) {
            const i = s.live.player.hand.findIndex(id => !playBlockReason(s.live!, 'player', id));
            action = i >= 0 ? { type: 'livePlay', handIndex: i } : { type: 'liveEndPhase' };
          } else if ([4, 8, 12].includes(s.week) && s.concerts[`live${s.week / 4}`]?.status === 'pending') action = { type: 'startLive', mode: seed % 2 ? 'free' : 'stream' };
          else action = { type: 'endWeek' };
          const r = applyAction(s, action);
          if (!r.ok) throw Error(r.reason);
          s = r.state;
        }
        expect(s.finished).toBe(true);
        expect(parseSave(serialize(s)).status).toBe('ok');
        expect(s.stats.liveAttended).toBe(3);
      }
    }
  });
});

describe('audit: prototype IDs are never legal cards', () => {
  it.each(['__proto__', 'constructor'])('rejects %s in a nominally 20-card deck', id => {
    const s = fresh();
    const deck = [...s.deck.slice(1), id];
    const r = applyAction(s, { type: 'setDeck', deck });
    expect(r.ok).toBe(false);
    expect(s.deck).not.toContain(id);
  });
});
