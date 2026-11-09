import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, buildCandle, movingAverage } from '../shared/candles';
import { checkOrder, computeClose, feeOf, fillPrice, GROUPS, LEADERS, lowerLimit, maxBuyQty, MODES, slippageBp, stockOf, STOCKS, upperLimit } from '../shared/rules';
import { ARCS, CARDS } from '../server/src/content';
import { buildPlan, STOCKS_PER_GAME } from '../server/src/plan';
import { pickDiversified } from '../server/src/npc';

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
  /* 기존 G01 주문은 돌려받았다고 봅니다. 998주는 슬리피지 40bp(10,040원) 때문에 1,000만 원을 넘습니다 */
  assert.equal(checkOrder(ctx, 'G01', 'buy', 998, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 994, 10000).ok, true);
  assert.equal(maxBuyQty({ cash: 10_000_000, holdings: {}, orders: {} }, 'G01', 12400), 801);
  assert.equal(maxBuyQty({ cash: 10_000_000, holdings: {}, orders: {} }, 'G01', 10000), 994);
  assert.equal(checkOrder(ctx, 'G03', 'sell', 1, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 0, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 1.5, 10000).ok, false);
});
test('슬리피지: 200만 원까지 0, 그 뒤 100만 원마다 5bp, 최대 40bp. 매수는 비싸게, 매도는 싸게', () => {
  assert.equal(slippageBp(0), 0);
  assert.equal(slippageBp(2_000_000), 0);
  assert.equal(slippageBp(2_000_001), 5);
  assert.equal(slippageBp(3_000_000), 5);
  assert.equal(slippageBp(3_000_001), 10);
  assert.equal(slippageBp(9_999_999_999), 40);
  assert.equal(slippageBp(NaN), 0);
  assert.deepEqual(fillPrice(10000, 'buy', 100), { price: 10000, slipBp: 0 });
  assert.deepEqual(fillPrice(10000, 'buy', 990), { price: 10040, slipBp: 40 });
  assert.deepEqual(fillPrice(10000, 'sell', 990), { price: 9960, slipBp: 40 });
  assert.deepEqual(fillPrice(4850, 'buy', 500), { price: 4853, slipBp: 5 });    // 올림
  assert.deepEqual(fillPrice(4850, 'sell', 500), { price: 4847, slipBp: 5 });   // 내림
  /* 최대 수량은 슬리피지·수수료를 넣어도 현금을 넘지 않고, 한 주 더 사면 넘습니다 */
  for (const ref of [4300, 7200, 12400, 23400]) {
    const ctx = { cash: 10_000_000, holdings: {}, orders: {} };
    const q = maxBuyQty(ctx, 'G01', ref);
    const ok = checkOrder(ctx, 'G01', 'buy', q, ref), over = checkOrder(ctx, 'G01', 'buy', q + 1, ref);
    assert.ok(ok.ok && ok.reserve <= 10_000_000, `${ref}`);
    assert.equal(over.ok, false, `${ref}`);
  }
  /* 아주 큰 수량도 곱셈 넘침 없이 거절합니다 */
  assert.equal(checkOrder({ cash: 10_000_000, holdings: {}, orders: {} }, 'G01', 'buy', Number.MAX_SAFE_INTEGER, 10000).ok, false);
  assert.equal(checkOrder({ cash: 10_000_000, holdings: {}, orders: {} }, 'G01', 'buy', 2 ** 60, 10000).ok, false);
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
    assert.ok(p.rounds.every(r => Math.abs(r.marketBp) <= 50 && (Object.entries(r.stockBp) as [`G${number}`, number][]).every(([c, x]) => Math.abs(x) <= stockOf(c).maxMoveBp)));
  }
});
test('종목 풀 24개, 업종 6개 × 4종목, 판마다 10종목', () => {
  assert.equal(STOCKS.length, 24);
  assert.equal(new Set(STOCKS.map(s => s.code)).size, 24);
  assert.equal(new Set(STOCKS.map(s => s.name)).size, 24);
  for (const [g, def] of Object.entries(GROUPS)) {
    const members = STOCKS.filter(s => s.group === g);
    assert.equal(members.length, 4, g);
    assert.equal(stockOf(def.leader).group, g);
    assert.ok(members.every(s => s.code === def.leader ? s.linkBeta === 1 : s.linkBeta > 0 && s.linkBeta < 1));
  }
  for (let seed = 1; seed < 300; seed++) {
    const p = buildPlan(seed, 'friend');
    const codes = p.stockCodes!;
    assert.equal(codes.length, STOCKS_PER_GAME);
    assert.equal(new Set(codes).size, STOCKS_PER_GAME);
    /* 뉴스 대상(대장주)은 항상 나옵니다 */
    assert.ok(LEADERS.every(c => codes.includes(c)), `${seed}`);
    const targets = ARCS.filter(a => p.arcIds.includes(a.id)).flatMap(a => a.stages.flatMap(st => st.targets));
    assert.ok(targets.every(c => codes.includes(c)));
    /* 뉴스가 난 업종부터 동반 종목을 채웁니다(빈자리 4개 한도) */
    const featured = new Set(targets.map(c => stockOf(c).group));
    const withPeer = [...featured].filter(g => codes.some(x => x !== GROUPS[g].leader && stockOf(x).group === g));
    assert.equal(withPeer.length, Math.min(featured.size, STOCKS_PER_GAME - LEADERS.length), `${seed}`);
    /* 뉴스 카드의 주인공(targets[0]) 업종이 4개 이하이면 모두 동반 종목이 있습니다 */
    const primary = new Set(ARCS.filter(a => p.arcIds.includes(a.id)).flatMap(a => a.stages.map(st => stockOf(st.targets[0]).group)));
    if (primary.size <= STOCKS_PER_GAME - LEADERS.length) for (const g of primary) assert.ok(withPeer.includes(g), `${seed} ${g}`);
    /* 이번 판 종목에만 개별 변동을 정합니다 */
    assert.ok(p.rounds.every(r => Object.keys(r.stockBp).every(c => codes.includes(c as `G${number}`))));
  }
  assert.notDeepEqual(buildPlan(1, 'friend').stockCodes, buildPlan(2, 'friend').stockCodes);
});
test('분산형 NPC는 업종마다 변동이 가장 작은 종목을 하나씩 고른다', () => {
  const codes = buildPlan(7, 'friend').stockCodes!;
  const picked = pickDiversified(codes);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map(c => stockOf(c).group)).size, 6);
  for (const c of picked) assert.ok(codes.filter(x => stockOf(x).group === stockOf(c).group).every(x => stockOf(x).maxMoveBp >= stockOf(c).maxMoveBp));
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
