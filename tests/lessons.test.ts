/* 차트 연습실 콘텐츠 검증. 화면에 쓰는 값이 체결 기록에서 계산한 값과 같은지 봅니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, buildCandle, movingAverage } from '../shared/candles';
import { computeClose } from '../shared/rules';
import { candleExample, candleQuestion, compareQuestion, dailyCloses, earningsCase, earningsQuestion, fiveMinute, intradayTrades, LESSONS, marketBuy, newsCase, newsQuestion, oneMinute, operatingMargin, orderBook, orderQuestion, riskCase, riskQuestion, riskSummary } from '../client/src/lessons/data';

test('수업 1: 예시 체결 기록과 해설의 가격이 일치한다', () => {
  assert.deepEqual(candleExample.trades.map(t => t.price), [10000, 10400, 9800, 10200]);
  const c = buildCandle(0, candleExample.trades);
  assert.deepEqual([c.open, c.high, c.low, c.close, c.direction], [10000, 10400, 9800, 10200, 'up']);
  assert.match(candleQuestion.correct, /9,800원/);
  assert.match(candleQuestion.explanation, /10,200원/);
  assert.match(candleQuestion.explanation, /10,000원/);
  assert.equal(candleQuestion.answer, 'lower');
});
test('수업 2: 1분봉과 5분봉의 가격·거래량 집계가 원본과 일치한다', () => {
  const total = intradayTrades.reduce((a, t) => a + t.qty, 0);
  assert.equal(oneMinute().reduce((a, c) => a + c.volume, 0), total);
  assert.equal(fiveMinute().reduce((a, c) => a + c.volume, 0), total);
  for (const f of fiveMinute()) {
    const inside = intradayTrades.filter(t => t.minute >= f.start && t.minute < f.start + 5);
    assert.equal(f.open, inside[0].price);
    assert.equal(f.close, inside[inside.length - 1].price);
    assert.equal(f.high, Math.max(...inside.map(t => t.price)));
    assert.equal(f.low, Math.min(...inside.map(t => t.price)));
    assert.equal(f.volume, inside.reduce((a, t) => a + t.qty, 0));
    const ones = oneMinute().filter(o => o.start >= f.start && o.start < f.start + 5);
    assert.equal(f.high, Math.max(...ones.map(o => o.high)));
    assert.equal(f.volume, ones.reduce((a, o) => a + o.volume, 0));
  }
  assert.equal(aggregate(intradayTrades, 5).length, 3);
});
test('수업 2: 문제의 정답이 실제 최대 거래량 구간이다', () => {
  const five = fiveMinute();
  const max = five.reduce((m, c) => (c.volume > m.volume ? c : m));
  assert.equal(max.start, compareQuestion.answerStart);
  assert.match(compareQuestion.correct, new RegExp(`${max.volume}주`));
});
test('수업 2: 5일 이동평균 계산', () => {
  const ma = movingAverage(dailyCloses, 5);
  assert.equal(ma[3], null);
  assert.equal(ma[4], (12100 + 12250 + 12180 + 12400 + 12350) / 5);
});
test('수업 3: 시나리오 산식으로 계산해도 −4.60%다', () => {
  const [event, market, stock] = newsCase.breakdown;
  const b = computeClose(1, 10000, [{ stageId: 'x', label: event.name, bp: event.bp, reason: event.reason }], market.bp, stock.bp);
  assert.equal(b.closePrice, newsCase.chart[newsCase.chart.length - 1].close);
  assert.equal(b.changeBp, -460);
  assert.equal(newsQuestion.options.filter(o => o.correct).length, 1);
});
test('수업 구성: 1~6 모두 공개', () => {
  assert.deepEqual(LESSONS.map(l => l.ready), [true, true, true, true, true, true]);
});
test('수업 4: 시장가 400주의 평균 체결가가 정답 10,040원이고 해설 숫자와 맞다', () => {
  const r = marketBuy(orderBook.asks, orderBook.buyQty);
  assert.equal(r.filled, 400);
  assert.equal(r.avg, 10040);
  assert.deepEqual(r.fills.map(f => [f.price, f.qty]), [[10030, 150], [10040, 100], [10050, 150]]);
  assert.equal(orderQuestion.options.filter(o => o.correct).length, 1);
  assert.match(orderQuestion.options.find(o => o.correct)!.label, /10,040원/);
  /* 매도 호가는 모두 매수 호가보다 높습니다 */
  assert.ok(Math.min(...orderBook.asks.map(a => a.price)) > Math.max(...orderBook.bids.map(b => b.price)));
  /* 호가 수량보다 많이 사면 남은 수량은 체결되지 않습니다 */
  assert.equal(marketBuy(orderBook.asks, 10_000).filled, 550);
});
test('수업 5: 영업이익률 계산과 정답이 맞다', () => {
  const [a, b] = earningsCase.companies;
  assert.equal(operatingMargin(a), 5);
  assert.equal(operatingMargin(b), 15);
  assert.equal(earningsQuestion.options.filter(o => o.correct).length, 1);
  assert.match(earningsQuestion.options.find(o => o.correct)!.label, new RegExp(b.name));
});
test('수업 6: 평가액 1,200만 원, 분산 전력 비중 79%, 해설 숫자와 맞다', () => {
  const r = riskSummary(riskCase);
  assert.equal(r.total, 12_000_000);
  assert.equal(r.pnl, 120_000 - 240_000 + 40_000);
  const power = r.sectors.find(s => s.sector === '분산 전력')!;
  assert.equal(power.value, 9_480_000);
  assert.equal(Math.round(power.pct), 79);
  assert.equal(riskQuestion.options.filter(o => o.correct).length, 1);
  assert.match(riskQuestion.options.find(o => o.correct)!.label, /79%/);
  assert.match(riskQuestion.options.find(o => o.correct)!.feedback, /948만 원/);
  const laven = r.rows.find(x => x.name === '라벤토 소형터빈')!;
  assert.equal(Math.round(laven.value / r.total * 100), 48);
});
