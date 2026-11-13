/* 실제 시장 규칙에서 가져온 것들: VI(변동성 완화장치), 발표 일정 예고, 난이도(쉬움·실전) */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { cleanSettings, VI_BP, VI_SECONDS, viDirection } from '../shared/rules';
import { stageById } from '../server/src/content';
import type { StockCode } from '../shared/types';

const stageTargets = (room: GameRoom, stageId: string): StockCode[] => stageById.get(stageId)?.targets ?? [];

const T0 = 3_000_000;
function trading(seed = 7) {
  const room = GameRoom.create({ code: '424242', mode: 'friend', now: T0, seed, settings: { level: 'pro' } });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  return { room, a, t: room.s.live!.startedAt };
}
/** 장중 시세를 억지로 비틀어 VI를 걸고, 걸린 k를 돌려줍니다 */
function forceVi(room: GameRoom, code: StockCode, at: number, dir: 1 | -1) {
  const live = room.s.live!;
  const open = live.paths[code][0];
  for (let k = at; k <= live.steps; k++) live.paths[code][k] = open + dir * Math.ceil(open * (VI_BP + 100) / 10000);
  room.tick(live.startedAt + at * 1000);
  return at;
}

test('VI 기준: 시가 대비 ±10%를 넘으면 방향을 알려 준다', () => {
  assert.equal(viDirection(10_000, 10_999), 0);
  assert.equal(viDirection(10_000, 11_000), 1);
  assert.equal(viDirection(10_000, 9_000), -1);
  assert.equal(viDirection(10_000, 9_001), 0);
  assert.equal(viDirection(0, 5_000), 0, '시가가 없으면 걸지 않음');
});

test('VI 발동: 그 종목만 멈추고 주문·손절·지정가가 모두 막히며, 15초 뒤 풀린다', () => {
  const { room, a, t } = trading();
  assert.equal(room.placeOrder(a, 'b1', 'G01', 'buy', 10, t).ok, true);
  assert.equal(room.setStop(a, 's1', 'G01', room.markPrice('G01') - 500, null, t).ok, true);
  const low = room.markPrice('G02') - 1000;
  assert.equal(room.placeOrder(a, 'o1', 'G02', 'buy', 5, t, 'limit', low - low % 10).ok, true, '다른 종목 예약');
  const lowG01 = room.markPrice('G01') - 1000;
  assert.equal(room.placeOrder(a, 'o2', 'G01', 'buy', 5, t, 'limit', lowG01 - lowG01 % 10).ok, true);

  const k = forceVi(room, 'G01', 3, 1);
  assert.equal(room.haltLeft('G01'), VI_SECONDS, '15초 동안 멈춤');
  assert.equal(room.haltLeft('G02'), 0, '다른 종목은 그대로 거래됨');
  assert.equal(room.player(a)!.orders.G01, undefined, 'VI에 걸리면 그 종목 예약은 취소');
  assert.ok(room.player(a)!.orders.G02, '다른 종목 예약은 유지');
  assert.ok(room.player(a)!.stops?.G01, '손절은 남아 있고 발동만 미룸');

  const r1 = room.placeOrder(a, 'b2', 'G01', 'buy', 1, t + k * 1000);
  assert.equal(r1.ok, false);
  assert.match(r1.reason ?? '', /변동성 완화장치/);
  assert.equal(room.placeOrder(a, 'b3', 'G02', 'buy', 1, t + k * 1000).ok, true, '다른 종목은 살 수 있음');

  /* 멈춘 동안에는 손절가 아래로 내려가도 팔리지 않습니다 */
  const live = room.s.live!;
  const below = room.player(a)!.stops!.G01!.stop! - 100;
  for (let x = k; x <= live.steps; x++) live.paths.G01[x] = below;
  room.tick(t + (k + 2) * 1000);
  assert.equal(room.player(a)!.holdings.G01?.qty, 10, '멈춘 동안 손절 안 됨');

  room.tick(t + (k + VI_SECONDS) * 1000);
  assert.equal(room.haltLeft('G01'), 0, '15초 뒤 풀림');
  assert.equal(room.player(a)!.holdings.G01, undefined, '풀리자마자 손절 체결');
});

