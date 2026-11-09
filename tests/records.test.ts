/* 개인 기록 저장 규칙 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addRecord, MAX_RECORDS, parseRecords, summarize, type GameRecord } from '../client/src/records';

const rec = (code: string, ret: number, rank = 2, at = 1_000_000_000): GameRecord => ({ code, mode: 'solo', at, rank, players: 4, returnPct: ret, fees: 1000, bestHuman: rank === 1 });

test('같은 방은 한 번만 기록하고, 최신이 앞이며 50판까지만 남긴다', () => {
  let list: GameRecord[] = [];
  list = addRecord(list, rec('111111', 1));
  list = addRecord(list, rec('111111', 1, 2, 1_000_000_500));
  assert.equal(list.length, 1);
  list = addRecord(list, rec('222222', -2));
  assert.equal(list[0].code, '222222');
  for (let i = 0; i < 80; i++) list = addRecord(list, rec(String(300000 + i), 0));
  assert.equal(list.length, MAX_RECORDS);
});
test('요약: 평균·최고·최저·1위 횟수', () => {
  const s = summarize([rec('1', 4, 1), rec('2', -2), rec('3', 1)])!;
  assert.equal(s.games, 3);
  assert.equal(s.avgReturn, 1);
  assert.equal(s.bestReturn, 4);
  assert.equal(s.worstReturn, -2);
  assert.equal(s.firsts, 1);
  assert.equal(s.totalFees, 3000);
  assert.equal(summarize([]), null);
});
test('깨진 저장값은 빈 목록으로 읽는다', () => {
  assert.deepEqual(parseRecords('{oops'), []);
  assert.deepEqual(parseRecords('{"a":1}'), []);
  assert.deepEqual(parseRecords(null), []);
  assert.equal(parseRecords(JSON.stringify([rec('1', 1), { code: 2 }])).length, 1);
});
