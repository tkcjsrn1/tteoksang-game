/* 결과 화면의 봉 재생(연출)이 시가에서 출발해 고가·저가를 지나 종가에서 끝나는지 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replayAt, replayPath } from '../client/src/fx';

test('오른 봉은 저가 먼저, 내린 봉은 고가 먼저 들른다', () => {
  assert.deepEqual(replayPath(10000, 10400, 9800, 10200), [10000, 9800, 10400, 10200]);
  assert.deepEqual(replayPath(10000, 10100, 9500, 9600), [10000, 10100, 9500, 9600]);
});
test('처음은 시가, 끝은 종가이고 끝에서 지나온 최고·최저가 = 고가·저가', () => {
  for (const [o, h, l, c] of [[10000, 10400, 9800, 10200], [10000, 10100, 9500, 9600], [8700, 8700, 8700, 8700], [12400, 14880, 12400, 14880]]) {
    const path = replayPath(o, h, l, c);
    assert.equal(replayAt(path, 0).price, o);
    const end = replayAt(path, 1);
    assert.deepEqual(end, { price: c, high: h, low: l });
    let prevHi = o, prevLo = o;
    for (let t = 0; t <= 1; t += 0.05) {
      const s = replayAt(path, t);
      assert.ok(s.price <= h && s.price >= l, `${t} 범위`);
      assert.ok(s.high >= prevHi && s.low <= prevLo, '지나온 고가·저가는 줄지 않음');
      assert.ok(s.high >= s.price && s.low <= s.price);
      prevHi = s.high; prevLo = s.low;
    }
  }
  assert.deepEqual(replayAt([10000, 9800, 10400, 10200], 7), { price: 10200, high: 10400, low: 9800 });
});
