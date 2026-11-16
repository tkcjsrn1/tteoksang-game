/* 실제 HTTP와 WebSocket으로 두 기기 대전을 끝까지 돌립니다. 시계만 테스트에서 넘깁니다. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { Hub } from '../server/src/hub';
import { GameRoom } from '../server/src/room';
import { MemoryStore, type Store } from '../server/src/store';
import type { ClientMsg, RoomView, ServerMsg, StockCode } from '../shared/types';

let hub: Hub, port: number, clock = 1_000_000;
before(async () => { hub = new Hub({ allowTestHooks: true, now: () => clock }); port = await hub.listen(0); });
after(async () => { await hub.close(); });

class Client {
  ws!: WebSocket; view: RoomView | null = null; token: string | null = null; role: string | null = null; acks = new Map<string, { ok: boolean; reason?: string; fill?: unknown }>(); ackCount = 0; errors: string[] = [];
  ticks: Extract<ServerMsg, { t: 'tick' }>[] = [];
  async connect() {
    this.ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((r, j) => { this.ws.once('open', r); this.ws.once('error', j); });
    this.ws.on('message', d => {
      const m = JSON.parse(d.toString()) as ServerMsg;
      if (m.t === 'view') this.view = m.view;
      if (m.t === 'welcome') { this.token = m.token; this.role = m.role; }
      if (m.t === 'ack') { this.acks.set(m.requestId, { ok: m.ok, reason: m.reason, fill: m.fill }); this.ackCount++; }
      if (m.t === 'tick') this.ticks.push(m);
      if (m.t === 'error') this.errors.push(m.reason);
    });
    return this;
  }
  send(m: ClientMsg) { this.ws.send(JSON.stringify(m)); }
  async hello(code: string, token?: string | null) {
    this.send({ t: 'hello', code, token });
    await until(() => this.view?.code === code && this.token !== null);
    return this;
  }
  async order(requestId: string, code: StockCode, side: 'buy' | 'sell', qty: number) {
    this.send({ t: 'order', requestId, code, side, qty });
    await until(() => this.acks.has(requestId));
    return this.acks.get(requestId)!;
  }
  close() { this.ws.terminate(); }
}
async function until(f: () => boolean, ms = 5000) {
  const t = Date.now();
  while (!f()) { if (Date.now() - t > ms) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 5)); }
}
async function create(body: object) {
  const r = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: JSON.stringify(body) });
  return r.json() as Promise<{ code: string }>;
}
/** 현재 단계가 끝날 때까지 시계를 넘기고 다음 단계가 보일 때까지 기다립니다. */
async function advance(room: GameRoom, watchers: Client[]) {
  const from = `${room.s.round}:${room.s.phase}:${room.s.status}`;
  clock = room.s.phaseEndsAt! + 1;
  await until(() => `${room.s.round}:${room.s.phase}:${room.s.status}` !== from && room.s.phase !== 'settling');
  await until(() => watchers.every(w => w.view?.round === room.s.round && w.view?.phase === room.s.phase && w.view?.status === room.s.status));
}

test('혼자 연습은 선택한 종목 수·라운드·장 시간을 적용하고 재대전에도 유지한다', async () => {
  const settings = { stocks: 30, rounds: 3, trade: 45, level: 'pro' as const };
  const { code } = await create({ mode: 'solo', seed: 5, settings });
  const room = hub.rooms.get(code)!;
  const player = await new Client().connect();
  try {
    await player.hello(code);
    assert.equal(player.view!.stocks.length, 30);
    assert.equal(player.view!.totalRounds, 3);
    await advance(room, [player]);
    assert.equal(player.view!.phaseSeconds, 45);
    assert.equal(player.view!.level, 'pro');
    const restored = new GameRoom(JSON.parse(JSON.stringify(room.s)));
    assert.equal(restored.config.trade, 45);
    assert.equal(restored.config.level, 'pro');
    assert.equal(restored.config.rounds, 3);
    assert.equal(restored.stocks.length, 30);
    while (room.s.status === 'playing') await advance(room, [player]);
    assert.equal(room.s.round, 3);
    player.send({ t: 'rematch' });
    await until(() => !!player.view?.nextRoomCode);
    const next = hub.rooms.get(player.view!.nextRoomCode!)!;
    assert.deepEqual(next.s.settings, settings);
    assert.equal(next.stocks.length, 30);
  } finally {
    player.close();
  }
});