test('VI는 한 라운드에 종목마다 한 번만 걸린다', () => {
  const { room, t } = trading(11);
  forceVi(room, 'G01', 2, 1);
  const first = room.s.live!.halts!.G01;
  room.tick(t + (2 + VI_SECONDS) * 1000);
  assert.equal(room.haltLeft('G01'), 0);
  forceVi(room, 'G01', 2 + VI_SECONDS + 2, -1);
  assert.deepEqual(room.s.live!.halts!.G01, first, '두 번째는 걸리지 않음');
});

test('발표 일정: 다음 라운드 종목만 알려 주고 헤드라인·결과는 담지 않는다', () => {
  const { room, a } = trading(3);
  const v = room.view(a, 'player', T0);
  const next = room.s.plan.rounds[1];
  assert.equal(v.schedule.length > 0, true);
  assert.ok(v.schedule.every(x => x.round === 2), '다음 라운드만');
  const json = JSON.stringify(v.schedule);
  for (const ps of next.stages) {
    const stage = room.s.plan.rounds[1].stages.find(x => x.stageId === ps.stageId)!;
    assert.ok(!json.includes(stage.outcomeId), '결과가 새면 안 됨');
  }
  assert.ok(!/기대|달성|무산|%/.test(json), `헤드라인이 새면 안 됨: ${json}`);
  /* 1라운드에 안 나온 사건은 제목도 숨깁니다 */
  const shownArcs = new Set(room.s.plan.rounds[0].stages.map(ps => ps.stageId.split('-')[0]));
  for (const item of v.schedule) {
    const stage = next.stages.find(ps => stageTargets(room, ps.stageId)[0] === item.code);
    if (stage && !shownArcs.has(stage.stageId.split('-')[0])) assert.equal(item.arcTitle, '', `처음 나오는 사건의 제목이 새면 안 됨: ${item.name}`);
  }
  /* 마지막 라운드에는 예정이 없습니다 */
  while (room.s.status === 'playing') { const now = room.s.phaseEndsAt!; if (room.tick(now) === 'settled') room.beginRecap(now); }
  assert.deepEqual(room.view(a, 'player', T0).schedule, []);
});

test('쉬움 난이도: 시장가만 받고 지정가·손절·익절은 거절한다', () => {
  const room = GameRoom.create({ code: '919191', mode: 'friend', now: T0, seed: 7, settings: { level: 'easy' } });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  const now = room.s.live!.startedAt;
  const code = room.stocks[0].code;
  assert.equal(room.view(a, 'player', now).level, 'easy');
  const buy = room.placeOrder(a, 'r1', code, 'buy', 10, now);
  assert.equal(buy.ok, true, buy.reason);
  const limit = room.placeOrder(a, 'r2', code, 'buy', 1, now, 'limit', room.s.prices[code]);
  assert.equal(limit.ok, false);
  assert.match(limit.reason!, /시장가/);
  const stop = room.setStop(a, 'r3', code, room.s.prices[code] - 1000, null, now);
  assert.equal(stop.ok, false);
  assert.match(stop.reason!, /쉬움/);
});

test('실전 난이도: 지정가와 손절을 쓸 수 있다', () => {
  const room = GameRoom.create({ code: '929292', mode: 'friend', now: T0, seed: 7, settings: { level: 'pro' } });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  const now = room.s.live!.startedAt;
  const code = room.stocks[0].code;
  assert.equal(room.view(a, 'player', now).level, 'pro');
  assert.equal(room.placeOrder(a, 'p1', code, 'buy', 10, now).ok, true);
  const limit = room.placeOrder(a, 'p2', code, 'buy', 1, now, 'limit', room.s.prices[code]);
  assert.equal(limit.ok, true, limit.reason);
  assert.equal(room.setStop(a, 'p3', code, Math.floor((room.markPrice(code) - 1000) / 10) * 10, null, now).ok, true);
});

test('기기에 저장한 설정: 난이도는 easy·pro만 받는다', () => {
  assert.deepEqual(cleanSettings('{"level":"easy"}'), { level: 'easy' });
  assert.deepEqual(cleanSettings('{"level":"pro","stocks":20}'), { level: 'pro' });
  assert.deepEqual(cleanSettings('{"level":"hard"}'), {});
  assert.deepEqual(cleanSettings('{"level":1}'), {});
});
