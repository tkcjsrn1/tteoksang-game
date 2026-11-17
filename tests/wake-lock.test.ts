/* 화면 꺼짐 방지: 보일 때만 요청, 돌아오면 다시 요청, 끄면 풀기, 미지원·거절은 조용히 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepAwake } from '../client/src/wakeLock';

function fakes(opts: { reject?: boolean } = {}) {
  const log: string[] = [];
  const sentinels: { released: boolean }[] = [];
  let listener: (() => void) | null = null;
  const doc = {
    visibilityState: 'visible',
    addEventListener: (_: 'visibilitychange', f: () => void) => { listener = f; },
    removeEventListener: () => { listener = null; },
  };
  const nav = {
    wakeLock: {
      request: async () => {
        log.push('request');
        if (opts.reject) throw new Error('NotAllowedError');
        const s = { released: false, release: async () => { s.released = true; log.push('release'); } };
        sentinels.push(s);
        return s;
      },
    },
  };
  return { log, sentinels, doc, nav, fire: () => listener?.(), sentinelGone: () => listener === null };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('화면 꺼짐 방지: 켜면 요청하고, 끄면 풀고 이벤트도 뗀다', async () => {
  const f = fakes();
  const stop = keepAwake(f.nav, f.doc);
  await tick();
  assert.deepEqual(f.log, ['request']);
  stop();
  await tick();
  assert.deepEqual(f.log, ['request', 'release']);
  assert.equal(f.sentinelGone(), true);
});

test('화면 꺼짐 방지: 다른 앱에 갔다 오면 다시 건다(이미 걸려 있으면 또 요청하지 않음)', async () => {
  const f = fakes();
  const stop = keepAwake(f.nav, f.doc);
  await tick();
  f.fire(); await tick();                       // 아직 걸려 있음 → 다시 요청 안 함
  assert.deepEqual(f.log, ['request']);
  f.doc.visibilityState = 'hidden'; f.fire(); await tick();   // 숨김 상태에서는 요청 안 함
  assert.deepEqual(f.log, ['request']);
  stop();
});

test('화면 꺼짐 방지: 브라우저가 풀어 버렸으면 돌아올 때 다시 요청한다', async () => {
  const f = fakes();
  const stop = keepAwake(f.nav, f.doc);
  await tick();
  f.doc.visibilityState = 'hidden';
  f.sentinels[0].released = true;               // 화면을 숨기면 브라우저가 스스로 풉니다
  f.fire(); await tick();
  f.doc.visibilityState = 'visible'; f.fire(); await tick();
  assert.deepEqual(f.log, ['request', 'request']);
  stop();
});

test('화면 꺼짐 방지: 지원하지 않거나 거절돼도 오류 없이 넘어간다', async () => {
  const stop = keepAwake({}, fakes().doc);
  stop();
  const f = fakes({ reject: true });
  const stop2 = keepAwake(f.nav, f.doc);
  await tick();
  f.fire(); await tick();                       // 거절 뒤 돌아오면 다시 시도
  assert.deepEqual(f.log, ['request', 'request']);
  stop2();
});