test('범위를 벗어난 게임 설정은 방을 만들기 전에 거절한다', async () => {
  const count = hub.rooms.size;
  /* 정원(maxPlayers)은 친구 대전에만 있는 설정입니다. 혼자 연습에 보내면 거절합니다 */
  for (const settings of [{ stocks: 31 }, { rounds: '5' }, { trade: 0 }, { unknown: 1 }, { level: 'hard' }, { level: 1 }, { maxPlayers: 80 }, { pace: 'fast' }, { pace: 1 }, null]) {
    const r = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'solo', settings }) });
    assert.equal(r.status, 400);
  }
  assert.equal(hub.rooms.size, count);
});

test('친구 대전은 정원을 올려서 만들 수 있다', async () => {
  const r = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'friend', settings: { maxPlayers: 80 } }) });
  assert.equal(r.status, 201);
  const { code } = await r.json() as { code: string };
  assert.equal(hub.rooms.get(code)!.config.maxPlayers, 80);
});

test('정산 중인 방은 서버 시작 후 결과를 공개하고 다음 라운드로 진행한다', async () => {
  let now = 1_000_000;
  const room = GameRoom.create({ code: '111111', mode: 'solo', now, seed: 5, settings: { level: 'pro' } });
  const player = room.join(null, now).token;
  room.start(now);
  room.tick(room.s.phaseEndsAt!);
  const orderAt = room.s.live!.startedAt;
  assert.equal(room.placeOrder(player, 'buy', 'G01', 'buy', 10, orderAt).ok, true);
  now = room.s.phaseEndsAt!;
  assert.equal(room.tick(now), 'settled');
  const cash = room.player(player)!.cash;
  const store = new MemoryStore();
  await store.saveRoom(room.s);
  const restarted = new Hub({ store, now: () => now });
  await restarted.listen(0);
  try {
    const restored = restarted.rooms.get(room.s.code)!;
    await until(() => restored.s.phase === 'recap', 1000);
    assert.deepEqual(restored.s.settled, [1]);
    assert.equal(restored.player(player)!.cash, cash);
    assert.equal(restored.player(player)!.holdings.G01?.qty, 10);
    assert.equal(restored.view(player, 'player', now).lastResult?.round, 1);
    now = restored.s.phaseEndsAt!;
    await until(() => restored.s.round === 2);
    assert.equal(restored.s.phase, 'news');
  } finally {
    await restarted.close();
  }
});

test('정산은 이전 방 저장이 끝난 뒤 저장하고, 성공할 때까지 결과를 숨긴다', async () => {
  let now = 1_000_000;
  function signal() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
  }
  const saveStarted = signal();
  const releaseSave = signal();
  const releaseSettlement = signal();
  let settlements = 0;
  const memory = new MemoryStore();
  const store: Store = memory;
  const saveRoom = memory.saveRoom.bind(memory);
  store.saveRoom = async state => {
    if (state.phase !== 'trade') return saveRoom(state);
    const snapshot = structuredClone(state);
    saveStarted.resolve();
    await releaseSave.promise;
    await saveRoom(snapshot);
  };
  store.saveSettlement = async (_code, _round, state) => {
    settlements++;
    await releaseSettlement.promise;
    await saveRoom(state);
  };
  const savingHub = new Hub({ store, now: () => now });
  await savingHub.listen(0);
  try {
    const room = savingHub.createRoom('solo', { seed: 5 });
    room.join(null, now);
    room.start(now);
    now = room.s.phaseEndsAt!;
    room.tick(now);
    await saveStarted.promise;
    now = room.s.phaseEndsAt!;
    await until(() => room.s.phase === 'settling');
    assert.equal(settlements, 0, '진행 중인 이전 저장을 기다려야 함');
    releaseSave.resolve();
    await until(() => settlements === 1);
    assert.equal(room.s.phase, 'settling');
    releaseSettlement.resolve();
    await until(() => room.s.phase === 'recap');
    assert.deepEqual(memory.rooms.get(room.s.code)?.settled, [1]);
  } finally {
    releaseSave.resolve();
    releaseSettlement.resolve();
    await savingHub.close();
  }
});

