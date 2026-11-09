/* 게임 봉 차트의 꼬리(연출)가 규칙을 지키는지 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeClose, stagedWicks, STOCKS } from '../shared/rules';
import { GameRoom } from '../server/src/room';

test('꼬리는 몸통을 감싸고, 가격 제한폭·10원 단위를 지키며, 같은 입력이면 같은 값', () => {
  for (const s of STOCKS) for (let bp = -2500; bp <= 2500; bp += 125) {
    const b = computeClose(3, s.start, [{ stageId: 'x', label: 'x', bp, reason: '' }], 13, -27);
    const w = stagedWicks(s.code, b);
    assert.ok(w.high >= Math.max(b.basePrice, b.closePrice), `${s.code} ${bp} 고가`);
    assert.ok(w.low <= Math.min(b.basePrice, b.closePrice), `${s.code} ${bp} 저가`);
    assert.ok(w.high <= b.upperLimit && w.low >= b.lowerLimit, `${s.code} ${bp} 제한폭`);
    assert.ok(w.low >= 100);
    for (const v of [w.high, w.low]) assert.ok(v % 10 === 0 || v === b.basePrice || v === b.closePrice, `${v} 10원 단위`);
    if (b.limit === 'upper') assert.equal(w.high, b.closePrice, '상한가면 고가 = 종가');
    if (b.limit === 'lower') assert.equal(w.low, b.closePrice, '하한가면 저가 = 종가');
    assert.deepEqual(stagedWicks(s.code, b), w);
  }
});

test('정산된 가격 기록에 고가·저가가 붙고, 정산 전에는 공개되지 않는다', () => {
  const T0 = 1_000_000;
  const room = GameRoom.create({ code: '333333', mode: 'solo', now: T0, seed: 9 });
  const tok = room.join(null, T0).token;
  room.start(T0);
  while (room.s.phase !== 'recap') { const t = room.s.phaseEndsAt!; if (room.tick(t) === 'settled') room.beginRecap(t); }
  const v = room.view(tok, 'player', room.s.phaseEndsAt! - 1);
  for (const s of v.stocks) {
    const h = s.history[0];
    assert.ok(h.high !== undefined && h.low !== undefined, `${s.code} 고가·저가`);
    assert.ok(h.high! >= Math.max(h.basePrice, h.closePrice) && h.low! <= Math.min(h.basePrice, h.closePrice));
  }
});

test('주문 흐름: 매수가 많으면 위 꼬리, 매도가 많으면 아래 꼬리가 길어지고 제한폭은 그대로 지킨다', () => {
  for (const s of STOCKS) for (let bp = -1500; bp <= 1500; bp += 500) {
    const b = computeClose(2, s.start, [{ stageId: 'x', label: 'x', bp, reason: '' }], 0, 0);
    const none = stagedWicks(s.code, b);
    assert.deepEqual(stagedWicks(s.code, b, { buyQty: 0, sellQty: 0, turnover: 0 }), none, '흐름 0이면 예전과 같음');
    const buy = stagedWicks(s.code, b, { buyQty: 1000, sellQty: 0, turnover: 20_000_000 });
    const sell = stagedWicks(s.code, b, { buyQty: 0, sellQty: 1000, turnover: 20_000_000 });
    assert.ok(buy.high >= none.high && buy.low === none.low, `${s.code} ${bp} 매수`);
    assert.ok(sell.low <= none.low && sell.high === none.high, `${s.code} ${bp} 매도`);
    for (const w of [buy, sell]) {
      assert.ok(w.high <= b.upperLimit && w.low >= b.lowerLimit);
      if (b.limit === 'upper') assert.equal(w.high, b.closePrice);
      if (b.limit === 'lower') assert.equal(w.low, b.closePrice);
    }
  }
});
