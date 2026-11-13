/* 최근에 본 사건을 다음 판에서 뒤로 미루는 기능 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeRecentArcs, parseRecentArcs, RECENT_ARCS } from '../client/src/recent';
import { ARCS } from '../server/src/content';
import { buildPlan } from '../server/src/plan';
import { GameRoom } from '../server/src/room';

test('저장값 읽기: 깨졌거나 없으면 빈 목록, 중복과 이상한 값은 걸러낸다', () => {
  assert.deepEqual(parseRecentArcs(null), []);
  assert.deepEqual(parseRecentArcs('{'), []);
  assert.deepEqual(parseRecentArcs('{"a":1}'), []);
  assert.deepEqual(parseRecentArcs('["a","a","",null,"b"]'), ['a', 'b']);
});

test('이번 판 사건이 앞으로, 오래된 것은 밀려난다', () => {
  assert.deepEqual(mergeRecentArcs(['b', 'c'], ['a']), ['a', 'b', 'c']);
  assert.deepEqual(mergeRecentArcs(['a', 'b'], ['b']), ['b', 'a'], '다시 본 사건은 앞으로 옵니다');
  const many = Array.from({ length: RECENT_ARCS + 5 }, (_, i) => `x${i}`);
  assert.equal(mergeRecentArcs(many, ['new']).length, RECENT_ARCS);
  assert.equal(mergeRecentArcs(many, ['new'])[0], 'new');
});

test('최근 사건을 넘기면 그 사건들은 다음 판에 나오지 않는다', () => {
  /* 아크가 모자라지 않을 만큼만 제외합니다 */
  const recent = ARCS.slice(0, 12).map(a => a.id);
  for (let seed = 1; seed <= 40; seed++) {
    const plan = buildPlan(seed, 'friend', recent);
    for (const id of plan.arcIds) assert.equal(recent.includes(id), false, `시드 ${seed}: ${id}가 다시 나옴`);
  }
});

test('제외할 사건이 너무 많으면 서버가 알아서 다시 쓴다(판이 깨지지 않음)', () => {
  const all = ARCS.map(a => a.id);
  const plan = buildPlan(7, 'friend', all);
  assert.ok(plan.arcIds.length > 0, '사건이 하나도 없으면 안 됩니다');
  assert.ok(plan.rounds.length > 0);
});

test('이번 판 사건 id는 판이 끝난 뒤에만 보인다', () => {
  const room = GameRoom.create({ code: '313131', mode: 'friend', now: 1000, seed: 3 });
  const a = room.join(null, 1000).token;
  room.join(null, 1001);
  room.start(1002);
  assert.equal(room.view(a, 'player', 1003).arcIds, undefined, '진행 중에 사건 id가 새면 안 됩니다');
  while (room.s.status === 'playing') {
    const now = room.s.phaseEndsAt!;
    if (room.tick(now) === 'settled') room.beginRecap(now);
  }
  const done = room.view(a, 'player', room.s.updatedAt + 1);
  assert.deepEqual(done.arcIds, room.s.plan.arcIds);
  assert.ok(done.arcIds!.length > 0);
});

test('방 만들기 API로 최근 사건을 넘기면 그 사건을 피해 판을 짠다', async () => {
  const { Hub } = await import('../server/src/hub');
  const hub = new Hub({});
  const port = await hub.listen(0);
  try {
    const recent = ARCS.slice(0, 12).map(a => a.id);
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`http://localhost:${port}/api/rooms`, {
        method: 'POST', body: JSON.stringify({ mode: 'solo', recentArcs: recent })
      });
      assert.equal(r.status, 201);
      const { code } = await r.json() as { code: string };
      const room = hub.rooms.get(code)!;
      for (const id of room.s.plan.arcIds) assert.equal(recent.includes(id), false, `${id}가 다시 나옴`);
    }
    /* 이상한 값을 보내도 방은 만들어집니다 */
    for (const bad of [{ recentArcs: 'x' }, { recentArcs: [1, 2] }, { recentArcs: [] }]) {
      const r = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'solo', ...bad }) });
      assert.equal(r.status, 201, JSON.stringify(bad));
    }
  } finally { await hub.close(); }
});
