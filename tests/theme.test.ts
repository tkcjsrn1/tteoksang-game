/* 테마 고르기: 저장한 값이 먼저, 없으면 기기 설정을 따릅니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTheme } from '../client/src/theme';

test('저장한 테마가 있으면 그 값, 없거나 깨졌으면 기기 설정', () => {
  assert.equal(parseTheme('dark', false), 'dark');
  assert.equal(parseTheme('light', true), 'light');
  assert.equal(parseTheme(null, true), 'dark');
  assert.equal(parseTheme(null, false), 'light');
  assert.equal(parseTheme('purple', false), 'light');
});
