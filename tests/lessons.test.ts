/* 차트 연습실 콘텐츠 검증. 화면에 쓰는 값이 체결 기록에서 계산한 값과 같은지 봅니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, buildCandle, movingAverage } from '../shared/candles';
import { computeClose } from '../shared/rules';
import { candleExample, candleQuestion, compareQuestion, dailyCloses, fiveMinute, intradayTrades, LESSONS, newsCase, newsQuestion, oneMinute } from '../client/src/lessons/data';

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
test('수업 구성: 1~3은 공개, 4~6은 준비 중', () => {
  assert.deepEqual(LESSONS.map(l => l.ready), [true, true, true, false, false, false]);
});