test('두 기기가 같은 방에서 뉴스 → 주문 → 체결 → 그래프 → 최종 순위까지 끝낸다', async () => {
  const { code } = await create({ mode: 'friend', seed: 11, forcedArcs: ['nuvakan', 'heatwave'], forced: { 'nu-1': 'pass', 'nu-2a': 'approved', 'nu-3a': 'short' } });
  const a = await (await new Client().connect()).hello(code);
  const b = await (await new Client().connect()).hello(code);
  await until(() => a.view!.humanCount === 2);
  assert.equal(a.view!.you.isHost, true);
  assert.equal(b.view!.you.isHost, false);
  b.send({ t: 'start' });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(hub.rooms.get(code)!.s.status, 'lobby', '방장만 시작');
  a.send({ t: 'start' });
  await until(() => a.view!.phase === 'news' && b.view!.phase === 'news');
  const room = hub.rooms.get(code)!;
  assert.equal(a.view!.news[0].cards[0].result, null);
  for (let r = 1; r <= 5; r++) {
    await advance(room, [a, b]);
    assert.equal(a.view!.phase, 'trade');
    assert.equal((await a.order(`a${r}`, 'G01', 'buy', 50)).ok, true);
    assert.equal((await b.order(`b${r}`, 'G03', 'buy', 50)).ok, true);
    await until(() => a.view!.portfolio!.holdings.some(h => h.code === 'G01'));
    await advance(room, [a, b]);
    assert.equal(a.view!.phase, 'recap');
    assert.deepEqual(a.view!.stocks, b.view!.stocks, '같은 종료가');
    assert.deepEqual(a.view!.news, b.view!.news, '같은 결말');
    assert.ok(a.view!.lastResult);
    await advance(room, [a, b]);
  }
  assert.equal(a.view!.status, 'finished');
  const g01 = a.view!.stocks.find(s => s.code === 'G01')!;
  const fall = g01.history.find(h => h.events.some(e => e.label === '기대에 못 미친 계약 규모'));
  assert.ok(fall, '하락 근거');
  assert.ok(fall!.events.some(e => e.bp === -500));
  assert.equal(a.view!.leaderboard.length, 5);
  const v = a.view!;
  const me = v.leaderboard.find(l => l.playerId === v.you.id)!;
  const holdingValue = v.portfolio!.holdings.reduce((x, h) => x + h.qty * v.stocks.find(s => s.code === h.code)!.price, 0);
  assert.equal(me.value, v.portfolio!.cash + holdingValue);

  /* 같은 멤버로 한 판 더: 새 대기실, 자산 초기화, 직전에 안 한 사건 */
  a.send({ t: 'rematch' });
  await until(() => !!b.view!.nextRoomCode);
  const nextCode = b.view!.nextRoomCode!;
  assert.notEqual(nextCode, code);
  const a2 = await (await new Client().connect()).hello(nextCode, a.token);
  const b2 = await (await new Client().connect()).hello(nextCode, b.token);
  await until(() => a2.view!.humanCount === 2);
  assert.equal(a2.view!.status, 'lobby');
  assert.equal(a2.view!.portfolio!.cash, 10_000_000);
  const nr = hub.rooms.get(nextCode)!;
  assert.equal(nr.s.plan.arcIds.some(x => ['nuvakan', 'heatwave'].includes(x)), false);
  [a, b, a2, b2].forEach(c => c.close());
});

