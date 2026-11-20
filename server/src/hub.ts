import os from 'node:os';
/* 방 목록, WebSocket 연결, 타이머를 묶는 서버 본체. HTTP 서버와 분리해 통합 테스트에서 그대로 띄웁니다. */
import { randomInt } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { isLevel, isPace, MODES, ROOM_OPTIONS } from '../../shared/rules';
import type { ClientMsg, GameMode, Role, RoomSettings, ServerMsg, StockCode } from '../../shared/types';
import type { ForcedOutcomes } from './plan';
import { GameRoom } from './room';
import { MemoryStore, type Store } from './store';

interface Conn { ws: WebSocket; room: GameRoom | null; token: string | null; role: Role; alive: boolean; windowStart: number; msgCount: number }
export interface HubOptions { store?: Store; staticDir?: string; port?: number; allowTestHooks?: boolean; speed?: number; now?: () => number;
  /** 리버스 프록시 뒤에서 X-Forwarded-For의 첫 주소를 접속 주소로 씁니다. 프록시가 없을 때 켜면 주소를 속일 수 있습니다. */
  trustProxy?: boolean }

/** 클라이언트가 붙이는 요청 ID: crypto.randomUUID()(36자) 등. 64자까지 받습니다. */
const validRequestId = (v: unknown): v is string => typeof v === 'string' && v.length >= 1 && v.length <= 64;
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
/* 링크 미리보기(og:image·og:url)는 전체 주소여야 합니다. 배포할 때 PUBLIC_URL에 https://내주소 를 넣으면
   index.html의 %PUBLIC_URL%을 그 값으로 바꿔서 내보냅니다. 비워 두면 /og.png 같은 상대 주소가 됩니다. */
const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
/* 저장소에 남은 방 기록을 지우는 기준과 주기. 다시 켤 때는 이 안에 손댄 방만 불러옵니다.
   이게 없으면 끝내지 않고 나간 방이 계속 쌓여, 다시 켤 때마다 전부 메모리로 올라옵니다. */
const ROOM_KEEP_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
/* 남용 방지. 게임 시계가 아니라 실제 시간(Date.now)으로 셉니다. */
export const MSG_LIMIT_PER_SEC = 30;       // 연결 하나가 1초에 보낼 수 있는 메시지 수
export const MAX_ROOMS = 1000;             // 서버 전체 방 수 상한
export const RECENT_ARCS_MAX = 12;         // 방을 만들 때 "최근에 본 사건"으로 받아 줄 개수
export const ROOMS_PER_IP_PER_MIN = 20;    // 같은 주소에서 1분에 만들 수 있는 방 수
/* 장중 시세 메시지에 순위(평가액)를 싣는 주기. 참가자(NPC 포함)가 BOARD_BIG_ROOM명 이하면 매초,
   그보다 많으면 BOARD_EVERY_BIG초마다(80명 방에서 1초 전송량이 너무 늘지 않게) */
export const BOARD_BIG_ROOM = 20;
export const BOARD_EVERY_BIG = 3;

