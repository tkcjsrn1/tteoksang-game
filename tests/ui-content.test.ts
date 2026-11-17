/* 화면에 직접 적힌 그림·숫자가 규칙과 어긋나지 않는지 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUPS, feeOf, roomLabel } from '../shared/rules';
import { GLYPH } from '../client/src/glyphs';

test('모든 업종에 로고 그림이 있다(빠지면 빈 동그라미로 나옴)', () => {
  const missing = Object.keys(GROUPS).filter(g => !GLYPH[g]);
  assert.deepEqual(missing, []);
});

test('첫 방문 안내의 주문 그림: 총 빠져나갈 돈 = 체결 금액 + 매수 수수료', () => {
  const src = readFileSync(new URL('../client/src/Onboarding.tsx', import.meta.url), 'utf8');
  const gross = 8_700 * 100;
  const total = (gross + feeOf(gross)).toLocaleString('ko-KR');
  assert.match(src, new RegExp(`총 빠져나갈 돈</span><b>${total}원`));
  assert.match(src, new RegExp(`수수료 0.10%</span><span>-${feeOf(gross).toLocaleString('ko-KR')}원`));
});

test('방 이름: 학술제 방은 참가자 화면에서도 "학술제 대전"으로 부른다', () => {
  assert.equal(roomLabel('friend', true), '학술제 대전');
  assert.equal(roomLabel('friend'), '친구 대전');
  assert.equal(roomLabel('solo'), '혼자 연습');
});