test('재접속, 중복 요청, 관전, 방장 이탈', async () => {
  const { code } = await create({ mode: 'friend', seed: 12 });
  const a = await (await new Client().connect()).hello(code);
  const b = await (await new Client().connect()).hello(code);
  /* 시작 조건은 접속 중인 사람 수라서, a가 나가도 두 명이 남게 c를 둡니다 */
  const c = await (await new Client().connect()).hello(code);
  await until(() => b.view!.humanCount === 3);
  a.close();
  await until(() => b.view!.you.isHost && b.view!.humanCount === 2);
  b.send({ t: 'start' });
  const room = hub.rooms.get(code)!;
  await until(() => room.s.status === 'playing');
  await until(() => b.view!.phase === 'news');
  const a2 = await (await new Client().connect()).hello(code, a.token);
  assert.equal(a2.role, 'player');
  const spec = await (await new Client().connect()).hello(code);
  assert.equal(spec.role, 'spectator');
  assert.equal(spec.view!.portfolio, null);
  await advance(room, [a2, b, spec]);
  const r = await a2.order('same', 'G02', 'buy', 10);
  assert.equal(r.ok, true);
  a2.send({ t: 'order', requestId: 'same', code: 'G02', side: 'buy', qty: 999 });
  await until(() => a2.ackCount >= 2);
  assert.equal(room.player(a2.token)!.holdings.G02!.qty, 10, '시장가는 바로 체결, 같은 요청은 한 번만');
  a2.close();
  await until(() => !room.player(a2.token)!.connected);
  await advance(room, [b, spec]);
  assert.equal(room.player(a2.token)!.holdings.G02!.qty, 10, '연결이 끊겨도 체결');
  const a3 = await (await new Client().connect()).hello(code, a2.token);
  assert.equal(a3.view!.portfolio!.holdings[0].qty, 10);
  b.close();
  await advance(room, [a3, spec]);
  assert.equal(a3.view!.phase, 'news', '방장이 나가도 진행');
  [a3, spec, c].forEach(x => x.close());
});

