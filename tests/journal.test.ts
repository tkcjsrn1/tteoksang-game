/* 장중 10초봉 계산과 판이 끝난 뒤 매매일지를 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bucketCandles } from '../client/src/live';
import { buildJournal, journalKey, parseNotes } from '../client/src/journal';
import { GameRoom } from '../server/src/room';

test('10초봉: 앞 봉의 종가가 다음 봉의 시가, 고가·저가는 구간 안의 값', () => {
  const ticks = [100, 110, 90, 120, 130, 80, 100];
  const c = bucketCandles(ticks, 3);
  assert.deepEqual(c, [
    { i: 0, open: 100, high: 120, low: 90, close: 120 },
    { i: 1, open: 120, high: 130, low: 80, close: 100 }
  ]);
  for (let i = 1; i < c.length; i++) assert.equal(c[i].open, c[i - 1].close);
  assert.deepEqual(bucketCandles([100], 10), []);
  assert.deepEqual(bucketCandles([100, 105], 10), [{ i: 0, open: 100, high: 105, low: 100, close: 105 }]);
});

test('매매일지: 내 체결마다 라운드 뉴스와 그 라운드 종가 비교가 붙는다', () => {
  const T0 = 2_000_000;
  const room = GameRoom.create({ code: '424242', mode: 'solo', now: T0, seed: 4 });
  const tok = room.join(null, T0).token;
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  const t = room.s.live!.startedAt;
  assert.equal(room.placeOrder(tok, 'a', 'G01', 'buy', 30, t).ok, true);
  assert.equal(room.placeOrder(tok, 'b', 'G01', 'sell', 10, t + 1).ok, true);
  const end = room.s.phaseEndsAt!;
  room.tick(end);
  room.beginRecap(end);
  const v = room.view(tok, 'player', end);
  const j = buildJournal(v);
  assert.equal(j.length, 2);
  assert.deepEqual(j.map(e => e.key), ['1-0', '1-1']);
  const close = v.stocks.find(s => s.code === 'G01')!.history.find(h => h.round === 1)!.closePrice;
  for (const e of j) {
    assert.equal(e.close, close);
    assert.equal(e.kind, 'market');
    const want = Math.round(e.side === 'buy' ? (close - e.price) * 10000 / e.price : (e.price - close) * 10000 / close);
    assert.equal(e.afterBp, want);
    assert.equal(e.verdict, want > 20 ? 'good' : want < -20 ? 'bad' : 'flat');
  }
});

test('매매일지: 종목과 관련된 속보만 연결하고 관련 뉴스가 없으면 비운다', () => {
  const now = 2_000_000;
  const room = GameRoom.create({ code: '424242', mode: 'solo', now, seed: 1 });
  const token = room.join(null, now).token;
  room.start(now);
  room.tick(room.s.phaseEndsAt!);
  const live = room.s.live!;
  assert.notEqual(live.breakAt, null);
  const at = live.startedAt + live.breakAt! * 1000;
  room.tick(at);
  /* 이번 라운드 뉴스가 다루는 종목 하나와 다루지 않는 종목 하나를 삽니다 */
  const before = room.view(token, 'player', at);
  const news = before.news.find(r => r.round === 1)!.cards;
  const related = news[0].card.targets[0];
  const covered = news.flatMap(c => c.card.targets);
  const unrelated = before.stocks.find(s => !covered.includes(s.code))!.code;
  assert.equal(room.placeOrder(token, 'related', related, 'buy', 5, at).ok, true);
  assert.equal(room.placeOrder(token, 'unrelated', unrelated, 'buy', 5, at).ok, true);
  const entries = buildJournal(room.view(token, 'player', at));
  assert.deepEqual(entries.map(e => e.headline), [news[0].card.headline, null]);
});

test('매매일지 메모: 깨진 저장값은 비우고, 200자로 자른다', () => {
  assert.equal(journalKey('123456'), 'journal:123456');
  assert.deepEqual(parseNotes(null), {});
  assert.deepEqual(parseNotes('{bad'), {});
  assert.deepEqual(parseNotes('[1,2]'), {});
  assert.deepEqual(parseNotes(JSON.stringify({ a: 'x', b: 3 })), { a: 'x' });
  assert.equal(parseNotes(JSON.stringify({ a: 'ㄱ'.repeat(300) })).a.length, 200);
});
