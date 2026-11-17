/* 시트 끌어 닫기 판정과, 발표용 빠른 판을 저장하지 않는 규칙 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOSE_DISTANCE, CLOSE_SPEED, shouldClose } from '../client/src/sheetDrag';
import { persistedSettings } from '../client/src/homeSettings';
import { cleanSettings } from '../shared/rules';

test('시트: 충분히 내리거나 빠르게 튕기면 닫고, 살짝 건드리면 그대로 둔다', () => {
  assert.equal(shouldClose(CLOSE_DISTANCE, 0), true);
  assert.equal(shouldClose(CLOSE_DISTANCE - 1, 0), false);
  assert.equal(shouldClose(40, CLOSE_SPEED), true);          // 짧아도 빠르게 튕기면 닫힘
  assert.equal(shouldClose(10, CLOSE_SPEED * 3), false);     // 손떨림 수준은 무시
  assert.equal(shouldClose(0, 0), false);
});

test('홈 설정: 발표용 빠른 판은 저장하지 않고, 예전에 저장된 값도 읽을 때 버린다', () => {
  assert.deepEqual(persistedSettings({ pace: 'demo', rounds: 5, level: 'pro' }), { rounds: 5, level: 'pro' });
  const old = cleanSettings(JSON.stringify({ pace: 'demo', stocks: 20 }));
  assert.equal(old.pace, 'demo');                             // 서버 규칙은 그대로 받아들이고
  assert.equal(persistedSettings(old).pace, undefined);       // 홈에서 불러올 때만 뺍니다
  assert.equal(persistedSettings(old).stocks, 20);
});
