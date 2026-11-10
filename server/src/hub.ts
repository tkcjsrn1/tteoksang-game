import os from 'node:os';
/* 방 목록, WebSocket 연결, 타이머를 묶는 서버 본체. HTTP 서버와 분리해 통합 테스트에서 그대로 띄웁니다. */
import { randomInt } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { MODES, ROOM_OPTIONS } from '../../shared/rules';
import type { ClientMsg, GameMode, Role, RoomSettings, ServerMsg, StockCode } from '../../shared/types';
import type { ForcedOutcomes } from './plan';
import { GameRoom } from './room';
import { MemoryStore, type Store } from './store';

interface Conn { ws: WebSocket; room: GameRoom | null; token: string | null; role: Role; operator: boolean; alive: boolean; windowStart: number; msgCount: number }
export interface HubOptions { store?: Store; staticDir?: string; port?: number; allowTestHooks?: boolean; speed?: number; now?: () => number;
  /** 리버스 프록시 뒤에서 X-Forwarded-For의 첫 주소를 접속 주소로 씁니다. 프록시가 없을 때 켜면 주소를 속일 수 있습니다. */
  trustProxy?: boolean }

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
/* 남용 방지. 게임 시계가 아니라 실제 시간(Date.now)으로 셉니다. */
export const MSG_LIMIT_PER_SEC = 30;       // 연결 하나가 1초에 보낼 수 있는 메시지 수
export const MAX_ROOMS = 1000;             // 서버 전체 방 수 상한
export const ROOMS_PER_IP_PER_MIN = 20;    // 같은 주소에서 1분에 만들 수 있는 방 수

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
    for (const s of await this.store.loadActive()) this.rooms.set(s.code, new GameRoom(s));
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
  createRoom(mode: GameMode, opts: { seed?: number; excludedArcs?: string[]; forced?: ForcedOutcomes; forcedArcs?: string[]; settings?: RoomSettings } = {}) {
    const room = GameRoom.create({ code: this.newCode(), mode, now: this.now(), ...opts });
    this.rooms.set(room.s.code, room);
    this.dirty.add(room.s.code);
    return room;
  }

  /* ---------- 타이머 ---------- */
  private loop() {
    const now = this.now();
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
    const msg = JSON.stringify({ t: 'tick', round: room.s.round, k: l.k, prices } satisfies ServerMsg);
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
    if (c.operator) view.operatorToken = c.room.s.operatorToken ?? undefined;
    this.send(c, { t: 'view', view });
  }
  private onConnection(ws: WebSocket) {
    const c: Conn = { ws, room: null, token: null, role: 'spectator', operator: false, alive: true, windowStart: Date.now(), msgCount: 0 };
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
        if (!stillOn) { c.room.disconnect(c.token, this.now()); this.broadcast(c.room); }
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
      c.room = room;
      c.operator = !!m.operatorToken && m.operatorToken === room.s.operatorToken;
      if (c.operator || m.display) {
        c.role = c.operator ? 'operator' : 'display'; c.token = null;
        this.send(c, { t: 'welcome', token: null, role: c.role, label: null, code: room.s.code });
        this.broadcast(room);
        return;
      }
      const j = room.join(m.token, now);
      c.token = j.token; c.role = j.role;
      this.send(c, { t: 'welcome', token: j.token, role: j.role, label: j.label, code: room.s.code });
      /* 혼자 연습은 입장 즉시 시작합니다. */
      if (room.s.mode === 'solo' && room.s.status === 'lobby') room.start(now);
      this.dirty.add(room.s.code);
      this.broadcast(room);
      return;
    }
    const room = c.room;
    if (!room) return this.send(c, { t: 'error', reason: '먼저 방에 들어와 주세요' });
    switch (m.t) {
      case 'start':
        if (!room.canStart(c.token, c.operator ? room.s.operatorToken : null)) return this.send(c, { t: 'error', reason: '지금은 시작할 수 없습니다' });
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
      case 'predict': if (room.predict(c.token ?? '', m.choice, Number(m.confidence), now)) { this.dirty.add(room.s.code); this.sendView(c, now); } return;
      case 'rematch': {
        if (room.s.status !== 'finished' || !(room.player(c.token) || c.operator)) return;
        if (!room.s.nextRoomCode) {
          const next = this.createRoom(room.s.mode, { excludedArcs: room.s.plan.arcIds, settings: room.s.settings });
          next.s.operatorToken = room.s.operatorToken;   /* 학술제 운영자는 같은 권한으로 다음 판을 엽니다. */
          room.s.nextRoomCode = next.s.code;
          this.dirty.add(room.s.code);
        }
        this.broadcast(room);
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
            if (mode === 'academic' || !settings || typeof settings !== 'object' || Array.isArray(settings)
              || Object.entries(settings).some(([key, value]) => !Object.hasOwn(ROOM_OPTIONS, key)
                || typeof value !== 'number' || !ROOM_OPTIONS[key as keyof RoomSettings].includes(value))) {
              return this.json(res, 400, { error: '선택할 수 없는 게임 설정입니다' });
            }
            extra.settings = settings as RoomSettings;
          }
          if (this.opts.allowTestHooks) Object.assign(extra, { seed: p.seed, forced: p.forced, forcedArcs: p.forcedArcs });
        } catch { return this.json(res, 400, { error: '잘못된 요청입니다' }); }
        if (!this.allowCreate(req)) return this.json(res, 429, { error: '방을 너무 많이 만들었습니다. 잠시 후 다시 시도해 주세요' });
        const room = this.createRoom(mode, extra);
        this.json(res, 201, { code: room.s.code, mode, operatorToken: room.s.operatorToken });
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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=3600' });
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
