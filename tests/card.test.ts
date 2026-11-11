/* 돌발 카드: 한 번 고르면 바꿀 수 없고, 고른 즉시 결과(피드백)가 나옵니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { CARDS } from '../server/src/content';

const T0 = 1_000_000;
function setup() {
  const room = GameRoom.create({ code: '123456', mode: 'friend', now: T0, seed: 7 });
  const a = room.join(null, T0).token, b = room.join(null, T0 + 1).token;
  room.start(T0 + 2);
  return { room, a, b };
}
function next(room: GameRoom) {
  const now = room.s.phaseEndsAt!;
  if (room.tick(now) === 'settled') room.beginRecap(now);
  return now;
}
/** 돌발 카드가 열린 주문 시간까지 보냅니다. */
function toCard(room: GameRoom, token: string) {
  for (let i = 0; i < 200 && room.s.status === 'playing'; i++) {
    const now = room.s.phaseEndsAt! - 1000;
    if (room.s.phase === 'trade' && room.view(token, 'player', now).card) return now;
    next(room);
  }
  throw new Error('돌발 카드가 나오는 라운드를 찾지 못했습니다');
}

test('돌발 카드: 고르면 바로 결과가 나오고, 다시 고를 수 없다', () => {
  const { room, a } = setup();
  const now = toCard(room, a);
  const before = room.view(a, 'player', now).card!;
  assert.equal(before.answered, null);
  assert.equal(before.feedback, null, '고르기 전에 결과가 보이면 안 됩니다');
  assert.equal(room.answerCard(a, 'A', now), true);
  const after = room.view(a, 'player', now).card!;
  assert.equal(after.answered, 'A');
  assert.ok(after.feedback && after.feedback.length > 0, '고른 뒤 결과가 비어 있습니다');
  assert.equal(room.answerCard(a, 'B', now), false, '두 번째 응답은 받지 않아야 합니다');
  assert.equal(room.view(a, 'player', now).card!.answered, 'A');
});

test('돌발 카드: 다른 사람의 판단은 보이지 않는다', () => {
  const { room, a, b } = setup();
  const now = toCard(room, a);
  room.answerCard(a, 'A', now);
  const mine = room.view(b, 'player', now).card!;
  assert.equal(mine.answered, null);
  assert.equal(mine.feedback, null);
  assert.equal(JSON.stringify(room.view(b, 'player', now)).includes(CARDS[0].options[0].feedback), false);
});

test('돌발 카드: 선택지에는 결과 설명이 섞여 들어가지 않는다', () => {
  const { room, a } = setup();
  const now = toCard(room, a);
  const card = room.view(a, 'player', now).card!;
  const full = CARDS.find(c => c.id === card.id)!;
  assert.deepEqual(card.options.map(o => o.label), full.options.map(o => o.label));
  assert.equal(JSON.stringify(card.options).includes(full.options[0].feedback), false);
});
