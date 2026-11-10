import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, buildCandle, movingAverage } from '../shared/candles';
import { chargeOf, checkOrder, computeClose, feeOf, taxOf, GROUPS, LEADERS, lowerLimit, marketFill, maxBuyQty, MODES, quoteBook, stockOf, STOCKS, upperLimit } from '../shared/rules';
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
test('수수료는 주문별 0.10%를 원 단위로 올리고, 거래세 0.20%는 팔 때만 원 미만을 버리고 낸다', () => {
  assert.equal(feeOf(1240000), 1240);
  assert.equal(feeOf(1001), 2);
  assert.equal(taxOf(1240000), 2480);
  assert.equal(taxOf(499), 0);
  assert.equal(chargeOf('buy', 1240000), 1240);
  assert.equal(chargeOf('sell', 1240000), 3720);
  /* 팔 때 받는 돈에서 수수료와 거래세가 함께 빠집니다 */
  const sell = checkOrder({ cash: 0, holdings: { G01: { qty: 100, avgCost: 10000, sinceRound: 1 } }, orders: {} }, 'G01', 'sell', 100, 10000, { limit: 10000 });
  assert.equal(sell.ok && sell.fee, 1000 + 2000);
});
test('예약금: 시장가는 걸어 둔 예약금을 쓸 수 없고, 지정가는 같은 종목 예약을 새 예약으로 바꿔 검증', () => {
  const o = { code: 'G01' as const, side: 'buy' as const, qty: 500, kind: 'limit' as const, price: 10000, gross: 5_000_000, fee: 5_000, reserve: 5_005_000, requestId: 'a', placedAt: 0 };
  const ctx = { cash: 10_000_000, holdings: {}, orders: { G01: o } };
  /* 시장가: 예약금 500만 5천 원을 뺀 499만 5천 원 안에서만 */
  assert.equal(checkOrder(ctx, 'G02', 'buy', 500, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G02', 'buy', 497, 10000).ok, true);   // 슬리피지 15bp 포함
  assert.equal(checkOrder(ctx, 'G01', 'buy', 497, 10000).ok, true);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 500, 10000).ok, false);
  /* 지정가: 같은 종목 기존 예약은 돌려받았다고 봅니다. 슬리피지 없이 지정가 × 수량 + 수수료 */
  assert.equal(checkOrder(ctx, 'G01', 'buy', 999, 10000, { limit: 10000 }).ok, true);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 1000, 10000, { limit: 10000 }).ok, false);
  assert.equal(checkOrder(ctx, 'G02', 'buy', 505, 10000, { limit: 9900 }).ok, false, '다른 종목 예약금은 그대로');
  assert.equal(checkOrder(ctx, 'G02', 'buy', 500, 10000, { limit: 9900 }).ok, true);
  /* 지정가 최대 수량은 지정가 × 수량 + 수수료 */
  assert.equal(maxBuyQty({ cash: 10_000_000, holdings: {}, orders: {} }, 'G01', 10000, { limit: 10000 }), 999);
  /* 매도 예약에 묶인 수량은 시장가로 팔 수 없습니다 */
  const s = { code: 'G03' as const, side: 'sell' as const, qty: 70, kind: 'limit' as const, price: 9000, gross: 630_000, fee: 1260, reserve: 0, requestId: 'b', placedAt: 0 };
  const held = { cash: 0, holdings: { G03: { qty: 100, avgCost: 8000, sinceRound: 1 } }, orders: { G03: s } };
  assert.equal(checkOrder(held, 'G03', 'sell', 30, 9000).ok, true);
  assert.equal(checkOrder(held, 'G03', 'sell', 31, 9000).ok, false);
  assert.equal(checkOrder(held, 'G03', 'sell', 100, 9000, { limit: 9100 }).ok, true, '새 예약은 기존 예약을 대신함');
  assert.equal(checkOrder(ctx, 'G03', 'sell', 1, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 0, 10000).ok, false);
  assert.equal(checkOrder(ctx, 'G01', 'buy', 1.5, 10000).ok, false);
});
test('장중 시세 경로: 시가에서 출발해 목표에 닿고, 10원 단위·가격 제한폭 안, 같은 시드면 같은 경로', async () => {
  const { intradayPath } = await import('../shared/rules');
  const { mulberry } = await import('../server/src/plan');
  for (let seed = 1; seed < 200; seed++) {
    const base = [4300, 7200, 12400, 23400][seed % 4];
    const end = (seed % 7 - 3) * 40;
    const jump = seed % 3 === 0 ? { at: 45, bp: seed % 2 ? 120 : -120 } : undefined;
    const path = intradayPath(mulberry(seed), base, end, 90, 150, jump);
    assert.equal(path.length, 91);
    assert.equal(path[0], base);
    assert.ok(path.every(p => p % 10 === 0 && p >= lowerLimit(base) && p <= upperLimit(base)));
    const want = Math.round(base * (10000 + end) / 100000) * 10;
    assert.ok(Math.abs(path[90] - want) <= 10, `${seed}: 끝 ${path[90]} 목표 ${want}`);
    assert.deepEqual(intradayPath(mulberry(seed), base, end, 90, 150, jump), path);
  }
  /* 속보 반응은 그 초에 한 번에 튑니다 */
  const flat = intradayPath(mulberry(5), 10000, 120, 90, 0, { at: 45, bp: 120 });
  assert.equal(flat[44], 10000);
  assert.equal(flat[45], 10120);
  assert.equal(flat[90], 10120);
});
test('호가창: 시세 위로 매도 호가, 한 칸 아래부터 매수 호가, 10원 간격, 가격 제한폭 안, 모두에게 같은 값', () => {
  for (const st of STOCKS) for (const k of [0, 17, 89]) {
    const b = quoteBook(st.code, st.start, st.start, 2, k);
    assert.equal(b.asks[0].price, st.start);
    assert.equal(b.bids[0].price, st.start - 10);
    b.asks.forEach((l, i) => { assert.equal(l.price, st.start + i * 10); assert.ok(l.qty >= 1 && Number.isInteger(l.qty)); });
    b.bids.forEach((l, i) => { assert.equal(l.price, st.start - (i + 1) * 10); assert.ok(l.qty >= 1); });
    assert.deepEqual(quoteBook(st.code, st.start, st.start, 2, k), b, '같은 입력이면 같은 호가창');
  }
  /* 상한가 근처에서는 위 호가가 상한가에서 끊기고, 하한가에서는 사려는 주문이 없습니다 */
  const open = 10000;
  const top = quoteBook('G01', upperLimit(open), open, 1, 5);
  assert.deepEqual(top.asks.map(l => l.price), [upperLimit(open)]);
  const bottom = quoteBook('G01', lowerLimit(open), open, 1, 5);
  assert.equal(bottom.bids.length, 0);
  assert.equal(marketFill(bottom, 'sell', 1), null);
  assert.equal(checkOrder({ cash: 0, holdings: { G01: { qty: 5, avgCost: 9000, sinceRound: 1 } }, orders: {} }, 'G01', 'sell', 1, lowerLimit(open), { book: bottom }).ok, false);
});
test('시장가 체결: 작은 주문은 최우선 호가, 큰 주문은 여러 호가를 지나 평균가가 불리해짐(슬리피지)', () => {
  const b = quoteBook('G07', 7200, 7200, 1, 3);
  assert.deepEqual(marketFill(b, 'buy', 1), { price: 7200, slipBp: 0, best: 7200, levels: 1 });
  assert.equal(marketFill(b, 'sell', 1)!.price, 7190, '매도는 한 칸 낮은 매수 호가부터(스프레드)');
  /* 첫 단계 수량을 넘으면 다음 호가까지 */
  const q0 = b.asks[0].qty, q1 = b.asks[1].qty;
  const two = marketFill(b, 'buy', q0 + q1)!;
  assert.equal(two.price, Math.ceil((q0 * 7200 + q1 * 7210) / (q0 + q1)));
  assert.equal(two.levels, 2);
  /* 수량이 늘면 평균가는 같거나 나빠짐 */
  let prev = 0;
  for (let q = 1; q < 3000; q += 37) { const f = marketFill(b, 'buy', q)!; assert.ok(f.price >= prev); prev = f.price; }
  let prevS = Infinity;
  for (let q = 1; q < 3000; q += 37) { const f = marketFill(b, 'sell', q)!; assert.ok(f.price <= prevS); prevS = f.price; }
  /* 호가창보다 많으면 마지막 단계 가격으로 채움 */
  const all = b.asks.reduce((x, l) => x + l.qty, 0);
  assert.ok(marketFill(b, 'buy', all * 3)!.price <= b.asks[b.asks.length - 1].price);
  /* 대표 종목은 호가가 두꺼워 같은 금액이면 슬리피지가 같거나 작음(평균) */
  let lead = 0, peer = 0;
  for (let k = 0; k < 90; k++) {
    lead += marketFill(quoteBook('G01', 10000, 10000, 1, k), 'buy', 800)!.slipBp;
    peer += marketFill(quoteBook('G07', 10000, 10000, 1, k), 'buy', 800)!.slipBp;
  }
  assert.ok(lead < peer, `대표 ${lead} < 관련 ${peer}`);
  /* 1,000만 원 전부를 한 번에 사도 슬리피지는 0.5% 안쪽 */
  for (let k = 0; k < 90; k++) {
    const bk = quoteBook('G07', 7200, 7200, 1, k);
    const q = maxBuyQty({ cash: 10_000_000, holdings: {}, orders: {} }, 'G07', 7200, { book: bk });
    assert.ok(marketFill(bk, 'buy', q)!.slipBp <= 50, `${k}`);
  }
});
test('최대 매수 수량: 호가창·수수료를 넣어도 현금을 넘지 않고, 한 주 더 사면 넘는다', () => {
  for (const ref of [4300, 7200, 12400, 23400]) for (const k of [0, 40]) {
    const ctx = { cash: 10_000_000, holdings: {}, orders: {} };
    const book = quoteBook('G01', ref, ref, 1, k);
    const q = maxBuyQty(ctx, 'G01', ref, { book });
    const ok = checkOrder(ctx, 'G01', 'buy', q, ref, { book }), over = checkOrder(ctx, 'G01', 'buy', q + 1, ref, { book });
    assert.ok(ok.ok && ok.reserve <= 10_000_000, `${ref}`);
    assert.equal(over.ok, false, `${ref}`);
  }
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
  for (const mode of ['friend', 'solo'] as const) for (let seed = 1; seed < 200; seed++) {
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

test('기업 정보: 시가총액·PER·배당수익률·지수 계산', async () => {
  const { marketCapWon, perOf, dividendYieldBp, indexValue, formatEok, FUNDAMENTALS } = await import('../shared/rules');
  assert.equal(Object.keys(FUNDAMENTALS).length, STOCKS.length);
  assert.equal(marketCapWon('G01', 12400), 12400 * 40_000_000);
  assert.equal(formatEok(marketCapWon('G01', 12400)), '4,960억 원');
  assert.equal(formatEok(1_234_500_000_000), '1조 2,345억 원');
  assert.equal(perOf('G01', 12400), 16);
  assert.equal(perOf('G02', 18600), null, '적자면 계산하지 않음');
  assert.equal(dividendYieldBp('G06', 10200), 343);
  /* 시작 가격 기준 PER은 3~60배 안(적자 제외) */
  for (const st of STOCKS) { const p = perOf(st.code, st.start); if (p !== null) assert.ok(p >= 3 && p <= 60, `${st.code} ${p}`); }
  /* 지수: 시작 1000, 모든 종목 10% 오르면 1100, 큰 회사 영향이 더 큼 */
  const base = [{ code: 'G01' as const, price: 12400, startPrice: 12400 }, { code: 'G11' as const, price: 6100, startPrice: 6100 }];
  assert.equal(indexValue(base), 1000);
  assert.ok(Math.abs(indexValue(base.map(s => ({ ...s, price: s.startPrice * 1.1 }))) - 1100) < 1e-9);
  const bigUp = indexValue([{ ...base[0], price: 13640 }, base[1]]), smallUp = indexValue([base[0], { ...base[1], price: 6710 }]);
  assert.ok(bigUp > smallUp);
});
