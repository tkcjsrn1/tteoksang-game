/* 코드 동결 전 마무리: 지정가는 호가 수량만큼만 체결, 대형 속보로 움직인 몫은 종가에도 남는다 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { buildPlan, hasShock } from '../server/src/plan';
import { stageById } from '../server/src/content';
import { limitFill, MAX_RETURN_BP, SHOCK_BP, type QuoteBook } from '../shared/rules';

const T0 = 5_000_000;

test('limitFill: 지정가보다 불리하지 않은 호가 수량까지만, 그 호가들의 평균가로 체결한다', () => {
  const book: QuoteBook = { asks: [{ price: 1000, qty: 5 }, { price: 1010, qty: 5 }], bids: [{ price: 990, qty: 4 }, { price: 980, qty: 4 }] };
  assert.deepEqual(limitFill(book, 'buy', 100, 1000), { qty: 5, price: 1000 });
  assert.deepEqual(limitFill(book, 'buy', 8, 1010), { qty: 8, price: Math.ceil((5 * 1000 + 3 * 1010) / 8) });
  assert.equal(limitFill(book, 'buy', 3, 990), null, '지정가 아래에 매도 호가가 없으면 체결 없음');
  assert.deepEqual(limitFill(book, 'sell', 100, 990), { qty: 4, price: 990 });
  assert.equal(limitFill(book, 'sell', 0, 990), null);
});

test('지정가: 현재가로 큰 수량을 넣어도 첫 호가 수량만 바로 체결되고 나머지는 예약으로 남는다(슬리피지 우회 막기)', () => {
  const room = GameRoom.create({ code: '939393', mode: 'friend', now: T0, seed: 7, forcedArcs: ['nuvakan', 'semorium'], settings: { level: 'pro' } });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  const now = room.s.live!.startedAt;
  const code = room.stocks[0].code;
  const me = room.humans[0];
  const ref = room.markPrice(code);
  const want = Math.floor(me.cash / (ref * 1.01));
  const res = room.placeOrder(a, 'big', code, 'buy', want, now, 'limit', ref);
  assert.equal(res.ok, true, res.reason);
  assert.ok(res.fill, '닿은 호가가 있는데 바로 체결되지 않음');
  assert.ok(res.fill.qty < want, `호가 수량(${res.fill.qty})을 넘어 ${want}주 전부 체결됨`);
  assert.ok(res.fill.price <= ref, '지정가보다 비싸게 체결됨');
  const rest = me.orders[code];
  assert.ok(rest && rest.kind === 'limit' && rest.side === 'buy', '남은 수량이 예약으로 남지 않음');
  assert.equal(res.fill.qty + rest.qty, want, '체결 + 예약 수량이 주문 수량과 다름');
  assert.equal(rest.price, ref);
  /* 다음 초부터도 한 번에 전부가 아니라 그 초 호가 수량만큼만 체결됩니다. 체결과 예약의 합은 늘 주문 수량입니다 */
  room.tick(now + 1000);
  const filled = me.fills.filter(f => f.requestId === 'big').reduce((s, f) => s + f.qty, 0);
  assert.equal(filled + (me.orders[code]?.qty ?? 0), want, '예약 체결 뒤 수량이 맞지 않음');
});

/** 대형 속보가 있는 판을 정산까지 돌려, 대상 종목의 장중 마지막 가격·속보 직후 가격·종가를 돌려줍니다 */
function runShock(seed: number) {
  const room = GameRoom.create({ code: '949494', mode: 'solo', now: T0, seed });
  room.join(null, T0); room.start(T0);
  let now = T0;
  for (let i = 0; i < 200; i++) {
    if (room.s.phase === 'trade' && room.currentRound.stages.some(s => s.shock)) break;
    now = room.s.phaseEndsAt ?? now;
    if (room.tick(now) === 'settled') room.beginRecap(now);
  }
  const ps = room.currentRound.stages.find(s => s.shock)!;
  const stage = stageById.get(ps.stageId)!;
  const target = stage.targets[0], dir = stage.signal[target]!;
  const path = room.s.live!.paths[target];
  const base = path[0], afterShock = path[room.s.live!.breakAt!], last = path[path.length - 1];
  assert.equal(room.tick(room.s.phaseEndsAt!), 'settled');
  const b = room.s.history[target]!.at(-1)!;
  const shockEv = b.events.filter(e => e.label === '대형 속보 반응');
  assert.equal(shockEv.length, 1, `${target}: 종가 근거에 대형 속보 반응이 없음`);
  assert.equal(shockEv[0].bp, dir * SHOCK_BP);
  /* 대형 속보 반응을 뺀 나머지 사건 몫(이 사건의 결과 + 같은 라운드 다른 뉴스·업종 동반) */
  const outcomeBp = b.eventBp - shockEv[0].bp;
  return { dir, outcomeBp, base, afterShock, last, close: b.closePrice, capped: b.capped || b.limit !== null };
}

test('대형 속보: 종가는 속보 직후 가격 위에서 사건 결과만큼 움직인다(악재 속보 + 악재 결과면 더 내려감)', () => {
  let same = 0, cases = 0;
  for (let seed = 1; seed < 400 && cases < 12; seed++) {
    if (!hasShock(buildPlan(seed, 'solo'))) continue;
    const r = runShock(seed);
    cases++;
    if (r.capped) continue;
    const move = r.close - r.last, expect = Math.round(r.base * r.outcomeBp / 10000);
    assert.ok(Math.abs(move - expect) <= 20, `시드 ${seed}: 장 마감 뒤 움직임 ${move}원, 사건 결과로는 ${expect}원`);
    if (Math.sign(r.outcomeBp) === r.dir) {
      same++;
      assert.ok(r.dir * (r.close - r.afterShock) > 0, `시드 ${seed}: 결과가 속보와 같은 방향인데 종가가 속보 직후보다 되돌아감`);
    }
  }
  assert.ok(cases >= 8, '대형 속보 판을 충분히 찾지 못함');
  assert.ok(same >= 1, '속보와 같은 방향 결과를 한 번도 확인하지 못함');
  assert.ok(MAX_RETURN_BP >= 2000);
});