test('혼자 연습은 즉시 시작하고, 없어진 모드로는 방이 친구 대전으로 만들어진다', async () => {
  const solo = await create({ mode: 'solo' });
  const s = await (await new Client().connect()).hello(solo.code);
  await until(() => s.view!.status === 'playing');
  assert.equal(s.view!.leaderboard.length, 4);
  s.close();
  const old = await create({ mode: 'academic' });
  assert.equal(hub.rooms.get(old.code)!.s.mode, 'friend');
});
test('운영자 방: 운영자·대형 화면은 자리를 차지하지 않고, 시작과 다음 판은 운영자만 연다', async () => {
  const bad = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'solo', operated: true }) });
  assert.equal(bad.status, 400, '혼자 연습에는 운영자 방이 없음');
  const plain = await create({ mode: 'friend' }) as { code: string; operatorToken?: string };
  assert.equal(plain.operatorToken, undefined, '일반 방은 열쇠를 주지 않음');
  const over = await fetch(`http://localhost:${port}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'friend', operated: true, settings: { maxPlayers: 160 } }) });
  assert.equal(over.status, 400, '80명을 넘는 정원은 거절');
  const made = await create({ mode: 'friend', operated: true, seed: 21, settings: { maxPlayers: 80, rounds: 3 } }) as { code: string; operatorToken: string };
  const { code, operatorToken: key } = made;
  assert.ok(key);
  const room = hub.rooms.get(code)!;
  /* 받은 메시지를 모두 모아 열쇠가 섞여 나가는지 봅니다 */
  const raw: string[] = [];
  const staff = async (body: Partial<Extract<ClientMsg, { t: 'hello' }>>) => {
    const c = await new Client().connect();
    c.ws.on('message', d => raw.push(d.toString()));
    c.send({ t: 'hello', code, ...body });
    await until(() => c.role !== null && c.view?.code === code);
    return c;
  };
  const op = await staff({ operatorToken: key, display: true });
  assert.equal(op.role, 'operator');
  const disp = await staff({ display: true });
  assert.equal(disp.role, 'display');
  const fake = await staff({ operatorToken: 'nope', display: true });
  assert.equal(fake.role, 'display', '틀린 열쇠는 대형 화면(읽기 전용)으로만');
  assert.equal(room.humans.length, 0, '운영자·대형 화면은 참가자 자리를 차지하지 않음');
  assert.equal(room.s.spectators.length, 0, '관전자 목록에도 남지 않음');
  const a = await (await new Client().connect()).hello(code);
  a.ws.on('message', d => raw.push(d.toString()));
  await until(() => op.view!.humanCount === 1 && disp.view!.humanCount === 1);
  assert.equal(a.view!.operated, true);
  assert.equal(a.view!.you.isHost, false);
  a.send({ t: 'start' });
  fake.send({ t: 'start' });
  disp.send({ t: 'start' });
  await until(() => a.errors.length > 0 && fake.errors.length > 0 && disp.errors.length > 0);
  assert.equal(room.s.status, 'lobby', '참가자·대형 화면은 시작 못 함');
  op.send({ t: 'start' });
  await until(() => room.s.status === 'playing');
  await until(() => disp.view!.status === 'playing' && disp.view!.phase === 'news');
  assert.equal(disp.view!.portfolio, null);
  assert.equal(op.view!.portfolio, null);
  while ((room.s.status as string) === 'playing') await advance(room, [op, disp, a]);
  a.send({ t: 'rematch' });
  disp.send({ t: 'rematch' });
  await new Promise(r => setTimeout(r, 50));
  assert.equal(room.s.nextRoomCode, null, '참가자·대형 화면은 다음 판을 못 엶');
  op.send({ t: 'rematch' });
  await until(() => a.view!.nextRoomCode !== null && disp.view!.nextRoomCode !== null);
  const next = hub.rooms.get(room.s.nextRoomCode!)!;
  assert.equal(next.isOperator(key), true, '다음 판도 같은 열쇠로 진행');
  assert.equal(next.config.maxPlayers, 80);
  assert.equal(raw.some(m => m.includes(key)), false, '열쇠는 어떤 메시지에도 실리지 않음');
  [op, disp, fake, a].forEach(c => c.close());
});
test('없는 방과 정적 경로 방어', async () => {
  const c = await new Client().connect();
  c.send({ t: 'hello', code: '000000' });
  await until(() => c.errors.length > 0);
  c.close();
  const r = await fetch(`http://localhost:${port}/api/rooms/999999`);
  assert.equal(r.status, 404);
  const h = await (await fetch(`http://localhost:${port}/api/health`)).json() as { ok: boolean };
  assert.equal(h.ok, true);
});

