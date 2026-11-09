/* 종목 목록을 업종별로 묶고, 처음부터 펼칠 업종을 고르는 규칙을 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultOpenGroups, groupStocks, newsTargets } from '../client/src/sectors';
import { GROUPS, stockOf } from '../shared/rules';
import { GameRoom } from '../server/src/room';

const T0 = 1_000_000;
function trading() {
  const room = GameRoom.create({ code: '777777', mode: 'friend', now: T0, seed: 5 });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  return { room, a, t: room.s.phaseEndsAt! - 1000 };
}

test('업종 순서대로 묶고, 모든 종목이 정확히 한 번 들어간다', () => {
  const { room, a, t } = trading();
  const v = room.view(a, 'player', t);
  const blocks = groupStocks(v.stocks);
  assert.deepEqual(blocks.map(b => b.group), Object.keys(GROUPS).filter(g => v.stocks.some(s => stockOf(s.code).group === g)));
  assert.equal(blocks.flatMap(b => b.stocks).length, v.stocks.length);
  for (const b of blocks) assert.ok(b.stocks.every(s => stockOf(s.code).group === b.group));
  assert.ok(blocks.every(b => b.avgChangeBp === null), '첫 라운드는 직전 등락이 없음');
});

test('뉴스가 난 업종, 보유·예약 종목이 있는 업종만 처음부터 펼친다', () => {
  const { room, a, t } = trading();
  const v0 = room.view(a, 'player', t);
  const news = new Set(newsTargets(v0).map(c => stockOf(c).group));
  assert.ok(news.size > 0);
  assert.deepEqual(defaultOpenGroups(v0), news);
  /* 뉴스와 상관없는 업종 종목을 예약하면 그 업종도 펼칩니다 */
  const other = v0.stocks.find(s => !news.has(stockOf(s.code).group))!;
  assert.equal(room.placeOrder(a, 'r1', other.code, 'buy', 1, t).ok, true);
  const v1 = room.view(a, 'player', t);
  assert.ok(defaultOpenGroups(v1).has(stockOf(other.code).group));
  /* 결과 시간에는 뉴스 기준으로 펼치지 않습니다 */
  assert.deepEqual(newsTargets({ ...v1, phase: 'recap' }), []);
});
