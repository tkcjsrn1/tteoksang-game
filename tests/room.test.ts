import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom, gameCodes } from '../server/src/room';
import { ARCS } from '../server/src/content';
import { FESTIVAL_MAX_PLAYERS, ROOM_OPTIONS, GROUPS, lowerLimit, stockOf, STOCKS, feeOf } from '../shared/rules';
import type { StockCode } from '../shared/types';

const T0 = 1_000_000;
function setup(opts: Partial<Parameters<typeof GameRoom.create>[0]> = {}) {
  const room = GameRoom.create({ code: '123456', mode: 'friend', now: T0, seed: 7, settings: { level: 'pro' }, ...opts });
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
  assert.equal(room.player(a)!.holdings.G01!.qty, 10);
  const spectator = room.join(null, end);
  assert.equal(spectator.role, 'spectator');
  assert.equal(room.join(spectator.token, end).role, 'spectator');
  assert.equal(room.placeOrder(spectator.token, 'r1', 'G01', 'buy', 1, end).ok, false);
  const v = room.view(spectator.token, 'spectator', end);
  assert.equal(v.portfolio, null);
});
test('접속이 끊겨도 걸어 둔 지정가 예약은 시세가 닿으면 체결된다', () => {
  const { room, a } = setup();
  toTrade(room);
  const live = room.s.live!, path = live.paths.G06;
  const k = path.findIndex((p, i) => i > 0 && p < path[0]);
  assert.ok(k > 0);
  assert.equal(room.placeOrder(a, 'r1', 'G06', 'buy', 100, live.startedAt, 'limit', path[k]).ok, true);
  room.disconnect(a, live.startedAt);
  room.tick(live.startedAt + k * 1000);
  assert.equal(room.player(a)!.holdings.G06!.qty, 100);
  assert.equal(room.player(a)!.fills[0].price, path[k]);
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
  assert.equal(p.holdings.G01!.qty, 10);
  assert.equal(p.fills.length, 1);
  next(room);
  const round = room.s.round, cash = p.cash, fills = p.fills.length, prices = { ...room.s.prices };
  assert.equal(room.settle(round, end), false);
  assert.equal(p.cash, cash); assert.equal(p.fills.length, fills); assert.deepEqual(room.s.prices, prices);
});
test('지정가 예약: 변경에 실패하면 원래 예약을 유지하고, 성공하면 예약금을 다시 잡고, 취소하면 풀린다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  const p = room.player(a)!;
  const low = room.markPrice('G01') - 500;   // 지금 시세보다 낮아 바로 체결되지 않음
  assert.deepEqual(room.placeOrder(a, 'o1', 'G01', 'buy', 10, end, 'limit', low), { ok: true, fill: null });
  assert.equal(p.orders.G01!.qty, 10);
  assert.equal(p.orders.G01!.reserve, low * 10 + feeOf(low * 10));
  assert.equal(room.placeOrder(a, 'o2', 'G01', 'buy', 100000, end, 'limit', low).ok, false);
  assert.equal(p.orders.G01!.qty, 10);
  assert.equal(room.placeOrder(a, 'o3', 'G01', 'buy', 20, end, 'limit', low).ok, true);
  assert.equal(p.orders.G01!.qty, 20);
  assert.equal(room.view(a, 'player', end).portfolio!.reserved, p.orders.G01!.reserve);
  assert.equal(room.cancelOrder(a, 'o4', 'G01', end).ok, true);
  assert.equal(p.orders.G01, undefined);
  assert.equal(room.view(a, 'player', end).portfolio!.reserved, 0);
  /* 10원 단위가 아니거나 가격 제한폭 밖이면 거절 */
  assert.equal(room.placeOrder(a, 'o5', 'G01', 'buy', 1, end, 'limit', low + 5).ok, false);
  assert.equal(room.placeOrder(a, 'o6', 'G01', 'buy', 1, end, 'limit', room.s.prices.G01 * 2).ok, false);
  /* 지금 시세보다 유리한 지정가는 바로 체결(지정가보다 불리하게는 체결하지 않음) */
  const high = room.markPrice('G02') + 300;
  const r = room.placeOrder(a, 'o7', 'G02', 'buy', 10, end, 'limit', high);
  assert.equal(r.ok, true);
  assert.ok(r.fill && r.fill.price <= high && r.fill.price === room.markPrice('G02'));
});
test('끝까지 시세가 닿지 않은 예약은 마감 때 자동 취소되고 예약금이 풀린다', () => {
  /* 판마다 종목이 달라서 이 판에 실제로 나온 종목으로 확인합니다 */
  const { room, a } = setup();
  const end = toTrade(room);
  const p = room.player(a)!;
  const C = gameCodes(room.s.plan)[0];
  const path = room.s.live!.paths[C];
  const never = Math.floor((Math.min(...path) - 100) / 10) * 10;
  assert.ok(never >= lowerLimit(room.s.prices[C]), '이 시드는 하한가까지 여유가 있음');
  assert.equal(room.placeOrder(a, 'n1', C, 'buy', 5, end, 'limit', never).ok, true);
  const cash = p.cash;
  next(room);
  assert.equal(p.orders[C], undefined);
  assert.equal(p.holdings[C], undefined);
  assert.equal(p.cash, cash);
});
test('시장가: 산 주식은 바로 팔 수 있고, 판 돈으로 바로 살 수 있다. 없는 주식은 못 판다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  const p = room.player(a)!;
  const r1 = room.placeOrder(a, 'b1', 'G01', 'buy', 100, end);
  assert.ok(r1.ok && r1.fill && r1.fill.qty === 100);
  assert.equal(p.holdings.G01!.qty, 100);
  assert.equal(p.cash, 10_000_000 - r1.fill!.price * 100 - r1.fill!.fee);
  assert.equal(room.placeOrder(a, 's0', 'G02', 'sell', 1, end).ok, false);
  const r2 = room.placeOrder(a, 's1', 'G01', 'sell', 100, end);
  assert.ok(r2.ok);
  assert.equal(p.holdings.G01, undefined);
  const max = Math.floor(p.cash / room.markPrice('G02'));
  assert.equal(room.placeOrder(a, 'b2', 'G02', 'buy', max + 5, end).ok, false);
  assert.equal(room.placeOrder(a, 'b3', 'G02', 'buy', 10, end).ok, true);
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
test('같은 업종 종목은 대장주 사건 영향의 linkBeta배만큼 함께 움직인다', () => {
  const { room, a } = setup({ forcedArcs: ['nuvakan', 'rate'], forced: { 'nu-1': 'pass', 'nu-2a': 'approved', 'nu-3a': 'short' } });
  toTrade(room);
  while (room.s.status === 'playing') next(room);
  const v = room.view(a, 'player', room.s.phaseEndsAt ?? T0);
  assert.equal(v.stocks.length, 10);
  const leader = v.stocks.find(s => s.code === GROUPS.power.leader)!;
  const peers = v.stocks.filter(s => s.code !== leader.code && stockOf(s.code).group === 'power');
  assert.ok(peers.length >= 1, '뉴스 업종 동반 종목이 판에 있다');
  for (const peer of peers) leader.history.forEach((lp, i) => {
    const pp = peer.history[i];
    for (const e of lp.events) {
      const link = pp.events.find(x => x.stageId === e.stageId && x.label === `업종 동반 · ${e.label}`);
      const bp = Math.round(e.bp * stockOf(peer.code).linkBeta);
      if (bp === 0) { assert.equal(link, undefined); continue; }
      assert.ok(link, `${peer.code} ${e.label}`);
      assert.equal(link.bp, bp);
      assert.match(link.reason, /같은 업종/);
    }
    /* 동반 영향도 상하한 계산(rawBp)에 들어갑니다 */
    assert.equal(pp.rawBp, pp.eventBp + pp.marketBp + pp.stockBp);
  });
  /* 다른 업종 종목에는 동반 영향이 없습니다 */
  v.stocks.filter(s => stockOf(s.code).group !== 'power' && !Object.values(GROUPS).some(g => g.leader === s.code))
    .forEach(s => s.history.forEach(h => assert.ok(h.events.every(e => !e.label.includes('누바칸')))));
});
test('이번 판에 없는 종목은 주문할 수 없다', () => {
  const { room, a } = setup();
  const t = toTrade(room);
  const absent = STOCKS.find(s => !room.s.plan.stockCodes!.includes(s.code))!;
  const r = room.placeOrder(a, 'x1', absent.code, 'buy', 1, t);
  assert.equal(r.ok, false);
  assert.equal(room.placeOrder(a, 'x2', 'G99' as StockCode, 'buy', 1, t).ok, false);
});
test('슬리피지는 큰 시장가 주문을 낸 사람에게만 적용되고 시세·종료가는 바꾸지 않는다. 체결 수량은 거래량에 기록된다', () => {
  const run = (bigQty: number) => {
    const { room, a, b } = setup({ seed: 11 });
    const t = toTrade(room);
    /* 900주를 살 수 있게 이 판에서 가장 싼 종목으로 확인합니다 */
    const C = gameCodes(room.s.plan).sort((x, y) => room.markPrice(x) - room.markPrice(y))[0];
    const ref = room.markPrice(C);
    assert.equal(room.placeOrder(a, 'big', C, 'buy', bigQty, t).ok, true);
    assert.equal(room.placeOrder(b, 'small', C, 'buy', 10, t).ok, true);
    const pa = room.player(a)!, pb = room.player(b)!;
    const path = room.s.live!.paths[C].slice();
    next(room);
    return { room, pa, pb, ref, path, C, h: room.s.history[C][0] };
  };
  const big = run(900), small = run(1);
  const fa = big.pa.fills[0], fb = big.pb.fills[0];
  assert.ok(fa.price > big.ref, '큰 주문은 지금 시세보다 비싸게');
  assert.equal(fa.refPrice, big.ref);
  assert.equal(fb.price, big.ref, '작은 주문은 지금 시세 그대로');
  const r = big.pa.results[0];
  assert.equal(r.slippage, (fa.price - big.ref) * 900, '슬리피지는 정보로만 표시(체결가에 이미 포함)');
  assert.equal(r.delta, r.contributions.reduce((x, c) => x + c.won, 0) - r.fees);
  /* 장중 시세와 종료가는 주문과 무관합니다 */
  assert.deepEqual(big.path, small.path);
  assert.equal(big.h.closePrice, small.h.closePrice);
  /* 거래량: 참가자 + NPC 체결 수량 */
  const npcQty = (room: GameRoom) => room.s.players.filter(p => p.kind === 'npc').flatMap(p => p.fills).filter(f => f.code === big.C).reduce((x, f) => x + f.qty, 0);
  assert.equal(big.h.volume, 900 + 10 + npcQty(big.room));
  assert.equal(big.h.buyQty! + big.h.sellQty!, big.h.volume);
  /* 고가·저가는 장중 시세와 종료가에서 나옵니다(연출 아님) */
  assert.equal(big.h.high, Math.max(...big.path, big.h.closePrice));
  assert.equal(big.h.low, Math.min(...big.path, big.h.closePrice));
  assert.equal(big.h.preClose, big.path[big.path.length - 1]);
});
test('장중 시세: 결말을 담지 않고, 속보는 주문 시간 중간에 뜨며, 화면 시세는 지금까지만 보인다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { room, a } = setup({ seed });
    toTrade(room);
    const live = room.s.live!;
    const plan = room.s.plan.rounds[0];
    const hasBreaking = plan.stages.some(st => st.breaking);
    /* 뉴스 시간에는 속보가 안 보입니다 */
    assert.equal(live.breakAt === null, !hasBreaking);
    const v0 = room.view(a, 'player', live.startedAt);
    assert.equal(v0.news[0].cards.some(c => c.card.breaking), false, `${seed}: 속보는 아직`);
    assert.equal(v0.breakingAt, undefined, '공개 전 속보 시간은 숨김');
    assert.ok(v0.stocks.every(s => s.ticks!.length === 1 && s.price === s.openPrice));
    /* 경로 끝 = 시가 × (1 + 시장 + 종목 + 속보 반응). 사건 결과는 마감 때 */
    for (const st of v0.stocks) {
      const path = live.paths[st.code];
      assert.equal(path[0], room.s.prices[st.code]);
    }
    const mid = live.startedAt + Math.floor(live.steps / 2) * 1000;
    room.tick(mid);
    const v1 = room.view(a, 'player', mid);
    assert.equal(v1.news[0].cards.some(c => c.card.breaking), hasBreaking, `${seed}: 중간에 속보`);
    assert.equal(v1.breakingAt, live.breakAt ?? undefined);
    assert.ok(v1.stocks.every(s => s.ticks!.length === Math.floor(live.steps / 2) + 1));
    assert.ok(v1.stocks.every(s => s.price === live.paths[s.code][Math.floor(live.steps / 2)]));
    /* 결말 문구는 마감 전까지 어디에도 없습니다 */
    const secrets = plan.stages.map(st => ARCS.flatMap(x => x.stages).find(x => x.id === st.stageId)!.outcomes.find(o => o.id === st.outcomeId)!.actual);
    const js = JSON.stringify(v1);
    secrets.forEach(t => assert.equal(js.includes(`"${t}"`), false));
    /* 마감: 시세 끝에서 종료가까지가 사건 결과 몫 */
    next(room);
    for (const st of room.stocks) {
      const h = room.s.history[st.code][0];
      const path = live.paths[st.code];
      assert.equal(h.preClose, path[path.length - 1]);
      if (!h.capped && !h.limit && h.eventBp === 0) {
        const endBp = plan.marketBp + (plan.stockBp[st.code] ?? 0);
        const reactOnly = Math.round((path[path.length - 1] / path[0] - 1) * 10000) - endBp;
        assert.ok(Math.abs(reactOnly) <= 125, `${seed} ${st.code}: 사건이 없으면 시세 끝 ≈ 종료가 (${reactOnly}bp)`);
      }
    }
  }
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
test('순위표는 평가액을 참가자당 한 번 계산하고 공동 순위 다음은 건너뛴다', t => {
  const { room } = setup();
  room.s.players[0].cash += 1000;
  room.s.players[1].cash += 1000;
  const value = t.mock.method(room, 'value');
  const rows = room.leaderboard();
  assert.deepEqual(rows.map(r => r.rank), [1, 1, 3, 3, 3]);
  assert.equal(value.mock.callCount(), rows.length);
});

test('공개 전 정보는 어떤 역할의 화면에도 나가지 않는다', () => {
  const { room, a } = setup({ forcedArcs: ['nuvakan', 'rate'] });
  const secretTexts = ARCS.flatMap(x => x.stages.flatMap(s => s.outcomes.map(o => o.actual)));
  room.start(T0);
  const check = (label: string, allowed: Set<string>) => {
    for (const [tok, role] of [[a, 'player'], [null, 'spectator'], ['x', 'spectator'], [null, 'operator'], [null, 'display']] as const) {
      const js = JSON.stringify(room.view(tok, role, T0));
      assert.equal(js.includes('seed'), false, label);
      assert.equal(js.includes('outcomeId'), false, label);
      assert.equal(js.includes('clueDir'), false, label);
      for (const t of secretTexts) if (!allowed.has(t)) assert.equal(js.includes(`"${t}"`), false, `${label}: ${t}`);
    }
  };
  const revealed = new Set<string>();
  /* 결과 예측: 공개 전에는 맞았는지·집계가 어느 화면에도 나가지 않습니다 */
  assert.equal(room.predict(a, 'up', 90, T0), true);
  const noVerdict = (label: string) => {
    for (const [tok, role] of [[a, 'player'], [null, 'spectator'], [null, 'operator'], [null, 'display']] as const) {
      const v = room.view(tok, role, T0);
      assert.equal(v.prediction?.correct ?? null, null, `${label}: 맞았는지 공개 전에 나감`);
      assert.equal(v.crowd ?? null, null, `${label}: 예측 집계가 공개 전에 나감`);
      assert.equal(v.predictionTrend, undefined, `${label}: 라운드별 정답 수는 판이 끝난 뒤에만`);
      assert.equal(v.recapDone ?? null, null, `${label}: '다 봤어요' 집계는 결과 화면에서만`);
    }
  };
  check('뉴스', revealed); noVerdict('뉴스');
  next(room); check('주문', revealed); noVerdict('주문');
  room.tick(room.s.phaseEndsAt!);
  assert.equal(room.s.phase, 'settling');
  const before = room.view(a, 'player', 0);
  assert.equal(before.stocks[0].history.length, 0, '정산 중에는 새 종료가가 나가지 않음');
  assert.equal(before.lastResult, null);
  check('정산 중', revealed); noVerdict('정산 중');
  room.beginRecap(T0);
  const rec = room.view(a, 'player', 0);
  assert.ok(rec.news[0].cards[0].result);
  rec.news[0].cards.forEach(c => revealed.add(c.result!.actual));
  check('결과', revealed);
});
test('상대 주문과 개인 리포트는 비공개다', () => {
  const { room, a, b } = setup();
  const end = toTrade(room);
  const tradeAt = room.s.live!.startedAt + 2000;
  room.tick(tradeAt);
  assert.equal(room.placeOrder(a, 'secret', 'G01', 'buy', 77, tradeAt).ok, true);
  const ownFill = room.view(a, 'player', tradeAt).portfolio!.fillLog.find(f => f.qty === 77);
  assert.equal(ownFill?.tick, 2);
  assert.equal(ownFill?.price, room.player(a)!.fills.find(f => f.qty === 77)?.price);
  const vb = room.view(b, 'player', end);
  assert.equal(JSON.stringify(vb).includes('"qty":77'), false);
  /* 이번 판 사건 id는 판이 끝나기 전에는 아무에게도 나가지 않습니다(다음 사건을 미리 아는 힌트) */
  assert.equal(vb.arcIds, undefined);
  assert.equal(room.view(a, 'player', end).arcIds, undefined);
  assert.equal(room.view(null, 'spectator', end).arcIds, undefined);
  assert.equal(room.view(null, 'spectator', end).report, null);
  assert.equal(room.view(null, 'spectator', end).portfolio, null);
  /* 거래량·매수·매도 수량은 정산이 끝나 결과가 공개된 뒤에만, 종목별 합계로만 나갑니다 */
  const close = room.s.phaseEndsAt!;
  room.tick(close);
  assert.equal(room.s.phase, 'settling');
  for (const role of ['player', 'spectator'] as const) {
    const v = room.view(role === 'player' ? b : null, role, close);
    assert.ok(v.stocks.every(s => s.history.length === 0), '정산 중 거래량 비공개');
    assert.equal(JSON.stringify(v).includes('"volume"'), false);
  }
  room.beginRecap(close);
  const after = room.view(b, 'player', close);
  assert.ok(after.stocks.find(s => s.code === 'G01')!.history[0].volume! >= 77);
  /* 개인 체결 내역(fills)은 다른 참가자에게 나가지 않습니다 */
  assert.equal(after.portfolio!.fillLog.some(f => f.qty === 77), false);
});
test('행동 리포트: 기록이 부족하면 안내 문구, 충분하면 계산', () => {
  const room = GameRoom.create({ code: '654321', mode: 'friend', now: T0, seed: 3 });
  const a = room.join(null, T0).token, idle = room.join(null, T0).token;
  assert.equal(room.canStart(idle), false, '방장만 시작');
  assert.equal(room.canStart(a), true);
  room.start(T0);
  const codes: StockCode[] = room.s.plan.stockCodes!.slice(0, 3);
  let i = 0;
  while (room.s.status === 'playing') {
    if (room.s.phase === 'trade') {
      const t = room.s.phaseEndsAt! - 1;
      room.placeOrder(a, `b${i}`, codes[i % 3], 'buy', 20, t);
      room.placeOrder(a, `c${i}`, codes[(i + 2) % 3], 'buy', 10, t);
      const held = room.player(a)!.holdings[codes[(i + 1) % 3]];
      if (held) room.placeOrder(a, `s${i}`, codes[(i + 1) % 3], 'sell', held.qty, t);
      i++;
    }
    next(room);
  }
  assert.equal(room.s.settled.length, 5);
  const full = room.view(a, 'player', 0).report!.metrics;
  assert.deepEqual(full.map(m => m.key), ['disposition', 'herding', 'overreaction', 'overconfidence']);
  assert.equal(full.find(m => m.key === 'herding')!.available, true);
  assert.equal(full.find(m => m.key === 'overreaction')!.available, true);
  const none = room.view(idle, 'player', 0).report!.metrics;
  assert.ok(none.every(m => m.value === '이번 게임에서는 판단할 기록이 부족했어요'));
  assert.ok(full.every(m => m.formula && m.minObservations));
});
test('저장한 상태에서 그대로 복구한다', () => {
  const { room, a } = setup();
  const end = toTrade(room);
  room.placeOrder(a, 'keep', 'G01', 'buy', 5, end);
  const low = room.markPrice('G02') - 300;
  room.placeOrder(a, 'wait', 'G02', 'buy', 3, end, 'limit', low);
  const restored = new GameRoom(JSON.parse(JSON.stringify(room.s)));
  assert.equal(restored.player(a)!.holdings.G01!.qty, 5);
  assert.equal(restored.player(a)!.orders.G02!.price, low);
  assert.deepEqual(restored.s.live, room.s.live, '장중 시세도 그대로');
  restored.tick(restored.s.phaseEndsAt!);
  restored.beginRecap(0);
  assert.equal(restored.player(a)!.holdings.G01!.qty, 5);
  assert.equal(restored.player(a)!.orders.G02, undefined);
});

test('작은 시장가 매도의 슬리피지는 0이다(스프레드는 슬리피지가 아님, 주문 전 미리보기와 같은 기준)', () => {
  const { room, a } = setup({ seed: 11 });
  const code = room.s.plan.stockCodes![0];
  const t = toTrade(room);
  assert.equal(room.placeOrder(a, 'buy10', code, 'buy', 10, t).ok, true);   // 10주는 호가 한 칸 안에서 체결
  const ref = room.markPrice(code);
  assert.equal(room.placeOrder(a, 'sell1', code, 'sell', 1, t).ok, true);
  const p = room.player(a)!;
  const sell = p.fills.find(f => f.requestId === 'sell1')!;
  assert.equal(sell.price, ref - 10, '파는 쪽은 시세보다 한 칸 낮은 최우선 매수 호가에 체결(스프레드)');
  next(room);
  assert.equal(p.results[0].slippage, 0, '사고판 수량이 호가 한 칸 안이므로 슬리피지 0');
});

test('정원을 80명으로 열면 80명이 들어와 한 판을 끝까지 마친다', () => {
  const room = GameRoom.create({ code: '654321', mode: 'friend', now: T0, seed: 11, settings: { maxPlayers: 80 } });
  const toks = Array.from({ length: 80 }, (_, i) => room.join(null, T0 + i));
  assert.equal(room.humans.length, 80);
  assert.equal(room.join(null, T0 + 80).role, 'spectator');   // 정원을 넘으면 관전자
  room.start(T0 + 100);
  let guard = 0;
  while (room.s.status !== 'finished' && guard++ < 100) {
    if (room.s.phase === 'trade') {
      const now = room.s.phaseEndsAt! - 1000;
      const codes = room.s.plan.stockCodes ?? [];
      assert.ok(codes.length > 0, '이번 판 종목');
      /* 사람마다 다른 종목·수량을 사서 정산과 순위가 한 줄로 몰리지 않게 합니다 */
      toks.forEach((t, i) => room.placeOrder(t.token, `r${room.s.round}-${i}`, codes[i % codes.length], 'buy', 1 + (i % 7), now, 'market'));
    }
    next(room);
  }
  assert.equal(room.s.status, 'finished');
  const v = room.view(toks[0].token, toks[0].role, T0);
  assert.equal(v.leaderboard.length, 83, '사람 80명 + NPC 3명');
  const ranks = v.leaderboard.map(l => l.rank), vals = v.leaderboard.map(l => l.value);
  assert.equal(ranks[0], 1, '1위부터 시작');
  assert.ok(ranks.every((r, i) => i === 0 || r >= ranks[i - 1]), '등수가 뒤로 갈수록 커지거나 같다(동률 허용)');
  assert.ok(vals.every((x, i) => i === 0 || vals[i - 1] >= x), '평가액 내림차순');
  assert.equal(room.s.players.filter(p => p.cash < 0).length, 0, '현금이 음수인 참가자');
});

test('운영자 방: 참가자 방장이 없고 운영자 열쇠로만 시작하며, 열쇠는 어떤 화면에도 나가지 않는다', () => {
  const room = GameRoom.create({ code: '777777', mode: 'friend', now: T0, seed: 5, settings: { maxPlayers: 80 }, operated: true });
  const key = room.s.operatorToken!;
  assert.ok(key && key.length > 10);
  const a = room.join(null, T0).token;
  assert.equal(room.s.hostId, null, '먼저 들어온 참가자도 방장이 아님');
  assert.equal(room.view(a, 'player', T0).you.isHost, false);
  assert.equal(room.view(a, 'player', T0).operated, true);
  assert.equal(room.view(a, 'player', T0).minToStart, 1, '운영자 방은 1명이면 시작 가능(리허설)');
  assert.equal(room.canStart(a), false, '참가자는 시작 못 함');
  assert.equal(room.canStart(a, 'x'.repeat(key.length)), false, '틀린 열쇠');
  assert.equal(room.canStart(null, key.slice(1)), false, '길이가 다른 열쇠');
  assert.equal(room.canStart(null, ''), false);
  assert.equal(room.canStart(null, key), true);
  /* 판이 시작되고 끝날 때까지 어느 역할의 화면에도 열쇠가 실리지 않습니다 */
  const views = () => [[a, 'player'], [null, 'spectator'], [null, 'operator'], [null, 'display']] as const;
  const noKey = (label: string) => { for (const [tok, role] of views()) assert.equal(JSON.stringify(room.view(tok, role, T0)).includes(key), false, `${label} ${role}`); };
  noKey('대기실');
  room.start(T0);
  while (room.s.status === 'playing') { next(room); if (room.s.phase === 'trade') noKey(`R${room.s.round} 주문`); }
  noKey('최종');
  /* 운영자·대형 화면은 개인 자산이 없습니다 */
  for (const role of ['operator', 'display'] as const) {
    const v = room.view(null, role, T0);
    assert.equal(v.portfolio, null);
    assert.equal(v.report, null);
    assert.equal(v.lastResult, null);
    assert.equal(v.card, null);
  }
});
test('운영자 방이 아니면 열쇠가 없고 기존처럼 방장이 시작한다', () => {
  const { room, a } = setup();
  assert.equal(room.s.operatorToken, null);
  assert.equal(room.operated, false);
  assert.equal(room.isOperator(null), false);
  assert.equal(room.isOperator(''), false);
  assert.equal(room.canStart(null, ''), false);
  assert.equal(room.canStart(a), true);
  assert.equal(room.view(a, 'player', T0).operated, false);
});

test('정원 상한은 80명이고, 고를 수 있는 가장 큰 정원과 같다', () => {
  assert.equal(FESTIVAL_MAX_PLAYERS, 80);
  assert.equal(Math.max(...ROOM_OPTIONS.maxPlayers), FESTIVAL_MAX_PLAYERS);
  const room = GameRoom.create({ code: '808080', mode: 'friend', now: T0, seed: 1, settings: { maxPlayers: FESTIVAL_MAX_PLAYERS }, operated: true });
  for (let i = 0; i < FESTIVAL_MAX_PLAYERS; i++) assert.equal(room.join(null, T0 + i).role, 'player');
  assert.equal(room.join(null, T0 + 100).role, 'spectator', '81번째는 관전자');
  assert.equal(room.humans.length, FESTIVAL_MAX_PLAYERS);
});

test('대기실에서 탭을 닫은 자리는 인원에서 빠지고, 꽉 차면 새 사람에게 넘어간다', () => {
  const room = GameRoom.create({ code: '777777', mode: 'friend', now: T0, seed: 3, settings: { maxPlayers: 8 } });
  const tokens = Array.from({ length: 8 }, (_, i) => room.join(null, T0 + i).token);
  assert.equal(room.view(tokens[0], 'player', T0 + 10).humanCount, 8);
  room.disconnect(tokens[3], T0 + 11);
  /* 끊긴 자리는 대기실 인원에서 빠집니다 */
  assert.equal(room.view(tokens[0], 'player', T0 + 12).humanCount, 7);
  /* 정원이 찼어도 끊긴 자리가 있으면 새로 온 사람은 관전자가 아니라 참가자입니다 */
  const late = room.join(null, T0 + 13);
  assert.equal(late.role, 'player');
  assert.equal(room.humans.length, 8);
  assert.equal(room.player(tokens[3]), null);
  /* 빈자리가 없으면 그때는 관전자입니다 */
  assert.equal(room.join(null, T0 + 14).role, 'spectator');
  /* 끊기지 않은 사람은 그대로 다시 들어옵니다 */
  assert.equal(room.join(tokens[0], T0 + 15).role, 'player');
});

test('대기실 시작 조건은 지금 접속 중인 사람으로 센다', () => {
  const { room, a, b } = setup();
  assert.equal(room.canStart(a), true);
  room.disconnect(b, T0 + 2);
  assert.equal(room.canStart(a), false);
  room.join(b, T0 + 3);
  assert.equal(room.canStart(a), true);
});

test('결과 예측: 뉴스·주문 시간에만 고르고, 결과 공개 때 채점과 집계가 나온다', () => {
  const { room, a, b } = setup();
  room.start(T0);
  assert.equal(room.s.phase, 'news');
  /* 뉴스 시간에 고르고 주문 시간에 바꿀 수 있습니다. 확신도는 50·70·90만 */
  assert.equal(room.predict(a, 'up', 70, T0), true);
  assert.equal(room.predict(a, 'up', 60, T0), false);
  assert.equal(room.predict(a, 'sideways' as 'up', 70, T0), false);
  assert.equal(room.predict('nobody', 'up', 70, T0), false);
  const va = room.view(a, 'player', T0).prediction!;
  assert.deepEqual([va.choice, va.confidence, va.open, va.correct], ['up', 70, true, null]);
  assert.equal(room.view(null, 'spectator', T0).prediction, null, '관전자에게는 예측 칸이 없음');
  const end = toTrade(room);
  assert.equal(room.predict(a, 'down', 90, end), true, '주문 시간에는 바꿀 수 있음');
  assert.equal(room.predict(b, 'up', 50, end), true);
  /* 다른 사람의 선택은 내 화면에 나오지 않습니다 */
  assert.equal(room.view(a, 'player', end).prediction!.choice, 'down');
  assert.equal(room.view(b, 'player', end).prediction!.choice, 'up');
  room.tick(room.s.phaseEndsAt!);
  assert.equal(room.predict(a, 'up', 90, room.s.phaseEndsAt ?? end + 5000), false, '정산이 시작되면 못 바꿈');
  room.beginRecap(room.s.phaseEndsAt ?? end + 5000);
  const first = room.s.plan.rounds[0].stages[0];
  const beat = ARCS.flatMap(x => x.stages).find(s => s.id === first.stageId)!.outcomes.find(o => o.id === first.outcomeId)!.beat;
  const ra = room.view(a, 'player', T0).prediction!, rb = room.view(b, 'player', T0).prediction!;
  assert.equal(ra.correct, !beat);
  assert.equal(rb.correct, beat);
  assert.equal(ra.open, false);
  const crowd = room.view(null, 'display', T0).crowd!;
  assert.deepEqual(crowd, { up: 1, down: 1, beat });
});

test('결과 예측이 3건 이상이면 판 끝 리포트에 정답률과 과신이 나온다', () => {
  const { room, a } = setup({ settings: { level: 'pro', rounds: 3 } });
  room.start(T0);
  let hits = 0;
  while (room.s.status === 'playing') {
    if (room.s.phase === 'news') {
      const first = room.s.plan.rounds[room.s.round - 1].stages[0];
      const beat = ARCS.flatMap(x => x.stages).find(s => s.id === first.stageId)!.outcomes.find(o => o.id === first.outcomeId)!.beat;
      /* 첫 라운드만 일부러 틀립니다 */
      const right = room.s.round !== 1;
      if (right) hits++;
      assert.equal(room.predict(a, (beat === right) ? 'up' : 'down', 90, room.s.phaseEndsAt! - 1), true);
    }
    next(room);
  }
  const m = room.view(a, 'player', T0).report!.metrics.find(x => x.key === 'overconfidence')!;
  assert.equal(m.available, true);
  assert.ok(m.value.startsWith(`정답 ${hits}/3`), m.value);
  assert.ok(m.text.includes('더 자신 있게'), '확신도 90% · 정답률 67%면 과신');
});

test('발표용 빠른 판은 3라운드, 뉴스 15초·장 30초·결과 15초로 진행하고 라운드 수·장 시간 설정보다 우선한다', () => {
  const room = GameRoom.create({ code: '717171', mode: 'friend', now: T0, seed: 4, settings: { pace: 'demo', rounds: 10, trade: 120 } });
  room.join(null, T0); room.join(null, T0 + 1);
  assert.equal(room.s.plan.rounds.length, 3, '판 구성도 3라운드');
  room.start(T0);
  assert.equal(room.s.phaseSeconds, 15);
  next(room); assert.equal(room.s.phase, 'trade'); assert.equal(room.s.phaseSeconds, 30);
  next(room); assert.equal(room.s.phase, 'recap'); assert.equal(room.s.phaseSeconds, 15);
  assert.equal(room.view(null, 'display', T0).totalRounds, 3);
  assert.equal(room.view(null, 'display', T0).pace, 'demo');
});

test('운영자의 다음 단계: 뉴스·장·결과를 시간이 다 된 것과 같은 경로로 넘기고, 대기실·정산 중에는 넘기지 않는다', () => {
  const room = GameRoom.create({ code: '727272', mode: 'friend', now: T0, seed: 4, operated: true, settings: { rounds: 3 } });
  const a = room.join(null, T0).token;
  assert.equal(room.skipPhase(T0), false, '대기실');
  room.start(T0);
  const step = (at: number) => { assert.equal(room.skipPhase(at), true); const r = room.tick(at); if (r === 'settled') { assert.equal(room.skipPhase(at), false, '정산 중'); room.beginRecap(at); } };
  step(T0 + 1000);
  assert.equal(room.s.phase, 'trade');
  const t = room.s.live!.startedAt;
  room.tick(t + 3000);
  assert.equal(room.placeOrder(a, 'k1', gameCodes(room.s.plan)[0], 'buy', 10, t + 3000).ok, true);
  step(t + 4000);
  assert.equal(room.s.phase, 'recap', '장을 넘기면 바로 정산·결과');
  assert.equal(room.s.settled.includes(1), true);
  assert.ok(room.player(a)!.results.length === 1, '체결은 정산에 반영');
  step(t + 5000);
  assert.deepEqual([room.s.round, room.s.phase], [2, 'news'], '결과를 넘기면 다음 라운드 뉴스');
  /* 끝까지 넘기면 최종 결과 */
  while (room.s.status === 'playing') step(room.s.phaseEndsAt! - 1);
  assert.equal(room.s.status, 'finished');
  assert.equal(room.skipPhase(T0 + 999_999), false, '끝난 판');
});

test('판이 끝나면 라운드별 예측 정답 수(사람만, 합계)를 보여 준다', () => {
  const { room, a, b } = setup({ settings: { rounds: 3 } });
  room.start(T0);
  const answers: boolean[][] = [];
  while (room.s.status === 'playing') {
    if (room.s.phase === 'news') {
      const now = room.s.newsStartedAt;
      assert.equal(room.predict(a, 'up', 70, now), true);
      if (room.s.round !== 2) assert.equal(room.predict(b, 'down', 50, now), true);   // 2라운드는 b가 예측 안 함
    }
    next(room);
    if (room.s.phase === 'recap') answers.push([a, b].map(t => room.player(t)!.predictions?.[room.s.round]?.correct).filter(x => x !== undefined) as boolean[]);
  }
  const v = room.view(a, 'player', T0);
  assert.deepEqual(v.predictionTrend, answers.map((xs, i) => ({ round: i + 1, total: xs.length, correct: xs.filter(Boolean).length })));
  assert.deepEqual(v.predictionTrend!.map(r => r.total), [2, 1, 2]);
  assert.equal(JSON.stringify(v.predictionTrend).includes(room.player(a)!.id), false, '누가 맞혔는지는 담지 않음');
});

test("'다 봤어요': 혼자 연습은 바로, 친구 대전은 접속 중인 사람 모두가 누르면 다음 라운드로 넘어간다", () => {
  /* 혼자 연습 */
  const solo = GameRoom.create({ code: '818181', mode: 'solo', now: T0, seed: 2 });
  const me = solo.join(null, T0).token;
  solo.start(T0);
  assert.equal(solo.markDone(me, T0), false, '뉴스 때는 못 누름');
  while (solo.s.phase !== 'recap') next(solo);
  const at = solo.s.phaseEndsAt! - 10_000;
  assert.equal(solo.markDone(me, at), true);
  solo.tick(at);
  assert.deepEqual([solo.s.round, solo.s.phase], [2, 'news']);

  /* 친구 대전: a만 누르면 그대로, b까지 누르면 넘어감 */
  const { room, a, b } = setup();
  room.start(T0);
  while (room.s.phase !== 'recap') next(room);
  const t = room.s.phaseEndsAt! - 10_000;
  assert.equal(room.markDone(a, t), true);
  room.tick(t);
  assert.equal(room.s.phase, 'recap', '한 명만 눌렀으면 기다림');
  assert.deepEqual(room.view(a, 'player', t).recapDone, { done: 1, total: 2, me: true });
  assert.deepEqual(room.view(b, 'player', t).recapDone, { done: 1, total: 2, me: false });
  assert.equal(room.markDone(b, t), true);
  room.tick(t);
  assert.deepEqual([room.s.round, room.s.phase], [2, 'news']);

  /* 누른 사람만 남고 나머지가 나가면 넘어감 */
  while (room.s.phase !== 'recap') next(room);
  const t2 = room.s.phaseEndsAt! - 10_000;
  room.markDone(a, t2);
  room.disconnect(b, t2);
  room.tick(t2);
  assert.deepEqual([room.s.round, room.s.phase], [3, 'news']);
});

test("운영자 방에서는 '다 봤어요'를 받지 않는다(운영자가 진행)", () => {
  const room = GameRoom.create({ code: '828282', mode: 'friend', now: T0, seed: 2, operated: true });
  const a = room.join(null, T0).token;
  room.start(T0);
  while (room.s.phase !== 'recap') next(room);
  assert.equal(room.markDone(a, room.s.phaseEndsAt! - 1000), false);
  assert.equal(room.view(a, 'player', T0).recapDone, null);
});
