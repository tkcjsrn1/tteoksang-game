/* 배포한 서버가 실제로 동작하는지 1분 안에 확인합니다. 화면, API, WebSocket, 두 사람 입장, 게임 시작까지 봅니다.
   사용법: npm run smoke -- https://내-서비스.onrender.com   (주소를 안 주면 http://localhost:8787)
   무료 서버가 잠들어 있으면 첫 요청에 1분 가까이 걸릴 수 있어 넉넉히 기다립니다. */
import WebSocket from 'ws';
import type { RoomView, ServerMsg } from '../shared/types';

const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws');
let failed = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => { failed++; console.log(`  ✗ ${msg}`); };
const step = async (name: string, f: () => Promise<void>) => {
  const t = Date.now();
  try { await f(); ok(`${name} (${Date.now() - t}ms)`); } catch (e) { bad(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
};
const fetchT = async (url: string, init?: RequestInit, ms = 90_000) => {
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...init, signal: ac.signal }); } finally { clearTimeout(timer); }
};

interface Client { ws: WebSocket; token: string | null; view: RoomView | null; errors: string[] }
function connect(code: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const c: Client = { ws: new WebSocket(`${wsBase}/ws`), token: null, view: null, errors: [] };
    const timer = setTimeout(() => reject(new Error('WebSocket 연결 시간 초과(15초)')), 15_000);
    c.ws.on('open', () => { clearTimeout(timer); c.ws.send(JSON.stringify({ t: 'hello', code })); resolve(c); });
    c.ws.on('unexpected-response', (_q, r) => { clearTimeout(timer); reject(new Error(`WebSocket 거절: HTTP ${r.statusCode}`)); });
    c.ws.on('error', e => { clearTimeout(timer); reject(e); });
    c.ws.on('message', d => {
      const m = JSON.parse(d.toString()) as ServerMsg;
      if (m.t === 'welcome') c.token = m.token;
      if (m.t === 'view') c.view = m.view;
      if (m.t === 'error') c.errors.push(m.reason);
    });
  });
}
const until = async (f: () => boolean, what: string, ms = 10_000) => {
  const t = Date.now();
  while (!f()) { if (Date.now() - t > ms) throw new Error(`${what} 기다리다 시간 초과`); await new Promise(r => setTimeout(r, 50)); }
};

console.log(`점검 대상: ${base}`);
let code = '';
const clients: Client[] = [];
await step('서버 상태(/api/health)', async () => {
  const r = await fetchT(`${base}/api/health`);
  const j = await r.json() as { ok: boolean; store: string };
  if (!r.ok || !j.ok) throw new Error(`HTTP ${r.status}`);
  console.log(`    저장소: ${j.store}${j.store === 'memory' ? ' (서버가 재시작되면 방이 사라집니다. DATABASE_URL을 확인하세요)' : ''}`);
});
await step('화면 파일(/)', async () => {
  const r = await fetchT(`${base}/`);
  const html = await r.text();
  if (!r.ok || !html.includes('<div id="root"')) throw new Error(`HTTP ${r.status}, 빌드된 화면이 아닙니다`);
});
await step('방 만들기(POST /api/rooms)', async () => {
  const r = await fetchT(`${base}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode: 'friend' }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  code = (await r.json() as { code: string }).code;
  if (!/^\d{6}$/.test(code)) throw new Error(`이상한 방 코드: ${code}`);
});
if (code) {
  await step('두 사람 WebSocket 입장', async () => {
    clients.push(await connect(code), await connect(code));
    await until(() => clients.every(c => c.token && c.view?.humanCount === 2), '두 사람 입장');
  });
  if (clients.length === 2) await step('게임 시작과 첫 뉴스 수신', async () => {
    clients[0].ws.send(JSON.stringify({ t: 'start' }));
    await until(() => clients.every(c => c.view?.status === 'playing' && c.view.phase === 'news'), '게임 시작');
    const v = clients[1].view!;
    if (v.stocks.length !== 60) throw new Error(`종목 ${v.stocks.length}개(60개여야 함)`);
    if (!v.news.length || !v.news[0].cards.length) throw new Error('뉴스가 없음');
    if (JSON.stringify(v).includes('outcomeId')) throw new Error('결말 정보가 화면 데이터에 섞여 있음');
    console.log(`    첫 뉴스: ${v.news[0].cards[0].card.headline}`);
  });
  for (const c of clients) { try { c.ws.send(JSON.stringify({ t: 'leave' })); c.ws.close(); } catch { /* 이미 닫힘 */ } }
  const errs = clients.flatMap(c => c.errors);
  if (errs.length) bad(`서버 오류 메시지: ${errs.join(', ')}`);
}
console.log(failed ? `결과: 실패 ${failed}건` : '결과: 통과. 휴대폰 두 대로 한 판 끝까지 해 보면 확인이 끝납니다.');
process.exit(failed ? 1 : 0);
