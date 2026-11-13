/* 저장소. DATABASE_URL이 있으면 PostgreSQL, 없으면 메모리를 씁니다. 메모리는 서버 재시작 시 사라집니다. */
import pg from 'pg';
import type { RoomState } from './room';

export interface Store {
  name: string;
  init(): Promise<void>;
  saveRoom(s: RoomState): Promise<void>;
  /** 라운드 정산 기록. 같은 라운드는 한 번만 기록합니다. */
  saveSettlement(code: string, round: number, s: RoomState): Promise<void>;
  recordOrder(code: string, playerId: string, requestId: string, payload: object): Promise<void>;
  /** 다시 켤 때 이어서 할 방만 불러옵니다. since(절대 시각, ms)보다 전에 멈춘 방은 건너뜁니다. */
  loadActive(since?: number): Promise<RoomState[]>;
  /** before(절대 시각, ms)보다 전에 멈춘 방 기록을 지웁니다. 지운 개수를 돌려줍니다. */
  sweep(before: number): Promise<number>;
  close(): Promise<void>;
}
export class MemoryStore implements Store {
  name = 'memory';
  rooms = new Map<string, RoomState>();
  async init() {}
  async saveRoom(s: RoomState) { this.rooms.set(s.code, JSON.parse(JSON.stringify(s))); }
  async saveSettlement() {}
  async recordOrder() {}
  async loadActive(since = -Infinity) {
    return [...this.rooms.values()].filter(s => s.status !== 'finished' && s.updatedAt >= since);
  }
  async sweep(before: number) {
    let n = 0;
    for (const [code, s] of this.rooms) if (s.updatedAt < before) { this.rooms.delete(code); n++; }
    return n;
  }
  async close() {}
}
const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY, mode TEXT NOT NULL, status TEXT NOT NULL, state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settlements (
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, round INT NOT NULL, prices JSONB NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (room_code, round));
CREATE TABLE IF NOT EXISTS order_events (
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, player_id TEXT NOT NULL, request_id TEXT NOT NULL,
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (room_code, player_id, request_id));
`;
export class PostgresStore implements Store {
  name = 'postgres';
  pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 10_000 });
    /* 유휴 연결이 끊기면 pg가 'error'를 냅니다. 듣는 쪽이 없으면 그 자리에서 서버가 통째로 내려갑니다.
       무료 요금제 데이터베이스는 가만히 두면 잠들면서 연결을 끊으므로 반드시 받아 둬야 합니다. */
    this.pool.on('error', e => console.error('DB 유휴 연결 오류(계속 진행합니다)', e instanceof Error ? e.message : e));
  }
  async init() { await this.pool.query(SCHEMA); }
  async saveRoom(s: RoomState) {
    await this.pool.query(
      `INSERT INTO rooms (code, mode, status, state) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET status=EXCLUDED.status, state=EXCLUDED.state, updated_at=now()`,
      [s.code, s.mode, s.status, JSON.stringify(s)]);
  }
  async saveSettlement(code: string, round: number, s: RoomState) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO rooms (code, mode, status, state) VALUES ($1,$2,$3,$4)
        ON CONFLICT (code) DO UPDATE SET status=EXCLUDED.status, state=EXCLUDED.state, updated_at=now()`, [s.code, s.mode, s.status, JSON.stringify(s)]);
      await c.query(`INSERT INTO settlements (room_code, round, prices) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [code, round, JSON.stringify(s.prices)]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async recordOrder(code: string, playerId: string, requestId: string, payload: object) {
    await this.pool.query(`INSERT INTO order_events (room_code, player_id, request_id, payload) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [code, playerId, requestId, JSON.stringify(payload)]);
  }
  async loadActive(since = -Infinity) {
    const r = Number.isFinite(since)
      ? await this.pool.query(`SELECT state FROM rooms WHERE status <> 'finished' AND updated_at > to_timestamp($1)`, [since / 1000])
      : await this.pool.query(`SELECT state FROM rooms WHERE status <> 'finished'`);
    return r.rows.map(x => x.state as RoomState);
  }
  /** 오래 손대지 않은 방을 지웁니다. 정산·주문 기록도 함께 지워집니다(ON DELETE CASCADE). */
  async sweep(before: number) {
    const r = await this.pool.query(`DELETE FROM rooms WHERE updated_at < to_timestamp($1)`, [before / 1000]);
    return r.rowCount ?? 0;
  }
  async close() { await this.pool.end(); }
}
export const createStore = (url = process.env.DATABASE_URL): Store => url ? new PostgresStore(url) : new MemoryStore();
