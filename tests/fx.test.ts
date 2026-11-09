/* 연출 계산: 카운트업 숫자와 결과 효과음 고르기 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countValue, revealTone } from '../client/src/fx';

test('카운트업: 시작과 끝은 정확하고, 중간은 단조롭게 다가간다', () => {
  assert.equal(countValue(0, 109702, 0), 0);
  assert.equal(countValue(0, 109702, 1), 109702);
  assert.equal(countValue(0, -77984, 1), -77984);
  let prev = 0;
  for (let i = 1; i <= 20; i++) { const v = countValue(0, 10000, i / 20); assert.ok(v >= prev); prev = v; }
  assert.ok(countValue(0, 10000, 0.5) > 5000, 'ease-out이라 절반 시점에 절반을 넘는다');
  assert.equal(Number.isInteger(countValue(0, 12345, 0.37)), true);
});
test('결과 효과음: 늘면 up, 줄면 down, 그대로면 flat', () => {
  assert.equal(revealTone(1), 'up');
  assert.equal(revealTone(-5), 'down');
  assert.equal(revealTone(0), 'flat');
});
