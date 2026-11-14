/* 학술제 대형 화면에 올리는 종목 고르기 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { pickDisplayStocks, STOCK_ROWS } from '../client/src/bigscreen';

const T0 = 1_000_000;
test('종목은 이번 뉴스 종목이 먼저, 나머지는 많이 움직인 순서로 정해진 개수만', () => {
  const room = GameRoom.create({ code: '424242', mode: 'friend', now: T0, seed: 9, settings: { stocks: 30 }, operated: true });
  room.join(null, T0);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  room.tick(room.s.live!.startedAt + 5000);
  const v = room.view(null, 'display', room.s.live!.startedAt + 5000);
  assert.equal(v.portfolio, null, '대형 화면에는 개인 자산이 없음');
  const rows = pickDisplayStocks(v);
  assert.equal(rows.length, STOCK_ROWS);
  const targets = new Set(v.news[v.news.length - 1].cards.flatMap(c => c.card.targets));
  const firstOther = rows.findIndex(r => !r.news);
  assert.ok(rows.slice(0, firstOther).every(r => targets.has(r.stock.code)), '뉴스 종목이 위');
  const rest = rows.slice(firstOther).map(r => Math.abs(r.bp ?? 0));
  assert.deepEqual(rest, [...rest].sort((a, b) => b - a), '나머지는 큰 움직임 순');
});
