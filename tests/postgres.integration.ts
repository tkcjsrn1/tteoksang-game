/* 실제 PostgreSQL 연동 검증. 프로젝트 폴더의 임시 DB를 띄우거나, TEST_DATABASE_URL이 있으면 그것을 씁니다. */
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { Hub } from '../server/src/hub';
import { GameRoom } from '../server/src/room';
import { PostgresStore } from '../server/src/store';

let url = process.env.TEST_DATABASE_URL ?? '';
let embedded: { stop(): Promise<void> } | null = null;
const dir = path.resolve('.pgdata');
before(async () => {
  if (url) return;
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  rmSync(dir, { recursive: true, force: true });
  const db = new EmbeddedPostgres({ databaseDir: dir, user: 'game', password: 'localtest', port: 54329, persistent: false, onLog: () => {} });
  await db.initialise(); await db.start(); await db.createDatabase('game');
  embedded = db;
  url = 'postgres://game:localtest@localhost:54329/game';
}, { timeout: 120000 });
after(async () => { if (embedded) { await embedded.stop(); rmSync(dir, { recursive: true, force: true }); } });

test('방 상태 저장·복구, 정산과 주문 기록의 중복 방지', async () => {
  const store = new PostgresStore(url);
  await store.init();
  const room = GameRoom.create({ code: '777777', mode: 'friend', now: 1000, seed: 5 });
  const a = room.join(null, 1000).token; room.join(null, 1001);
  room.start(1002);
  room.tick(room.s.phaseEndsAt!);
  const t = room.s.phaseEndsAt! - 1;
  assert.equal(room.placeOrder(a, 'req-1', 'G01', 'buy', 10, t).ok, true);
  const pid = room.player(a)!.id;
  await store.recordOrder('777777', pid, 'x', {}).catch(() => {});
  await store.saveRoom(room.s);
  await store.recordOrder('777777', pid, 'req-1', { qty: 10 });
  await store.recordOrder('777777', pid, 'req-1', { qty: 10 });
  const loaded = await store.loadActive();
  const restored = new GameRoom(loaded.find(s => s.code === '777777')!);
  assert.equal(restored.player(a)!.holdings.G01?.qty, 10, '저장 후에도 시장가 체결을 유지');
  assert.equal(restored.player(a)!.fills.length, 1);
  const closeAt = restored.s.phaseEndsAt!;
  assert.equal(restored.tick(closeAt), 'settled');
  await store.saveSettlement('777777', 1, restored.s);

  const restarted = new Hub({ store, now: () => closeAt });
  await restarted.listen(0);
  try {
    const resumed = restarted.rooms.get('777777')!;
    const deadline = Date.now() + 3000;
    while (resumed.s.phase === 'settling' && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
    assert.equal(resumed.s.phase, 'recap', '저장된 정산 상태에서 결과 공개로 넘어감');
    assert.deepEqual(resumed.s.settled, [1]);
    assert.equal(resumed.player(a)!.holdings.G01?.qty, 10);
    assert.equal(resumed.player(a)!.fills.length, 1);
    assert.equal((await store.pool.query(`SELECT count(*)::int n FROM settlements WHERE room_code='777777'`)).rows[0].n, 1);
    assert.equal((await store.pool.query(`SELECT count(*)::int n FROM order_events WHERE room_code='777777' AND request_id='req-1'`)).rows[0].n, 1);
  } finally {
    await restarted.close();
  }
});
