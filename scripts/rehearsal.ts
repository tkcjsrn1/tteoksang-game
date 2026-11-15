/* 배포한 서버에서 학술제 한 판을 가짜 참가자로 끝까지 돌려 봅니다.
   운영자 방을 만들고 참가자 N명을 붙여, 주문을 넣어 가며 마지막 라운드까지 진행합니다.
   사용법: npm run rehearsal -- https://tteoksang-game.onrender.com [인원=80] [라운드 3·5·8·10, 기본 3]
   주의: 80명 3라운드면 무료 서버 월 전송량(5GB) 중 약 100MB를 씁니다. 여러 번 돌리지 마세요.
   무료 서버가 잠들어 있으면 첫 요청에 1분 가까이 걸릴 수 있어 넉넉히 기다립니다. */
import WebSocket from 'ws';
import type { RoomView, ServerMsg } from '../shared/types';

const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const players = Math.max(1, Math.min(80, Number(process.argv[3] ?? 80)));
const rounds = [3, 5, 8, 10].includes(Number(process.argv[4])) ? Number(process.argv[4]) : 3;
const wsBase = base.replace(/^http/, 'ws');

interface Bot { ws: WebSocket; view: RoomView | null; errors: string[]; closed: boolean; lastTick: number; lastRound: number; gaps: number[]; bytes: number }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const until = async (f: () => boolean, what: string, ms: number) => {
  const t = Date.now();
  while (!f()) { if (Date.now() - t > ms) throw new Error(`${what} 기다리다 시간 초과(${Math.round(ms / 1000)}초)`); await sleep(100); }
};
function connect(code: string, extra: object = {}): Promise<Bot> {
  return new Promise((resolve, reject) => {
    const b: Bot = { ws: new WebSocket(`${wsBase}/ws`), view: null, errors: [], closed: false, lastTick: 0, lastRound: 0, gaps: [], bytes: 0 };
    const timer = setTimeout(() => reject(new Error('WebSocket 연결 시간 초과(20초)')), 20_000);
    b.ws.on('open', () => { clearTimeout(timer); b.ws.send(JSON.stringify({ t: 'hello', code, ...extra })); resolve(b); });
    b.ws.on('unexpected-response', (_q, r) => { clearTimeout(timer); reject(new Error(`WebSocket 거절: HTTP ${r.statusCode}`)); });
    b.ws.on('error', e => { clearTimeout(timer); b.errors.push(String(e)); reject(e); });
    b.ws.on('close', () => { b.closed = true; });
    b.ws.on('message', d => {
      b.bytes += (d as Buffer).length;
      const m = JSON.parse(d.toString()) as ServerMsg;
      if (m.t === 'view') b.view = m.view;
      if (m.t === 'error') b.errors.push(m.reason);
      /* 장중 시세는 1초마다 와야 합니다. 간격이 길어지면 서버가 밀리고 있다는 뜻입니다 */
      if (m.t === 'tick') { const now = Date.now(); if (b.lastRound === m.round && b.lastTick) b.gaps.push(now - b.lastTick); b.lastTick = now; b.lastRound = m.round; }
    });
  });
}

console.log(`리허설 대상: ${base} · 참가자 ${players}명 · ${rounds}라운드`);
const t0 = Date.now();
const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(90_000) }).then(r => r.json()) as { store: string; version?: string };
console.log(`  서버 깨움 ${Date.now() - t0}ms · 저장소 ${health.store} · 버전 ${health.version ?? '?'}`);
const r = await fetch(`${base}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'friend', operated: true, settings: { maxPlayers: 80, rounds, trade: 45 } }) });
if (!r.ok) throw new Error(`운영자 방 만들기 실패: HTTP ${r.status}`);
const { code, operatorToken } = await r.json() as { code: string; operatorToken: string };
console.log(`  운영자 방 ${code} (대형 화면: ${base}/#/display/${code})`);

const op = await connect(code, { operatorToken, display: true });
const bots: Bot[] = [];
const tJoin = Date.now();
/* 실제 강당처럼 몇 초에 걸쳐 들어옵니다(10명씩 0.5초 간격) */
for (let i = 0; i < players; i += 10) {
  bots.push(...await Promise.all(Array.from({ length: Math.min(10, players - i) }, () => connect(code))));
  await sleep(500);
}
await until(() => op.view?.humanCount === players, `대기실 ${players}명`, 30_000);
console.log(`  ✓ 입장 ${players}명 ${Date.now() - tJoin}ms`);

op.ws.send(JSON.stringify({ t: 'start' }));
await until(() => op.view?.status === 'playing', '게임 시작', 15_000);
console.log('  ✓ 게임 시작');

let sent = 0, acks = 0, latency = 0;
const pending = new Map<string, number>();
for (const b of bots) b.ws.on('message', d => {
  const m = JSON.parse(d.toString()) as ServerMsg;
  if (m.t === 'ack' && pending.has(m.requestId)) { acks++; latency += Date.now() - pending.get(m.requestId)!; pending.delete(m.requestId); }
});
/* 주문 시간마다 참가자의 절반이 3초에 한 번꼴로 1주씩 삽니다 */
const orders = setInterval(() => {
  for (const [i, b] of bots.entries()) {
    const v = b.view;
    if (v?.phase !== 'trade' || i % 2 || Math.random() > 0.33) continue;
    const s = v.stocks[Math.floor(Math.random() * v.stocks.length)];
    const requestId = `rh-${i}-${sent++}`;
    pending.set(requestId, Date.now());
    b.ws.send(JSON.stringify({ t: 'order', requestId, code: s.code, side: 'buy', qty: 1 }));
  }
}, 1000);
let lastRound = 0;
while (op.view?.status !== 'finished') {
  if (op.view && op.view.round !== lastRound) { lastRound = op.view.round; console.log(`  · ${lastRound}라운드`); }
  if (bots.filter(b => b.closed).length > players / 10) throw new Error('연결이 10% 넘게 끊겼습니다');
  await sleep(500);
}
clearInterval(orders);

const gaps = bots.flatMap(b => b.gaps).sort((a, b) => a - b);
const pct = (p: number) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] ?? 0;
const mb = (bots.reduce((a, b) => a + b.bytes, 0) + op.bytes) / 1048576;
const errors = [...op.errors, ...bots.flatMap(b => b.errors)];
const dropped = bots.filter(b => b.closed).length;
console.log(`  ✓ 판 종료 · 순위 ${op.view.leaderboard.length}줄 · ${Math.round((Date.now() - t0) / 1000)}초`);
console.log(`  주문 ${sent}건 · 응답 ${acks}건 · 평균 응답 ${acks ? Math.round(latency / acks) : 0}ms`);
console.log(`  1초 시세 간격 중앙값 ${pct(0.5)}ms · 95% ${pct(0.95)}ms · 최대 ${pct(1)}ms (1000ms 근처면 정상)`);
console.log(`  받은 데이터 ${mb.toFixed(0)}MB · 끊긴 연결 ${dropped} · 서버 오류 ${errors.length}`);
for (const b of [op, ...bots]) b.ws.close();
const bad = dropped > 0 || errors.length > 0 || pct(0.95) > 2000 || acks < sent * 0.95;
console.log(bad ? '결과: 확인 필요 — 위 숫자를 개발자에게 보내 주세요' : '결과: 통과');
process.exit(bad ? 1 : 0);
