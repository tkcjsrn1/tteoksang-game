import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { ARCS } from '../server/src/content';
import type { StockCode } from '../shared/types';

const T0 = 1_000_000;
function setup(opts: Partial<Parameters<typeof GameRoom.create>[0]> = {}) {
  const room = GameRoom.create({ code: '123456', mode: 'friend', now: T0, seed: 7, ...opts });
  const a = room.join(null, T0).token, b = room.join(null, T0 + 1).token;
  return { room, a, b };
}
/** 다음 단계까지 시간을 보냅니다. 정산이면 저장 완료(beginRecap)까지 처리합니다. */
function next(room: GameRoom) {
  const now = room.s.phaseEndsAt!;
  const r = room.tick(now);
  if (r === 'settled') room.beginRecap(now);
  return now;
}
function toTrade(room: GameRoom, now = T0 + 10) {
  if (room.s.status === 'lobby') room.start(now);
  while (room.s.phase !== 'trade') next(room);
  return room.s.phaseEndsAt! - 1000;
}

test('방장이 대기실에서 나가면 가장 먼저 들어온 접속자에게 넘어가고, 시작 후에는 진행된다', () => {
  const { room, a, b } = setup();
  const c = room.join(null, T0 + 2).token;
  assert.equal(room.s.hostId, room.player(a)!.id);
  room.disconnect(a, T0 + 3);
  assert.equal(room.s.hostId, room.player(b)!.id);
  assert.equal(room.canStart(b), true);
  assert.equal(room.canStart(c), false);
  room.start(T0 + 4);
  room.disconnect(b, T0 + 5);
  assert.equal(room.s.status, 'playing');
  next(room);
  assert.equal(room.s.phase, 'trade');
});
test('시작 후 처음 온 사람은 관전자이고 기존 참가자는 토큰으로 복구한다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  assert.equal(room.placeOrder(a, 'r1', 'G01', 'buy', 10, end).ok, true);
  room.disconnect(a, end);
  const again = room.join(a, end + 1);
  assert.equal(again.role, 'player');
  assert.equal(room.player(a)!.orders.G01!.qty, 10);
  const spectator = room.join(null, end);
  assert.equal(spectator.role, 'spectator');
  assert.equal(room.join(spectator.token, end).role, 'spectator');
  assert.equal(room.placeOrder(spectator.token, 'r1', 'G01', 'buy', 1, end).ok, false);
  const v = room.view(spectator.token, 'spectator', end);
  assert.equal(v.portfolio, null);
});
test('접속이 끊겨도 접수된 주문은 마감 때 체결된다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  room.placeOrder(a, 'r1', 'G06', 'buy', 100, end);
  room.disconnect(a, end);
  next(room);
  assert.equal(room.player(a)!.holdings.G06!.qty, 100);
});
test('마감 시각과 같거나 늦은 주문은 거절하고, 직전 주문은 받는다', () => {
  const { room, a } = setup();
  toTrade(room);
  const end = room.s.phaseEndsAt!;
  assert.equal(room.placeOrder(a, 'late-1', 'G01', 'buy', 1, end - 1).ok, true);
  assert.deepEqual(room.placeOrder(a, 'late-2', 'G02', 'buy', 1, end), { ok: false, reason: '이번 라운드 주문 마감' });
  assert.equal(room.placeOrder(a, 'late-3', 'G03', 'buy', 1, end + 500).ok, false);
});
test('같은 요청이 다시 와도 주문과 체결은 하나다. 정산을 다시 불러도 그대로다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  const p = room.player(a)!;
  room.placeOrder(a, 'dup', 'G01', 'buy', 10, end);
  const second = room.placeOrder(a, 'dup', 'G01', 'buy', 999, end);
  assert.equal(second.duplicate, true);
  assert.equal(p.orders.G01!.qty, 10);
  next(room);
  const round = room.s.round, cash = p.cash, fills = p.fills.length, prices = { ...room.s.prices };
  assert.equal(room.settle(round, end), false);
  assert.equal(p.cash, cash); assert.equal(p.fills.length, fills); assert.deepEqual(room.s.prices, prices);
});
test('변경에 실패하면 원래 주문을 유지하고, 성공하면 예약금을 다시 잡는다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  const p = room.player(a)!;
  room.placeOrder(a, 'o1', 'G01', 'buy', 10, end);
  const fail = room.placeOrder(a, 'o2', 'G01', 'buy', 100000, end);
  assert.equal(fail.ok, false);
  assert.equal(p.orders.G01!.qty, 10);
  assert.equal(room.placeOrder(a, 'o3', 'G01', 'buy', 20, end).ok, true);
  assert.equal(p.orders.G01!.qty, 20);
  assert.equal(room.cancelOrder(a, 'o4', 'G01', end).ok, true);
  assert.equal(p.orders.G01, undefined);
  assert.equal(room.view(a, 'player', end).portfolio!.reserved, 0);
});
test('매도 대금은 다음 라운드부터, 새로 산 주식은 이번 라운드에 팔 수 없다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  const buyAll = Math.floor(9_900_000 / 12400);
  assert.equal(room.placeOrder(a, 'b1', 'G01', 'buy', buyAll, end).ok, true);
  assert.equal(room.placeOrder(a, 's1', 'G02', 'sell', 1, end).ok, false);
  next(room); next(room); next(room);
  assert.equal(room.s.phase, 'trade');
  const e2 = room.s.phaseEndsAt! - 1;
  const p = room.player(a)!;
  assert.equal(room.placeOrder(a, 's2', 'G01', 'sell', p.holdings.G01!.qty, e2).ok, true);
  const before = p.cash;
  assert.equal(room.placeOrder(a, 'b2', 'G02', 'buy', Math.floor(before / room.s.prices.G02) + 5, e2).ok, false);
});
test('1만 대 기대에 6천 대: 하락 근거가 그래프 점에 기록된다', () => {
  const { room, a } = setup({ forcedArcs: ['nuvakan', 'rate'], forced: { 'nu-1': 'pass', 'nu-2a': 'approved', 'nu-3a': 'short' } });
  toTrade(room);
  while (room.s.status === 'playing') next(room);
  const v = room.view(a, 'player', room.s.phaseEndsAt ?? T0);
  const g01 = v.stocks.find(s => s.code === 'G01')!;
  const point = g01.history.find(h => h.events.some(e => e.label === '기대에 못 미친 계약 규모'))!;
  assert.ok(point, '계약 라운드 기록');
  const ev = point.events.find(e => e.label === '기대에 못 미친 계약 규모')!;
  assert.equal(ev.bp, -500);
  assert.match(ev.reason, /기대의 60%/);
  assert.match(point.summary, /기대에 못 미친 계약 규모/);
  assert.equal(point.rawBp, point.eventBp + point.marketBp + point.stockBp);
});
test('한 판 전체: 평가액 변화 = 종목 기여 합계 − 수수료, 같은 방은 같은 시장, 그래프 값과 현재가 일치', () => {
  const { room, a, b } = setup();
  toTrade(room);
  const codes: StockCode[] = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06'];
  let i = 0;
  while (room.s.status === 'playing') {
    if (room.s.phase === 'trade') {
      const t = room.s.phaseEndsAt! - 1;
      for (const tok of [a, b]) {
        const p = room.player(tok)!, c = codes[i++ % 6];
        room.placeOrder(tok, `b${i}`, c, 'buy', 30, t);
        const held = Object.keys(p.holdings).find(x => x !== c) as StockCode | undefined;
        if (held && i % 2) room.placeOrder(tok, `s${i}`, held, 'sell', 5, t);
      }
    }
    next(room);
    if (room.s.phase === 'recap') {
      for (const tok of [a, b]) {
        const p = room.player(tok)!, r = p.results[p.results.length - 1];
        assert.equal(r.delta, r.contributions.reduce((x, c) => x + c.won, 0) - r.fees, `라운드 ${r.round}`);
        assert.equal(r.valueAfter, room.value(p));
      }
      const va = room.view(a, 'player', 0), vb = room.view(b, 'player', 0);
      assert.deepEqual(va.stocks, vb.stocks);
      assert.deepEqual(va.news, vb.news);
      for (const st of va.stocks) assert.equal(st.history[st.history.length - 1].closePrice, room.s.prices[st.code]);
    }
  }
  assert.equal(room.s.status, 'finished');
  assert.equal(room.s.settled.length, 5);
  const v = room.view(a, 'player', 0);
  assert.equal(v.leaderboard.length, 5);
  assert.ok(v.report);
});
test('NPC도 같은 예산 제한을 지키고 현금이 음수가 되지 않는다', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { room } = setup({ seed });
    toTrade(room);
    while (room.s.status === 'playing') {
      next(room);
      for (const p of room.s.players) {
        assert.ok(p.cash >= 0, `${p.label} ${p.cash}`);
        for (const h of Object.values(p.holdings)) assert.ok(h!.qty > 0);
      }
    }
    assert.ok(room.s.players.filter(p => p.kind === 'npc').some(p => p.fills.length > 0));
  }
});
test('같은 평가액은 공동 순위다', () => {
  const { room, a, b } = setup();
  assert.equal(room.rankOf(room.player(a)!), room.rankOf(room.player(b)!));
  const lb = room.leaderboard();
  assert.ok(lb.every(x => x.rank === 1));
});
test('공개 전 정보는 어떤 역할의 화면에도 나가지 않는다', () => {
  const { room, a } = setup({ forcedArcs: ['nuvakan', 'rate'] });
  const secretTexts = ARCS.flatMap(x => x.stages.flatMap(s => s.outcomes.map(o => o.actual)));
  room.start(T0);
  const check = (label: string, allowed: Set<string>) => {
    for (const [tok, role] of [[a, 'player'], [null, 'display'], ['x', 'spectator']] as const) {
      const js = JSON.stringify(room.view(tok, role, T0));
      assert.equal(js.includes('seed'), false, label);
      assert.equal(js.includes('outcomeId'), false, label);
      assert.equal(js.includes('clueDir'), false, label);
      for (const t of secretTexts) if (!allowed.has(t)) assert.equal(js.includes(`"${t}"`), false, `${label}: ${t}`);
    }
  };
  const revealed = new Set<string>();
  check('뉴스', revealed);
  next(room); check('주문', revealed);
  room.tick(room.s.phaseEndsAt!);
  assert.equal(room.s.phase, 'settling');
  const before = room.view(a, 'player', 0);
  assert.equal(before.stocks[0].history.length, 0, '정산 중에는 새 종료가가 나가지 않음');
  assert.equal(before.lastResult, null);
  check('정산 중', revealed);
  room.beginRecap(T0);
  const rec = room.view(a, 'player', 0);
  assert.ok(rec.news[0].cards[0].result);
  rec.news[0].cards.forEach(c => revealed.add(c.result!.actual));
  check('결과', revealed);
});
test('상대 주문과 개인 리포트는 비공개다', () => {
  const { room, a, b } = setup();
  const end = toTrade(room);
  room.placeOrder(a, 'secret', 'G01', 'buy', 77, end);
  const vb = room.view(b, 'player', end);
  assert.equal(JSON.stringify(vb).includes('"qty":77'), false);
  assert.equal(room.view(null, 'display', end).report, null);
  assert.equal(room.view(null, 'display', end).portfolio, null);
});
test('학술제 리포트: 기록이 부족하면 안내 문구, 충분하면 계산', () => {
  const room = GameRoom.create({ code: '654321', mode: 'academic', now: T0, seed: 3 });
  const a = room.join(null, T0).token, idle = room.join(null, T0).token;
  assert.equal(room.canStart(a), false);
  assert.equal(room.canStart(null, room.s.operatorToken), true);
  room.start(T0);
  const codes: StockCode[] = ['G01', 'G02', 'G03'];
  let i = 0;
  while (room.s.status === 'playing') {
    if (room.s.phase === 'trade') {
      const t = room.s.phaseEndsAt! - 1;
      assert.equal(room.predict(a, 'A', 70, t), true);
      room.placeOrder(a, `b${i}`, codes[i % 3], 'buy', 20, t);
      const held = room.player(a)!.holdings[codes[(i + 1) % 3]];
      if (held) room.placeOrder(a, `s${i}`, codes[(i + 1) % 3], 'sell', held.qty, t);
      i++;
    }
    next(room);
  }
  assert.equal(room.s.settled.length, 10);
  const full = room.view(a, 'player', 0).report!.metrics!;
  assert.equal(full.find(m => m.key === 'overconfidence')!.available, true);
  assert.equal(full.find(m => m.key === 'herding')!.available, true);
  const none = room.view(idle, 'player', 0).report!.metrics!;
  assert.ok(none.every(m => m.value === '이번 게임에서는 판단할 기록이 부족했어요'));
  assert.ok(full.every(m => m.formula && m.minObservations));
});
test('저장한 상태에서 그대로 복구한다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  room.placeOrder(a, 'keep', 'G01', 'buy', 5, end);
  const restored = new GameRoom(JSON.parse(JSON.stringify(room.s)));
  assert.equal(restored.player(a)!.orders.G01!.qty, 5);
  restored.tick(restored.s.phaseEndsAt!);
  restored.beginRecap(0);
  assert.equal(restored.player(a)!.holdings.G01!.qty, 5);
});