test('주문 시간에는 1초마다 시세가 오고, 지정가 예약은 시세가 닿으면 체결된다', async () => {
  const { code } = await create({ mode: 'friend', seed: 21, settings: { level: 'pro' } });
  const a = await (await new Client().connect()).hello(code);
  const b = await (await new Client().connect()).hello(code);
  await until(() => a.view!.humanCount === 2);
  a.send({ t: 'start' });
  const room = hub.rooms.get(code)!;
  await until(() => a.view!.phase === 'news');
  await advance(room, [a, b]);
  assert.equal(a.view!.phase, 'trade');
  const live = room.s.live!;
  /* 이번 판 종목은 시드마다 달라지므로 첫 종목을 씁니다 */
  const code0 = room.s.plan.stockCodes![0];
  const path = live.paths[code0];
  const open = path[0];
  /* 시세가 처음으로 시가보다 낮아지는 칸을 찾아 그 가격에 매수 예약 */
  const k = path.findIndex((p, i) => i > 0 && p < open);
  assert.ok(k > 0, '이 시드는 장중에 시가 아래로 내려감');
  const limit = path[k];
  a.send({ t: 'order', requestId: 'lim', code: code0, side: 'buy', qty: 10, kind: 'limit', limit });
  await until(() => a.acks.has('lim'));
  assert.equal(a.acks.get('lim')!.ok, true);
  assert.equal(a.acks.get('lim')!.fill, null, '아직 체결 전');
  await until(() => a.view!.portfolio!.orders.length === 1);
  assert.equal(a.view!.portfolio!.orders[0].price, limit);
  /* 시계를 k초 뒤로 넘기면 시세 메시지가 오고 예약이 지정가에 체결됩니다 */
  clock = live.startedAt + k * 1000 + 10;
  await until(() => b.ticks.some(t => t.k >= k));
  const t = b.ticks.find(x => x.k === k)!;
  assert.equal(t.prices[code0], path[k]);
  await until(() => a.view!.portfolio!.holdings.some(h => h.code === code0));
  const f = room.player(a.token)!.fills.find(x => x.code === code0)!;
  assert.equal(f.price, limit);
  assert.equal(f.kind, 'limit');
  assert.equal(a.view!.portfolio!.orders.length, 0);
  /* 시세 메시지에는 다른 사람 주문·결말이 없습니다 */
  assert.deepEqual(Object.keys(t).sort(), ['k', 'prices', 'round', 't']);
  [a, b].forEach(c => c.close());
});

test('오래 손대지 않은 방은 다시 켤 때 불러오지 않고 지운다', async () => {
  const store = new MemoryStore();
  const day = 24 * 60 * 60 * 1000;
  const now = 10 * day;
  /* 방금 멈춘 방 하나와, 이틀 전에 멈춘 방 하나 */
  const fresh = GameRoom.create({ code: '555555', mode: 'solo', now: now - 1000, seed: 1 });
  fresh.join(null, now - 1000); fresh.start(now - 1000);
  const old = GameRoom.create({ code: '666666', mode: 'solo', now: now - 2 * day, seed: 2 });
  old.join(null, now - 2 * day); old.start(now - 2 * day);
  await store.saveRoom(fresh.s);
  await store.saveRoom(old.s);
  const hub = new Hub({ store, now: () => now });
  await hub.listen(0);
  try {
    assert.ok(hub.rooms.has('555555'), '최근 방은 이어서 할 수 있어야 합니다');
    assert.equal(hub.rooms.has('666666'), false, '오래된 방을 메모리로 올리면 안 됩니다');
    await until(() => !store.rooms.has('666666'), 2000);
    assert.ok(store.rooms.has('555555'), '최근 방 기록을 지우면 안 됩니다');
  } finally { await hub.close(); }
});

test('다음 단계(skip)는 운영자만 보낼 수 있고, 보내면 다음 단계로 넘어간다', async () => {
  const made = await create({ mode: 'friend', operated: true, settings: { rounds: 3 } }) as { code: string; operatorToken: string };
  const room = hub.rooms.get(made.code)!;
  const op = await new Client().connect();
  op.send({ t: 'hello', code: made.code, operatorToken: made.operatorToken, display: true });
  await until(() => op.role === 'operator' && op.view !== null);
  const p = await (await new Client().connect()).hello(made.code);
  op.send({ t: 'start' });
  await until(() => room.s.status === 'playing' && p.view?.phase === 'news');
  const errs = p.errors.length;
  p.send({ t: 'skip' });
  await until(() => p.errors.length > errs);
  assert.equal(room.s.phase, 'news', '참가자는 넘길 수 없음');
  op.send({ t: 'skip' });
  await until(() => p.view?.phase === 'trade');
  op.close(); p.close();
});
