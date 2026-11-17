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
  /* 이번 판 종목 중 배당주 하나와, 배당이 없는 종목 하나를 고릅니다 */
  const codes = room.s.plan.stockCodes!;
  const div = codes.find(c => fundOf(c).dps > 0)!;
  const noDiv = codes.find(c => fundOf(c).dps === 0)!;
  const dps = fundOf(div).dps;
  assert.ok(dps > 0, '이번 판에 배당주가 없음');
  const statuses: string[] = [];
  while (room.s.round < rd || room.s.phase !== 'trade') {
    if (room.s.phase === 'news') statuses.push(room.view(a, 'player', 0).dividend!.status);
    next(room);
  }
  assert.deepEqual(statuses, ['before', 'upcoming', 'record']);
  /* 기준일 라운드 장중: a는 사서 들고 있고, b는 샀다가 판다 */
  const t = room.s.live!.startedAt;
  assert.equal(room.placeOrder(a, 'a1', div, 'buy', 100, t).ok, true);
  assert.equal(room.placeOrder(b, 'b1', div, 'buy', 100, t).ok, true);
  assert.equal(room.placeOrder(b, 'b2', div, 'sell', 100, t).ok, true);
  next(room);                              // 기준일 장 마감·결과
  const pa = room.player(a)!, pb = room.player(b)!;
  const close = room.s.prices[div], cashA = pa.cash, cashB = pb.cash, valueA = room.value(pa);
  next(room);                              // 다음 라운드 시작: 입금 + 배당락
  assert.equal(room.s.round, rd + 1);
  assert.equal(room.s.prices[div], close - dps);
  assert.equal(pa.cash, cashA + 100 * dps);
  assert.equal(pb.cash, cashB, '기준일 전에 판 사람은 못 받음');
  assert.equal(room.value(pa), valueA, '평가액은 그대로');
  assert.deepEqual(pa.dividends, [{ round: rd + 1, code: div, qty: 100, dps, amount: 100 * dps }]);
  const v = room.view(a, 'player', 0);
  assert.equal(v.dividend!.status, 'ex');
  assert.equal(v.portfolio!.dividendLog!.length, 1);
  /* 그 라운드 봉의 이전가는 배당락 뒤 가격이고, 배당락 금액이 기록됩니다 */
  while ((room.s.phase as string) !== 'recap') next(room);
  const h = room.s.history[div][rd];
  assert.equal(h.round, rd + 1);
  assert.equal(h.basePrice, close - dps);
  assert.equal(h.exDividend, dps);
  assert.equal(room.s.history[noDiv][rd].exDividend, undefined, '배당이 없는 종목은 그대로');
  /* 다시 불러도 두 번 주지 않습니다 */
  const again = new GameRoom(JSON.parse(JSON.stringify(room.s)));
  (again as unknown as { payDividends(r: number): void }).payDividends(rd + 1);
  assert.equal(again.player(a)!.cash, pa.cash);
});

test('배당락으로 시가가 내려가도 걸어 둔 손절가에 바로 걸리지 않게 손절가·익절가도 같은 만큼 낮춘다', () => {
  const room = GameRoom.create({ code: '525252', mode: 'friend', now: T0, seed: 3, settings: { level: 'pro' } });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  const rd = dividendRound(MODES.friend.rounds);
  const div = room.s.plan.stockCodes!.find(c => fundOf(c).dps > 0)!;
  while (room.s.round < rd || room.s.phase !== 'trade') next(room);
  assert.equal(room.placeOrder(a, 'a1', div, 'buy', 100, room.s.live!.startedAt).ok, true);
  next(room);                                   // 기준일 장 마감·결과
  const close = room.s.prices[div];
  /* 종가 바로 아래에 손절가, 위에 익절가를 겁니다 */
  assert.equal(room.setStop(a, 's1', div, close - 10, close + 500, room.s.phaseEndsAt! - 1).ok, true);
  next(room);                                   // 다음 라운드 뉴스: 입금 + 배당락
  const drop = close - room.s.prices[div];
  assert.ok(drop > 0, '배당락으로 시가가 내려가야 합니다');
  assert.deepEqual([room.player(a)!.stops![div]!.stop, room.player(a)!.stops![div]!.take], [close - 10 - drop, close + 500 - drop]);
  next(room);                                   // 장 시작: 밤사이 손절 확인
  assert.equal(room.player(a)!.holdings[div]?.qty, 100, '배당락만으로 손절되면 안 됩니다');
});
