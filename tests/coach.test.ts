/* 첫 판 따라 하기 안내가 화면 상태에 맞는 단계를 고르는지 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachStep, coachTarget, eulReul } from '../client/src/coach';
import { GameRoom } from '../server/src/room';

const T0 = 1_000_000;
function solo() {
  const room = GameRoom.create({ code: '111111', mode: 'solo', now: T0, seed: 5 });
  const tok = room.join(null, T0).token;
  room.start(T0);
  return { room, tok };
}
const step = (room: GameRoom) => { const now = room.s.phaseEndsAt!; if (room.tick(now) === 'settled') room.beginRecap(now); return now; };

test('뉴스 → 종목 열기 → 주문 → 대기 → 결과 순서로 안내한다', () => {
  const { room, tok } = solo();
  const v1 = room.view(tok, 'player', T0);
  assert.equal(coachStep(v1, null)?.no, 1);
  const target = coachTarget(v1);
  assert.ok(target, '첫 뉴스 종목이 있어야 함');
  step(room);
  const now = room.s.phaseEndsAt! - 1000;
  const v2 = room.view(tok, 'player', now);
  assert.equal(coachStep(v2, null)?.no, 2);
  assert.equal(coachStep(v2, null)?.target, target);
  assert.equal(coachStep(v2, target)?.no, 3);
  assert.equal(room.placeOrder(tok, 'c1', target!, 'buy', 10, now).ok, true);
  assert.equal(coachStep(room.view(tok, 'player', now), target)?.no, 4);
  step(room);
  assert.equal(coachStep(room.view(tok, 'player', room.s.phaseEndsAt!), null)?.no, 5);
  step(room);
  assert.equal(room.s.round, 2);
  assert.equal(coachStep(room.view(tok, 'player', room.s.phaseEndsAt!), null), null, '2라운드부터는 안내하지 않음');
});

test('친구 대전과 관전자에게는 안내하지 않는다', () => {
  const room = GameRoom.create({ code: '222222', mode: 'friend', now: T0, seed: 5 });
  const a = room.join(null, T0).token; room.join(null, T0);
  room.start(T0);
  assert.equal(coachStep(room.view(a, 'player', T0), null), null);
  const { room: s } = solo();
  assert.equal(coachStep(s.view(null, 'spectator', T0), null), null);
});

test('조사: 받침에 따라 을/를을 고른다', () => {
  assert.equal(eulReul('타르멜 물순환'), '타르멜 물순환을');
  assert.equal(eulReul('피노벡 소리극장'), '피노벡 소리극장을');
  assert.equal(eulReul('아보튠 배양소재'), '아보튠 배양소재를');
  assert.equal(eulReul('누바칸 미세전력'), '누바칸 미세전력을');
  assert.equal(eulReul('ABC'), 'ABC을(를)');
});
