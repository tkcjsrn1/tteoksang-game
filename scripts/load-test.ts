/* 친구 대전 방 8개 × 8명 = 64명 부하 검증. 실제 WebSocket 64개가 마감 직전에 동시에 주문하고, 같은 요청을 재전송하고, 마감 후 주문도 보냅니다. */
import WebSocket from 'ws';
import { Hub } from '../server/src/hub';
import { feeOf } from '../shared/rules';
import type { ServerMsg } from '../shared/types';

let clock = 1_000_000;
const ROOMS = Number(process.argv[2] ?? 8), PER_ROOM = 8, PLAYERS = ROOMS * PER_ROOM;
const hub = new Hub({ now: () => clock });
const port = await hub.listen(0);
const rooms = Array.from({ length: ROOMS }, () => hub.createRoom('friend'));
const room = rooms[0];
const roomOf = (i: number) => rooms[Math.floor(i / PER_ROOM)];

interface C { ws: WebSocket; token: string | null; acks: Map<string, { ok: boolean; at: number }>; ackTotal: number; views: number }
const open = async (): Promise<C> => {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  await new Promise(r => ws.once('open', r));
  const c: C = { ws, token: null, acks: new Map(), ackTotal: 0, views: 0 };
  ws.on('message', d => {
    const m = JSON.parse(d.toString()) as ServerMsg;
    if (m.t === 'welcome') c.token = m.token;
    if (m.t === 'view') c.views++;
    if (m.t === 'ack') { c.ackTotal++; if (!c.acks.has(m.requestId)) c.acks.set(m.requestId, { ok: m.ok, at: performance.now() }); }
  });
  return c;
};
const until = async (f: () => boolean, ms = 15000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 5)); } };

const clients: C[] = [];
for (let i = 0; i < PLAYERS; i++) { const c = await open(); c.ws.send(JSON.stringify({ t: 'hello', code: roomOf(i).s.code })); clients.push(c); }
await until(() => clients.every(c => c.token) && rooms.every(r => r.humans.length === PER_ROOM));
const overflow = await open(); overflow.ws.send(JSON.stringify({ t: 'hello', code: room.s.code }));
await until(() => !!overflow.token);
console.log(`방 ${ROOMS}개에 ${PLAYERS}명 입장, 한 방의 9번째는 ${room.player(overflow.token) ? '참가자' : '관전자'}`);

rooms.forEach(r => { r.start(clock); hub.broadcast(r); });
clock = room.s.phaseEndsAt! + 1;
await until(() => rooms.every(r => r.s.phase === 'trade'));
const end = room.s.phaseEndsAt!;
clock = end - 1;   // 마감 1ms 전

const codes = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06'] as const;
const t0 = performance.now();
clients.forEach((c, i) => {
  const msg = JSON.stringify({ t: 'order', requestId: `r-${i}`, code: codes[i % 6], side: 'buy', qty: 10 + i });
  c.ws.send(msg); c.ws.send(msg); c.ws.send(msg);   // 같은 요청 3번
});
await until(() => clients.every(c => c.ackTotal >= 3));
const latencies = clients.map(c => c.acks.get(`r-${clients.indexOf(c)}`)!.at - t0).sort((a, b) => a - b);
const okCount = clients.filter((c, i) => c.acks.get(`r-${i}`)!.ok).length;
console.log(`마감 직전 주문 ${okCount}/${PLAYERS} 접수, 응답 시간 중앙값 ${latencies[PLAYERS >> 1].toFixed(0)}ms, 최대 ${latencies[PLAYERS - 1].toFixed(0)}ms`);

clock = end;   // 마감 시각 정각
clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'order', requestId: `late-${i}`, code: 'G06', side: 'buy', qty: 1 })));
await until(() => clients.every((c, i) => c.acks.has(`late-${i}`)));
const lateAccepted = clients.filter((c, i) => c.acks.get(`late-${i}`)!.ok).length;
console.log(`마감 시각 주문 접수 ${lateAccepted}/${PLAYERS} (0이어야 함)`);

clock = end + 1;
await until(() => rooms.every(r => r.s.phase === 'recap'));
const round = room.s.round;
let bad = 0;
clients.forEach((c, i) => {
  const room = roomOf(i), p = room.player(c.token)!, f = p.fills.filter(x => x.round === round);
  /* 시장가는 받은 순간의 장중 시세로 체결됩니다(이 크기는 슬리피지 없음). 그 시세는 이번 라운드 경로의 한 값이어야 합니다. */
  const code = codes[i % 6], qty = 10 + i, price = f[0]?.price ?? 0, gross = price * qty;
  const onPath = room.s.live!.paths[code].includes(price);
  const expectedCash = 10_000_000 - gross - feeOf(gross);
  if (f.length !== 1 || f[0].qty !== qty || f[0].refPrice !== price || !onPath || p.cash !== expectedCash || p.holdings[code]?.qty !== qty) { bad++; console.log('불일치', p.label, f, p.cash, expectedCash); }
});
console.log(`체결 검증 불일치 ${bad}건, 정산 라운드 ${JSON.stringify(room.s.settled)}`);
const again = room.settle(round, clock);
console.log(`정산 재시도 결과: ${again ? '중복 실행됨(오류)' : '건너뜀'}`);
await until(() => clients.every(c => c.views > 0));

/* 전체 방 뷰 생성 비용 */
const t1 = performance.now();
for (let k = 0; k < 20; k++) rooms.forEach(r => hub.broadcast(r));
console.log(`${PLAYERS + 1}개 연결 전체 방송 1회 평균 ${((performance.now() - t1) / 20).toFixed(1)}ms`);
const pass = okCount === PLAYERS && lateAccepted === 0 && bad === 0 && !again && !room.player(overflow.token);
console.log(pass ? '결과: 통과' : '결과: 실패');
clients.forEach(c => c.ws.terminate()); overflow.ws.terminate();
await hub.close();
process.exit(pass ? 0 : 1);
