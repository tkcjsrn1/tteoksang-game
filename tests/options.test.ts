/* 방 옵션: 라운드 수와 장 시간을 골라 방을 만듭니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlan } from '../server/src/plan';
import { GameRoom } from '../server/src/room';
import { cleanOptions, dividendRound, gameConfig, MODES, ROUND_CHOICES, TRADE_CHOICES } from '../shared/rules';

test('옵션 검증: 고를 수 있는 값만 남기고 나머지는 버린다', () => {
  assert.deepEqual(cleanOptions({ rounds: 8, trade: 120 }), { rounds: 8, trade: 120 });
  assert.deepEqual(cleanOptions({ rounds: 7, trade: 5 }), {});
  assert.deepEqual(cleanOptions({ rounds: '8', trade: null }), {});
  assert.deepEqual(cleanOptions(null), {});
  assert.deepEqual(gameConfig('friend'), MODES.friend);
});
test('어떤 라운드 수를 골라도 라운드마다 뉴스가 1~2건 나온다', () => {
  for (const rounds of ROUND_CHOICES) for (let seed = 1; seed <= 300; seed++) {
    const p = buildPlan(seed, 'friend', [], undefined, undefined, { rounds });
    assert.equal(p.rounds.length, rounds);
    assert.ok(p.rounds.every(r => r.stages.length >= 1 && r.stages.length <= 2), `${rounds}라운드 시드 ${seed}: ${p.rounds.map(r => r.stages.length)}`);
  }
});
test('고른 라운드 수·장 시간으로 판이 진행되고, 다음 판에도 이어진다', () => {
  const T0 = 5_000_000;
  for (const rounds of ROUND_CHOICES) for (const trade of TRADE_CHOICES) {
    const room = GameRoom.create({ code: '777777', mode: 'solo', now: T0, seed: 11, options: { rounds, trade } });
    const tok = room.join(null, T0).token;
    room.start(T0);
    const v = room.view(tok, 'player', T0);
    assert.equal(v.totalRounds, rounds);
    assert.equal(v.seconds.trade, trade);
    let tradeSeconds = 0;
    while (room.s.status === 'playing') {
      if (room.s.phase === 'trade') tradeSeconds = room.s.phaseSeconds;
      const now = room.s.phaseEndsAt!;
      if (room.tick(now) === 'settled') room.beginRecap(now);
    }
    assert.equal(tradeSeconds, trade);
    assert.equal(room.s.settled.length, rounds);
    assert.ok(dividendRound(rounds) < rounds, '배당 기준일 다음 라운드가 있어야 배당을 받음');
  }
});
test('빠른 확인용으로 MODES 시간을 줄이면 고른 장 시간도 같은 비율로 줄어든다', () => {
  const keep = MODES.friend.trade;
  MODES.friend.trade = 15;
  try { assert.equal(gameConfig('friend', { trade: 120 }).trade, 20); assert.equal(gameConfig('friend').trade, 15); }
  finally { MODES.friend.trade = keep; }
});
