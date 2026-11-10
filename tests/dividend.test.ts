/* 배당: 기준일 장 마감 때 가진 사람에게 다음 라운드 시작 때 배당금을 넣고, 시가를 배당금만큼 낮춘다(배당락). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { dividendRound, fundOf, MODES } from '../shared/rules';

const T0 = 1_000_000;
function next(room: GameRoom) { const now = room.s.phaseEndsAt!; if (room.tick(now) === 'settled') room.beginRecap(now); return now; }

test('기준일까지 가진 사람만 배당을 받고, 입금과 배당락이 같은 순간이라 평가액은 그대로다', () => {
  const room = GameRoom.create({ code: '515151', mode: 'friend', now: T0, seed: 3 });
  const a = room.join(null, T0).token, b = room.join(null, T0 + 1).token;
  room.start(T0);
  const rd = dividendRound(MODES.friend.rounds);
  assert.equal(rd, 3);
  const dps = fundOf('G06').dps;
  assert.ok(dps > 0 && room.s.plan.stockCodes!.includes('G06'), '대표 종목 타르멜은 항상 나오고 배당주');
  const statuses: string[] = [];
  while (room.s.round < rd || room.s.phase !== 'trade') {
    if (room.s.phase === 'news') statuses.push(room.view(a, 'player', 0).dividend!.status);
    next(room);
  }
  assert.deepEqual(statuses, ['before', 'upcoming', 'record']);
  /* 기준일 라운드 장중: a는 사서 들고 있고, b는 샀다가 판다 */
  const t = room.s.live!.startedAt;
  assert.equal(room.placeOrder(a, 'a1', 'G06', 'buy', 100, t).ok, true);
  assert.equal(room.placeOrder(b, 'b1', 'G06', 'buy', 100, t).ok, true);
  assert.equal(room.placeOrder(b, 'b2', 'G06', 'sell', 100, t).ok, true);
  next(room);                              // 기준일 장 마감·결과
  const pa = room.player(a)!, pb = room.player(b)!;
  const close = room.s.prices.G06, cashA = pa.cash, cashB = pb.cash, valueA = room.value(pa);
  next(room);                              // 다음 라운드 시작: 입금 + 배당락
  assert.equal(room.s.round, rd + 1);
  assert.equal(room.s.prices.G06, close - dps);
  assert.equal(pa.cash, cashA + 100 * dps);
  assert.equal(pb.cash, cashB, '기준일 전에 판 사람은 못 받음');
  assert.equal(room.value(pa), valueA, '평가액은 그대로');
  assert.deepEqual(pa.dividends, [{ round: rd + 1, code: 'G06', qty: 100, dps, amount: 100 * dps }]);
  const v = room.view(a, 'player', 0);
  assert.equal(v.dividend!.status, 'ex');
  assert.equal(v.portfolio!.dividendLog!.length, 1);
  /* 그 라운드 봉의 이전가는 배당락 뒤 가격이고, 배당락 금액이 기록됩니다 */
  while ((room.s.phase as string) !== 'recap') next(room);
  const h = room.s.history.G06[rd];
  assert.equal(h.round, rd + 1);
  assert.equal(h.basePrice, close - dps);
  assert.equal(h.exDividend, dps);
  assert.equal(room.s.history.G01[rd].exDividend, undefined, '배당이 없는 종목은 그대로');
  /* 다시 불러도 두 번 주지 않습니다 */
  const again = new GameRoom(JSON.parse(JSON.stringify(room.s)));
  (again as unknown as { payDividends(r: number): void }).payDividends(rd + 1);
  assert.equal(again.player(a)!.cash, pa.cash);
});