export class Hub {
  rooms = new Map<string, GameRoom>();
  conns = new Set<Conn>();
  store: Store;
  server: http.Server;
  wss: WebSocketServer;
  private timer: NodeJS.Timeout | null = null;
  private busy = new Set<string>();
  private dirty = new Set<string>();
  private saving = new Map<string, Promise<void>>();
  private lastFlush = 0;
  private readonly startedAt = Date.now();
  private errors = 0;
  private lastRoomError = new Map<string, number>();
  private createLog = new Map<string, number[]>();
  now: () => number;
  constructor(private opts: HubOptions = {}) {
    this.store = opts.store ?? new MemoryStore();
    this.now = opts.now ?? Date.now;
    this.server = http.createServer((req, res) => this.http(req, res));
    this.wss = new WebSocketServer({ server: this.server, path: '/ws', maxPayload: 16 * 1024 });
    this.wss.on('connection', ws => this.onConnection(ws));
  }
  async listen(port = this.opts.port ?? 8787): Promise<number> {
    await this.store.init();
    /* 없어진 모드(예전 학술제 방)로 저장된 방은 건너뜁니다. */
    for (const s of await this.store.loadActive(this.now() - ROOM_KEEP_MS)) if (MODES[s.mode]) {
      const room = new GameRoom(s);
      room.resetConnections();
      this.rooms.set(s.code, room);
    }
    void this.sweep();
    await new Promise<void>(r => this.server.listen(port, r));
    this.timer = setInterval(() => this.loop(), 100);
    return (this.server.address() as { port: number }).port;
  }
  async close() {
    if (this.timer) clearInterval(this.timer);
    this.conns.forEach(c => c.ws.terminate());
    this.wss.close();
    const closed = new Promise(r => this.server.close(r));
    this.server.closeAllConnections();   // 열려 있는 HTTP keep-alive 연결 때문에 종료가 멈추지 않게
    await closed;
    await Promise.all(this.saving.values());
    await this.flush();
    await this.store.close();
  }
  /** 서버 상태 요약. 방 내용이나 접속 주소는 넣지 않습니다. */
  health() {
    const commit = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? '';
    return {
      ok: true, store: this.store.name, rooms: this.rooms.size, connections: this.conns.size,
      uptimeSec: Math.floor((this.now() - this.startedAt) / 1000),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      errors: this.errors, version: commit.slice(0, 7) || 'dev'
    };
  }
  private logRoomError(code: string, e: unknown, now: number) {
    const last = this.lastRoomError.get(code) ?? 0;
    if (now - last < 60_000) return;
    this.lastRoomError.set(code, now);
    console.error(`방 ${code} 진행 오류`, e);
  }
  newCode() {
    for (;;) { const c = String(randomInt(100000, 1000000)); if (!this.rooms.has(c)) return c; }
  }
  createRoom(mode: GameMode, opts: { seed?: number; excludedArcs?: string[]; forced?: ForcedOutcomes; forcedArcs?: string[]; settings?: RoomSettings; operated?: boolean } = {}) {
    const room = GameRoom.create({ code: this.newCode(), mode, now: this.now(), ...opts });
    this.rooms.set(room.s.code, room);
    this.dirty.add(room.s.code);
    return room;
  }

