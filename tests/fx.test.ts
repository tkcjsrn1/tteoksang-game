/* 연출 계산: 카운트업 숫자와 결과 효과음 고르기 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUZZ, countValue, fillTone, musicBpm, musicStep, MUSIC_STEPS, revealTone } from '../client/src/fx';
import { probeIndex } from '../client/src/live';
import { logoVariant, LOGO_VARIANTS } from '../client/src/sectors';
import { STOCKS } from '../shared/rules';

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

test('체결 소리: 매수·매도가 다르고, 손절·익절 자동 매도는 경고음', () => {
  assert.equal(fillTone('buy'), 'buy');
  assert.equal(fillTone('sell'), 'sell');
  assert.equal(fillTone('sell', 'stop'), 'trigger');
  assert.equal(fillTone('sell', 'take'), 'trigger');
  assert.notDeepEqual(BUZZ.fill, BUZZ.trigger);
});
test('배경음: 32박마다 되풀이하고, 마디 첫 박에만 낮은 음, 마감이 가까우면 빨라진다', () => {
  assert.equal(MUSIC_STEPS, 32);
  for (let i = 0; i < MUSIC_STEPS; i++) {
    const s = musicStep(i);
    assert.deepEqual(musicStep(i + MUSIC_STEPS), s);
    assert.ok(s.freq > 200 && s.freq < 900, `들리는 높이: ${s.freq}`);
    assert.equal(s.bass !== null, i % 8 === 0);
  }
  assert.ok(musicBpm(true) > musicBpm(false));
});
test('십자선: 그래프 가로 위치를 몇 초째인지로 바꾸고 양 끝에서 멈춘다', () => {
  assert.equal(probeIndex(8, 8, 3, 91), 0);
  assert.equal(probeIndex(8 + 3 * 30, 8, 3, 91), 30);
  assert.equal(probeIndex(8 + 3 * 30 + 1.4, 8, 3, 91), 30);
  assert.equal(probeIndex(-50, 8, 3, 91), 0);
  assert.equal(probeIndex(9999, 8, 3, 91), 90);
  assert.equal(probeIndex(100, 8, 3, 1), 0);
});
test('기업 로고: 같은 업종 기업끼리 테두리 모양이 모두 다르다', () => {
  const groups = new Set(STOCKS.map(s => s.group));
  for (const g of groups) {
    const members = STOCKS.filter(s => s.group === g);
    assert.deepEqual(members.map(s => logoVariant(s.code)), members.map((_, i) => i), g);
    assert.ok(members.length <= LOGO_VARIANTS, `${g}: 로고 모양(${LOGO_VARIANTS}가지)보다 기업이 많음`);
  }
});
