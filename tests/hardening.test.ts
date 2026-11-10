/* 서버를 죽이거나 상태를 무한히 키울 수 있는 입력을 막는지 확인합니다. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { Hub, MSG_LIMIT_PER_SEC, ROOMS_PER_IP_PER_MIN } from '../server/src/hub';
import { GameRoom, MAX_REQUESTS_PER_ROUND } from '../server/src/room';
import type { ServerMsg } from '../shared/types';

let hub: Hub, port: number;
before(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tteoksang-static-'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>t</title>');
  hub = new Hub({ staticDir: dir });
  port = await hub.listen(0);
});
after(async () => { await hub.close(); });

test('잘못된 % 인코딩 주소는 400이고 서버는 계속 살아 있다', async () => {
  const bad = await fetch(`http://localhost:${port}/%E0%A4%A`);
  assert.equal(bad.status, 400);
  const ok = await fetch(`http://localhost:${port}/api/health`);
  assert.equal(ok.status, 200);
  const page = await fetch(`http://localhost:${port}/room/123456`);
  assert.equal(page.status, 200);
});

test('경로 이동(../)으로 정적 폴더 밖 파일을 읽지 못한다', async () => {
  const r = await fetch(`http://localhost:${port}/..%2F..%2Fetc%2Fpasswd`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<title>t<\/title>/);
});

test('한 연결이 1초에 너무 많이 보내면 거절한다', async () => {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  await new Promise(r => ws.once('open', r));
  const msgs: ServerMsg[] = [];
  ws.on('message', d => msgs.push(JSON.parse(d.toString())));
  for (let i = 0; i < MSG_LIMIT_PER_SEC + 10; i++) ws.send('{"t":"ping"}');
  const t = Date.now();
  while (msgs.length < MSG_LIMIT_PER_SEC + 1 && Date.now() - t < 3000) await new Promise(r => setTimeout(r, 10));
  await new Promise(r => setTimeout(r, 50));
  assert.equal(msgs.filter(m => m.t === 'pong').length, MSG_LIMIT_PER_SEC);
  assert.equal(msgs.filter(m => m.t === 'error').length, 1);
  ws.terminate();
});

test('같은 주소에서 방을 너무 많이 만들면 429', async () => {
  const codes: number[] = [];
  for (let i = 0; i < ROOMS_PER_IP_PER_MIN + 1; i++) {
    const r = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: '{"mode":"friend"}' });
    codes.push(r.status);
  }
  assert.equal(codes.filter(c => c === 201).length, ROOMS_PER_IP_PER_MIN);
  assert.equal(codes[codes.length - 1], 429);
});

test('주문 요청 기록은 라운드당 상한이 있고, 지난 라운드 기록은 정리된다', () => {
  const T0 = 1_000_000;
  const room = GameRoom.create({ code: '123456', mode: 'friend', now: T0, seed: 3 });
  const a = room.join(null, T0).token;
  room.join(null, T0);
  room.start(T0);
  const step = () => { const now = room.s.phaseEndsAt!; if (room.tick(now) === 'settled') room.beginRecap(now); };
  while (room.s.phase !== 'trade') step();
  const end = room.s.phaseEndsAt! - 1;
  for (let i = 0; i < MAX_REQUESTS_PER_ROUND; i++) room.placeOrder(a, `r${i}`, 'G01', 'buy', 1, end);
  assert.deepEqual(room.placeOrder(a, 'over', 'G01', 'buy', 1, end), { ok: false, reason: '이번 라운드 요청이 너무 많습니다' });
  /* 이미 처리한 요청의 재전송은 상한과 상관없이 같은 결과를 돌려준다 */
  assert.equal(room.placeOrder(a, 'r0', 'G01', 'buy', 1, end).duplicate, true);
  const p = room.player(a)!;
  /* 두 라운드 뒤에는 첫 라운드 기록이 사라진다 */
  for (let r = 0; r < 2; r++) { step(); while (room.s.phase !== 'trade') step(); }
  assert.equal(Object.keys(p.requests).length, 0);
});

test('QR용 와이파이 주소: 같은 PC 요청에만 알려 주고, 프록시를 거친 요청은 거절한다', async () => {
  const { isLoopback } = await import('../server/src/hub');
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('::1'), true);
  assert.equal(isLoopback('::ffff:127.0.0.1'), true);
  assert.equal(isLoopback('192.168.0.5'), false);
  assert.equal(isLoopback(undefined), false);
  const ok = await fetch(`http://127.0.0.1:${port}/api/lan`);
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray((await ok.json()).addrs));
  const proxied = await fetch(`http://127.0.0.1:${port}/api/lan`, { headers: { 'x-forwarded-for': '1.2.3.4' } });
  assert.equal(proxied.status, 404);
});

test('한 방에서 오류가 나도 다른 방은 계속 진행되고 서버는 살아 있다', async () => {
  const bad = hub.createRoom('solo'), good = hub.createRoom('solo');
  const origErr = console.error; const logged: unknown[] = []; console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    bad.tick = () => { throw new Error('일부러 낸 오류'); };
    let ticked = 0; const t = good.tick.bind(good); good.tick = (n: number) => { ticked++; return t(n); };
    (hub as unknown as { loop(): void }).loop();
    (hub as unknown as { loop(): void }).loop();
    assert.equal(ticked, 2, '다른 방은 계속 진행');
    assert.equal(logged.filter(l => String((l as unknown[])[0]).includes(bad.s.code)).length, 1, '같은 방 오류는 1분에 한 번만 기록');
    const h = await (await fetch(`http://localhost:${port}/api/health`)).json() as Record<string, unknown>;
    assert.equal(h.ok, true);
    assert.ok((h.errors as number) >= 2);
    assert.equal(typeof h.uptimeSec, 'number');
    assert.equal(typeof h.memoryMB, 'number');
    /* 상태 확인에 방 코드나 접속 주소를 넣지 않습니다 */
    assert.equal(JSON.stringify(h).includes(bad.s.code), false);
  } finally { console.error = origErr; }
});

test('JSON이 아니거나 형식이 틀린 메시지는 거절하고, 연결과 서버는 유지된다', async () => {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  await new Promise(r => ws.once('open', r));
  const msgs: ServerMsg[] = [];
  ws.on('message', d => msgs.push(JSON.parse(d.toString())));
  for (const raw of ['not json', 'null', '42', '[]', '{"t":1}', '{}']) ws.send(raw);
  await new Promise(r => setTimeout(r, 200));
  assert.equal(msgs.filter(m => m.t === 'error' && m.reason === '잘못된 요청입니다').length, 6);
  assert.equal(ws.readyState, WebSocket.OPEN);
  ws.close();
});