  /* ---------- 타이머 ---------- */
  /** 다음 타이머에서 방 전체에 한 번 보낼 방들(입장·퇴장이 몰릴 때 묶어 보내기) */
  private later = new Set<GameRoom>();
  private loop() {
    const now = this.now();
    for (const room of this.later) if (this.rooms.get(room.s.code) === room) this.broadcast(room);
    this.later.clear();
    for (const room of this.rooms.values()) {
      if (this.busy.has(room.s.code)) continue;
      // 재시작 때 불러온 정산 중인 방은 계산을 되풀이하지 않고 저장부터 이어갑니다.
      if (room.s.phase === 'settling') { void this.afterSettle(room); continue; }
      /* 한 방의 오류가 타이머 전체(=모든 방)를 멈추지 않게 방마다 따로 잡습니다. 같은 방 오류는 1분에 한 번만 기록합니다. */
      let r: ReturnType<GameRoom['tick']>;
      try { r = room.tick(now); }
      catch (e) { this.errors++; this.logRoomError(room.s.code, e, now); continue; }
      if (r === 'tick') { this.broadcastTick(room); this.sendTouched(room); }
      else if (r === 'changed') { room.touched.clear(); this.dirty.add(room.s.code); this.broadcast(room); }
      else if (r === 'finished') { this.dirty.add(room.s.code); this.broadcast(room); }
      else if (r === 'settled') void this.afterSettle(room);
      else if (now - room.s.updatedAt > ROOM_TTL_MS) this.rooms.delete(room.s.code);
    }
    if (now - this.lastFlush > 1000) { this.lastFlush = now; void this.flush(); }
    if (Date.now() - this.lastSweep > SWEEP_EVERY_MS) void this.sweep();
  }
  /** 오래된 방 기록을 지웁니다. 실패해도 게임은 그대로 돌아갑니다. */
  private lastSweep = Date.now();
  private async sweep() {
    this.lastSweep = Date.now();
    try {
      const n = await this.store.sweep(this.now() - ROOM_KEEP_MS);
      if (n > 0) console.log(`오래된 방 기록 ${n}개를 지웠습니다`);
    } catch (e) { console.error('오래된 방 기록 정리 실패(무시합니다)', e instanceof Error ? e.message : e); }
  }
  /** 정산을 저장한 뒤에만 결과를 공개합니다. 저장이 실패하면 재시도하고, 그동안 화면은 체결 확인 중입니다. */
  private async afterSettle(room: GameRoom) {
    const code = room.s.code;
    this.busy.add(code);
    this.broadcast(room);
    // 느린 이전 스냅샷이 정산 결과를 덮어쓰지 않도록 먼저 끝냅니다.
    await this.saving.get(code);
    for (let attempt = 0; ; attempt++) {
      try { await this.store.saveSettlement(code, room.s.round, room.s); break; }
      catch (e) { console.error('정산 저장 실패, 다시 시도합니다', e); await new Promise(r => setTimeout(r, Math.min(5000, 300 * 2 ** attempt))); }
    }
    room.beginRecap(this.now());
    this.dirty.add(code);
    this.busy.delete(code);
    this.broadcast(room);
  }
  private async flush() {
    for (const code of [...this.dirty]) {
      if (this.busy.has(code) || this.saving.has(code) || !this.dirty.delete(code)) continue;
      const room = this.rooms.get(code);
      if (!room) continue;
      const save = this.store.saveRoom(room.s)
        .catch(e => { console.error('저장 실패', e); this.dirty.add(code); })
        .finally(() => this.saving.delete(code));
      this.saving.set(code, save);
      await save;
    }
  }

