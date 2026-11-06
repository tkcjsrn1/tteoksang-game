import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, buildCandle, movingAverage } from '../shared/candles';
import { checkOrder, computeClose, feeOf, lowerLimit, maxBuyQty, MODES, upperLimit } from '../shared/rules';
import { ARCS, CARDS } from '../server/src/content';
import { buildPlan } from '../server/src/plan';

test('기획서 예시 계산: 12,400원 +780bp는 13,370원, +7.82%', () => {
  const b = computeClose(1, 12400, [{ stageId: 'x', label: 'L', bp: 900, reason: 'r' }], -50, -70);
  assert.equal(b.rawBp, 780);
  assert.equal(b.closePrice, 13370);
  assert.equal(b.changeBp, 782);
  assert.equal(b.roundedPrice, 13370);
});
test('수익률 제한과 상·하한가', () => {
  const up = computeClose(1, 12400, [{ stageId: 'x', label: 'L', bp: 2200, reason: 'r' }], 0, 0);
  assert.equal(up.closePrice, 14880); assert.equal(up.capped, true); assert.equal(up.limit, 'upper');
  const dn = computeClose(1, 12400, [{ stageId: 'x', label: 'L', bp: -2200, reason: 'r' }], 0, 0);
  assert.equal(dn.closePrice, 9920); assert.equal(dn.limit, 'lower');
  assert.equal(upperLimit(6310), 7570);   // 7,572 → 10원 단위로 내림
  assert.equal(lowerLimit(6310), 5050);   // 5,048 → 10원 단위로 올림
  assert.equal(lowerLimit(110), 100);     // 최저 100원
});
test('반올림 내역이 기록된다', () => {
  const b = computeClose(1, 8700, [], 13, 0); // 8,711.31 → 8,710
  assert.equal(b.closePrice, 8710);
  assert.equal(b.roundingWon, 8710 - 8711);
  assert.equal(b.summary.endsWith('시장·종목 변동'), true);
});
test('−4.6% 요약 문구 형식', () => {
  const b = computeClose(3, 10000, [{ stageId: 'n', label: '기대에 못 미친 계약 규모', bp: -500, reason: 'r' }], 30, 10);
  assert.equal(b.closePrice, 9540);
  assert.equal(b.summary, '−4.6% · 기대에 못 미친 계약 규모');
});
test('수수료는 주문별 0.20%를 원 단위로 올림', () => {
  assert.equal(feeOf(1240000), 2480);
  assert.equal(feeOf(1001), 3);
});
test('매수 예약금 합계는 라운드 시작 현금 이내, 변경은 기존 주문을 돌려받고 검증', () => {
  const o = { code: 'G01' as const, side: 'buy' as const, qty: 500, price: 10000, gross: 5_000_000, fee: 10_000, reserve: 5_010_000, requestId: 'a', placedAt: 0 };
  const ctx = { cash: 10_000_000, holdings: {}, orders: { G01: o } };
  assert.equal(checkOrder(ctx, 'G02', 'buy', 500, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 998, 10000).ok, true);
  assert.equal(maxBuyQty({ cash: 10_000_000, holdings: {}, orders: {} }, 'G01', 12400), 804);
  assert.equal(checkOrder(ctx, 'G03', 'sell', 1, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 0, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 1.5, 10000).ok, false);
});
test('콘텐츠 분량과 범위: 뉴스 20개 이상, 돌발 5개 이상, 근거 필수', () => {
  const stages = ARCS.flatMap(a => a.stages);
  assert.ok(stages.length >= 20, `뉴스 ${stages.length}개`);
  assert.ok(CARDS.length >= 5);
  for (const s of stages) {
    assert.ok(s.expectation && s.facts && s.remaining && s.clue && s.concept, s.id);
    assert.ok(s.outcomes.length >= 2, s.id);
    for (const o of s.outcomes) {
      assert.ok(o.actual && o.gap && o.label);
      for (const i of o.impacts) { assert.ok(Math.abs(i.bp) <= 1500, s.id); assert.ok(i.reason, s.id); }
    }
  }
  for (const a of ARCS) for (const s of a.stages) if (s.requires) {
    const prev = a.stages.filter(x => x.step === s.step - 1).flatMap(x => x.outcomes.map(o => o.id));
    for (const r of s.requires) assert.ok(prev.includes(r), `${s.id}의 조건 ${r}`);
  }
});
test('약한 호재는 하락할 수 있고, 같은 사건이 종목별로 반대로 작용한다', () => {
  const short = ARCS.find(a => a.id === 'nuvakan')!.stages.find(s => s.id === 'nu-3a')!.outcomes.find(o => o.id === 'short')!;
  assert.equal(short.impacts[0].bp, -500);
  assert.match(short.actual, /6천/);
  const hike = ARCS.find(a => a.id === 'heatwave')!.stages.find(s => s.id === 'heat-2')!.outcomes.find(o => o.id === 'hike8')!;
  assert.ok(hike.impacts.find(i => i.code === 'G03')!.bp < 0);
  assert.ok(hike.impacts.find(i => i.code === 'G01')!.bp > 0);
});
test('같은 시드는 같은 시나리오, 다른 시드는 다른 시나리오', () => {
  assert.deepEqual(buildPlan(42, 'friend'), buildPlan(42, 'friend'));
  assert.notDeepEqual(buildPlan(42, 'friend'), buildPlan(43, 'friend'));
});
test('모드별 라운드 구성과 변동 범위', () => {
  for (const mode of ['friend', 'solo', 'academic'] as const) for (let seed = 1; seed < 200; seed++) {
    const p = buildPlan(seed, mode);
    assert.equal(p.rounds.length, MODES[mode].rounds);
    assert.ok(p.rounds.every(r => r.stages.length >= 1 && r.stages.length <= 2), `${mode} ${seed}`);
    assert.ok(p.rounds.every(r => Math.abs(r.marketBp) <= 50 && Object.values(r.stockBp).every(x => Math.abs(x) <= 150)));
  }
});
test('재대전은 직전에 하지 않은 사건을 우선 고른다', () => {
  for (let seed = 1; seed < 100; seed++) {
    const a = buildPlan(seed, 'friend');
    const b = buildPlan(seed + 1, 'friend', a.arcIds);
    assert.equal(b.arcIds.some(x => a.arcIds.includes(x)), false);
  }
});
test('수업 1: 봉 하나는 시가 10,000 고가 10,400 저가 9,800 종가 10,200 양봉', () => {
  const c = buildCandle(0, [10000, 10400, 9800, 10200].map((price, i) => ({ minute: i, price, qty: 10 })));
  assert.deepEqual([c.open, c.high, c.low, c.close, c.direction], [10000, 10400, 9800, 10200, 'up']);
});
test('수업 2: 1분봉을 5분봉으로 묶어도 가격과 거래량이 맞다', () => {
  const t = [
    { minute: 0, price: 100, qty: 5 }, { minute: 1, price: 120, qty: 3 }, { minute: 4, price: 90, qty: 2 },
    { minute: 5, price: 95, qty: 4 }, { minute: 9, price: 110, qty: 6 }
  ];
  const five = aggregate(t, 5);
  assert.equal(five.length, 2);
  assert.deepEqual([five[0].open, five[0].high, five[0].low, five[0].close, five[0].volume], [100, 120, 90, 90, 10]);
  assert.deepEqual([five[1].open, five[1].high, five[1].low, five[1].close, five[1].volume], [95, 110, 95, 110, 10]);
  assert.equal(aggregate(t, 1).reduce((a, c) => a + c.volume, 0), five.reduce((a, c) => a + c.volume, 0));
  assert.deepEqual(movingAverage([1, 2, 3, 4, 5, 6], 5), [null, null, null, null, 3, 4]);
});