  /* ---------- WebSocket ---------- */
  private send(c: Conn, m: ServerMsg) { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m)); }
  /** 장중 시세 한 칸만 보냅니다(가벼운 메시지). */
  private broadcastTick(room: GameRoom) {
    const l = room.s.live;
    if (!l) return;
    const prices: Partial<Record<StockCode, number>> = {};
    room.stocks.forEach(st => { prices[st.code] = room.markPrice(st.code); });
    /* 순위도 시세와 같은 시점으로 맞춥니다. 예전에는 순위가 장 시작·내 주문 때만 바뀌어서,
       1초마다 바뀌는 내 평가액과 순위가 서로 다른 시점이었습니다(친구가 더 많아도 내가 위로 보임).
       사람이 많은 방은 전송량을 줄이려고 BOARD_EVERY_BIG초에 한 번만 싣습니다. */
    const every = room.s.players.length > BOARD_BIG_ROOM ? BOARD_EVERY_BIG : 1;
    const board = l.k % every === 0 ? room.tickBoard() : undefined;
    const msg = JSON.stringify({ t: 'tick', round: room.s.round, k: l.k, prices, ...(board ? { board } : {}) } satisfies ServerMsg);
    for (const c of this.conns) if (c.room === room && c.ws.readyState === WebSocket.OPEN) c.ws.send(msg);
  }
  /** 예약 주문이 체결된 참가자에게만 화면 전체를 다시 보냅니다. */
  private sendTouched(room: GameRoom) {
    if (!room.touched.size) return;
    const ids = new Set(room.touched); room.touched.clear();
    this.dirty.add(room.s.code);
    const now = this.now();
    for (const c of this.conns) if (c.room === room && c.token && ids.has(room.player(c.token)?.id ?? '')) this.sendView(c, now);
  }
  broadcast(room: GameRoom) {
    const now = this.now();
    for (const c of this.conns) if (c.room === room) this.sendView(c, now);
  }
  private sendView(c: Conn, now = this.now()) {
    if (!c.room) return;
    const view = c.room.view(c.token, c.role, now);
    this.send(c, { t: 'view', view });
  }
  private onConnection(ws: WebSocket) {
    const c: Conn = { ws, room: null, token: null, role: 'spectator', alive: true, windowStart: Date.now(), msgCount: 0 };
    this.conns.add(c);
    ws.on('message', d => {
      const t = Date.now();
      if (t - c.windowStart >= 1000) { c.windowStart = t; c.msgCount = 0; }
      if (++c.msgCount > MSG_LIMIT_PER_SEC) { if (c.msgCount === MSG_LIMIT_PER_SEC + 1) this.send(c, { t: 'error', reason: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' }); return; }
      let m: unknown;
      try { m = JSON.parse(d.toString()); } catch { m = null; }
      if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') { this.send(c, { t: 'error', reason: '잘못된 요청입니다' }); return; }
      try { this.onMessage(c, m as ClientMsg); }
      catch (e) { this.errors++; console.error('메시지 처리 오류', e); this.send(c, { t: 'error', reason: '처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요' }); } });
    ws.on('close', () => {
      this.conns.delete(c);
      if (c.room && c.token && c.role === 'player') {
        const stillOn = [...this.conns].some(o => o.room === c.room && o.token === c.token);
        if (!stillOn) { c.room.disconnect(c.token, this.now()); this.later.add(c.room); }
      }
    });
    ws.on('error', () => {});
  }
  private onMessage(c: Conn, m: ClientMsg) {
    const now = this.now();
    if (m.t === 'ping') return this.send(c, { t: 'pong' });
    if (m.t === 'hello') {
      const room = this.rooms.get(String(m.code));
      if (!room) return this.send(c, { t: 'error', reason: '방을 찾을 수 없습니다. 코드를 확인해 주세요' });
      /* 이 연결이 이미 어느 방의 참가자·관전자라면: 같은 방이면 새 자리를 만들지 않고 같은 자리로 다시 붙이고,
         다른 방(또는 대형 화면)으로 옮기면 이전 자리는 끊김으로 둡니다. 한 연결로 hello를 반복해 유령 참가자로 정원을 채우지 못하게 합니다. */
      const prevRoom = c.room, prevToken = c.role === 'player' || c.role === 'spectator' ? c.token : null;
      const staff: Role | null = room.isOperator(m.operatorToken) ? 'operator' : m.display === true ? 'display' : null;
      const reuse = !staff && prevRoom === room && prevToken ? prevToken : null;
      if (prevRoom && prevToken && c.role === 'player' && !reuse && ![...this.conns].some(o => o !== c && o.room === prevRoom && o.token === prevToken)) {
        prevRoom.disconnect(prevToken, now); this.later.add(prevRoom);
      }
      c.room = room;
      /* 운영자와 대형 화면은 참가자 자리를 차지하지 않고 관전자 목록에도 남지 않습니다. */
      if (staff) {
        c.token = null; c.role = staff;
        this.send(c, { t: 'welcome', token: null, role: staff, label: null, code: room.s.code });
        this.sendView(c, now);
        return;
      }
      const j = room.join(reuse ?? m.token, now);
      c.token = j.token; c.role = j.role;
      this.send(c, { t: 'welcome', token: j.token, role: j.role, label: j.label, code: room.s.code });
      /* 혼자 연습은 입장 즉시 시작합니다. */
      if (room.s.mode === 'solo' && room.s.status === 'lobby') room.start(now);
      this.dirty.add(room.s.code);
      /* 들어온 사람에게는 바로 보내고, 나머지에게는 타이머(0.1초)에서 한 번에 모아 보냅니다.
         80명이 몰려 들어올 때 입장 한 번마다 방 전체에 보내면 80×80번이 됩니다. */
      this.sendView(c, now);
      this.later.add(room);
      return;
    }
    const room = c.room;
    if (!room) return this.send(c, { t: 'error', reason: '먼저 방에 들어와 주세요' });
    /* 주문·취소·손절 요청은 요청 ID(1~64자 문자열)가 있어야 합니다. 없으면 "undefined"라는 ID로 저장돼 중복 확인이 망가지고,
       너무 길면 요청 기록(방 상태)이 커집니다. */
    if ((m.t === 'order' || m.t === 'cancel' || m.t === 'stop') && !validRequestId(m.requestId)) return this.send(c, { t: 'error', reason: '잘못된 요청입니다' });
    switch (m.t) {
      case 'start':
        if (!room.canStart(c.token, c.role === 'operator' ? room.s.operatorToken : null)) return this.send(c, { t: 'error', reason: '지금은 시작할 수 없습니다' });
        room.start(now); this.dirty.add(room.s.code); this.broadcast(room); return;
      case 'order': {
        const kind = m.kind === 'limit' ? 'limit' : 'market';
        const res = room.placeOrder(c.token ?? '', String(m.requestId), m.code as StockCode, m.side, Number(m.qty), now, kind, m.limit === undefined ? undefined : Number(m.limit));
        room.touched.delete(room.player(c.token)?.id ?? '');
        this.send(c, { t: 'ack', requestId: m.requestId, ok: res.ok, reason: res.reason, fill: res.fill ?? null });
        if (res.ok && !res.duplicate) {
          const p = room.player(c.token)!;
          void this.store.recordOrder(room.s.code, p.id, m.requestId, { code: m.code, side: m.side, qty: m.qty, kind, limit: m.limit ?? null, fill: res.fill ?? null, round: room.s.round }).catch(e => console.error(e));
          this.dirty.add(room.s.code);
          this.sendView(c, now);
        }
        return;
      }
      case 'cancel': {
        const res = room.cancelOrder(c.token ?? '', String(m.requestId), m.code as StockCode, now);
        this.send(c, { t: 'ack', requestId: m.requestId, ok: res.ok, reason: res.reason });
        if (res.ok && !res.duplicate) { this.dirty.add(room.s.code); this.sendView(c, now); }
        return;
      }
      case 'stop': {
        const res = room.setStop(c.token ?? '', String(m.requestId), m.code as StockCode, m.stop === null ? null : Number(m.stop), m.take === null ? null : Number(m.take), now);
        this.send(c, { t: 'ack', requestId: m.requestId, ok: res.ok, reason: res.reason });
        if (res.ok && !res.duplicate) { this.dirty.add(room.s.code); this.sendView(c, now); }
        return;
      }
      case 'card': if (room.answerCard(c.token ?? '', m.choice, now)) { this.dirty.add(room.s.code); this.sendView(c, now); } return;
      case 'predict': if (room.predict(c.token ?? '', m.choice, m.confidence, now)) { this.dirty.add(room.s.code); this.sendView(c, now); } return;
      case 'skip':
        /* 운영자(대형 화면 열쇠)만. 발표·학술제에서 설명이 끝났는데 남은 초를 기다리지 않게 합니다 */
        if (c.role !== 'operator') return this.send(c, { t: 'error', reason: '운영자만 단계를 넘길 수 있습니다' });
        if (!room.skipPhase(now)) return this.send(c, { t: 'error', reason: '지금은 넘길 단계가 없습니다' });
        return;
      case 'done':
        /* 방 전체에 "3/5명 준비"가 보이도록 모아서 보냅니다. 모두 눌렀으면 다음 타이머에서 넘어갑니다 */
        if (room.markDone(c.token, now)) { this.dirty.add(room.s.code); this.sendView(c, now); this.later.add(room); }
        return;
      case 'rematch': {
        if (room.s.status !== 'finished') return;
        /* 운영자 방은 운영자만, 그 밖의 방은 참가자 누구나 다음 판을 엽니다. */
        if (room.operated ? c.role !== 'operator' : !room.player(c.token)) return;
        if (!room.s.nextRoomCode) {
          const next = this.createRoom(room.s.mode, { excludedArcs: room.s.plan.arcIds, settings: room.s.settings });
          /* 운영자는 같은 열쇠로 다음 판도 진행합니다(기기에 저장한 열쇠를 그대로 씀). */
          if (room.operated) next.s.operatorToken = room.s.operatorToken;
          room.s.nextRoomCode = next.s.code;
          this.dirty.add(room.s.code);
        }
        this.broadcast(room);
        return;
      }
      case 'rename': {
        const res = room.rename(c.token ?? '', String(m.label ?? ''), now);
        if (!res.ok) { this.send(c, { t: 'error', reason: res.reason ?? '이름을 바꾸지 못했습니다' }); return; }
        this.dirty.add(room.s.code);
        /* 입장과 같이: 바꾼 사람에게는 바로, 나머지에게는 타이머(0.1초)에서 한 번에 모아 보냅니다 */
        this.sendView(c, now);
        this.later.add(room);
        return;
      }
      case 'leave':
        if (c.token) { room.leave(c.token, now); }
        c.room = null; c.token = null;
        this.dirty.add(room.s.code);
        this.broadcast(room);
        return;
    }
  }

  /* ---------- HTTP ---------- */
  private http(req: http.IncomingMessage, res: http.ServerResponse) {
    let url: URL;
    try { url = new URL(req.url ?? '/', 'http://x'); }
    catch { return this.json(res, 400, { error: '잘못된 주소입니다' }); }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (url.pathname === '/api/health') return this.json(res, 200, this.health());
    /* PC에서 localhost로 열었을 때 QR에 넣을 와이파이 주소. 같은 PC에서 온 요청에만 알려 줍니다. */
    if (url.pathname === '/api/lan') return isLoopback(req.socket.remoteAddress) && !req.headers['x-forwarded-for'] ? this.json(res, 200, { addrs: lanAddresses() }) : this.json(res, 404, { error: '없음' });
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      let body = '';
      req.on('data', d => { body += d; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let mode: GameMode = 'friend';
        const extra: Parameters<Hub['createRoom']>[1] = {};
        try {
          const p = JSON.parse(body || '{}');
          if (typeof p.mode === 'string' && Object.hasOwn(MODES, p.mode)) mode = p.mode;
          if (p.settings !== undefined) {
            const settings: unknown = p.settings;
            const okSetting = ([key, value]: [string, unknown]) => key === 'level'
              ? isLevel(value)
              : key === 'pace'
                ? isPace(value)
              /* 대형 속보: 'off'(튜토리얼 판)·'always'(학술제 발표용)만 받습니다 */
              : key === 'bigBreaking'
                ? value === 'off' || value === 'always'
              /* 정원은 친구 대전에만 있습니다. 혼자 연습에 보내면 거절합니다(화면에서도 감춤) */
              : key === 'maxPlayers' && mode !== 'friend'
                ? false
                : Object.hasOwn(ROOM_OPTIONS, key) && typeof value === 'number'
                  && ROOM_OPTIONS[key as 'stocks' | 'rounds' | 'trade' | 'maxPlayers'].includes(value);
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)
              || !Object.entries(settings).every(okSetting)) {
              return this.json(res, 400, { error: '선택할 수 없는 게임 설정입니다' });
            }
            extra.settings = settings as RoomSettings;
          }
          /* 최근에 본 사건은 뒤로 미룹니다(아예 막는 것이 아니라 순서상 뒤로. plan.ts 참고) */
          if (Array.isArray(p.recentArcs)) {
            const recent = p.recentArcs.filter((x: unknown): x is string => typeof x === 'string').slice(0, RECENT_ARCS_MAX);
            if (recent.length > 0) extra.excludedArcs = recent;
          }
          /* 운영자 방(학술제): 친구 대전에만 붙입니다. 열쇠는 만든 기기에만 한 번 돌려줍니다. */
          if (p.operated === true) {
            if (mode !== 'friend') return this.json(res, 400, { error: '운영자 방은 친구 대전에서만 만들 수 있습니다' });
            extra.operated = true;
          }
          if (this.opts.allowTestHooks) Object.assign(extra, { seed: p.seed, forced: p.forced, forcedArcs: p.forcedArcs });
        } catch { return this.json(res, 400, { error: '잘못된 요청입니다' }); }
        if (!this.allowCreate(req)) return this.json(res, 429, { error: '방을 너무 많이 만들었습니다. 잠시 후 다시 시도해 주세요' });
        const room = this.createRoom(mode, extra);
        this.json(res, 201, room.operated ? { code: room.s.code, mode, operatorToken: room.s.operatorToken } : { code: room.s.code, mode });
      });
      return;
    }
    const m = url.pathname.match(/^\/api\/rooms\/(\d{6})$/);
    if (m) {
      const room = this.rooms.get(m[1]);
      if (!room) return this.json(res, 404, { error: '방을 찾을 수 없습니다' });
      return this.json(res, 200, { code: room.s.code, mode: room.s.mode, status: room.s.status, humans: room.humans.length, maxPlayers: room.config.maxPlayers });
    }
    if (url.pathname.startsWith('/api/')) return this.json(res, 404, { error: '없는 주소입니다' });
    this.serveStatic(url.pathname, res);
  }
  /** 서버 전체 방 수와 주소별 생성 속도를 제한합니다. */
  private allowCreate(req: http.IncomingMessage) {
    if (this.rooms.size >= MAX_ROOMS) return false;
    const fwd = this.opts.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
    const ip = fwd || req.socket.remoteAddress || '?', t = Date.now();
    const recent = (this.createLog.get(ip) ?? []).filter(x => t - x < 60_000);
    if (recent.length >= ROOMS_PER_IP_PER_MIN) { this.createLog.set(ip, recent); return false; }
    recent.push(t);
    this.createLog.set(ip, recent);
    if (this.createLog.size > 5000) this.createLog.clear();
    return true;
  }
  private json(res: http.ServerResponse, code: number, body: object) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
  private serveStatic(p: string, res: http.ServerResponse) {
    const root = this.opts.staticDir;
    if (!root || !existsSync(root)) { res.writeHead(404); res.end('클라이언트를 먼저 빌드하세요: npm run build'); return; }
    /* 잘못된 % 인코딩은 decodeURIComponent가 예외를 던져 서버 전체가 죽습니다. 400으로 끝냅니다. */
    let decoded: string;
    try { decoded = decodeURIComponent(p); } catch { res.writeHead(400); res.end('잘못된 주소입니다'); return; }
    const safe = path.normalize(decoded).replace(/^([.\\/])+/, '');
    let file = path.join(root, safe);
    if (!file.startsWith(path.resolve(root)) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(root, 'index.html');
    if (file.endsWith('.html')) {
      const html = readFileSync(file, 'utf8').replaceAll('%PUBLIC_URL%', PUBLIC_URL);
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
    createReadStream(file).pipe(res);
  }
}

/** 요청이 같은 컴퓨터에서 왔는지 */
export function isLoopback(addr: string | undefined) {
  return !!addr && (addr === '::1' || addr.startsWith('127.') || addr.startsWith('::ffff:127.'));
}
/** 이 컴퓨터의 사설망 IPv4 주소(와이파이·유선). 공유기 안의 주소(192.168·10·172.16~31)를 앞에 둡니다. */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) {
    if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  const priv = (ip: string) => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  return out.sort((a, b) => Number(priv(b)) - Number(priv(a)));
}
