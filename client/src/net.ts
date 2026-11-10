/* 서버 연결. 끊기면 자동 재접속하고, 앱이 백그라운드에서 돌아오면 바로 다시 연결합니다.
   이름이나 연락처는 저장하지 않습니다. 재접속 토큰만 이 브라우저나 앱에 남습니다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, FillInfo, GameMode, OrderKind, Role, RoomSettings, RoomView, ServerMsg, Side, StockCode } from '../../shared/types';
import { applyTick } from './live';

/* 앱은 VITE_SERVER_URL로 서버 주소를 받습니다. 웹은 페이지와 같은 서버를 씁니다. */
const BASE = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const wsUrl = () => {
  if (BASE) return BASE.replace(/^http/, 'ws') + '/ws';
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
};
/* 같은 PC에서 두 기기를 시험할 때 ?profile=b 로 토큰 저장소를 나눕니다. */
const profile = new URLSearchParams(location.search).get('profile') ?? '';
const key = (name: string) => `tteoksang:${profile}:${name}`;
export const store = {
  get(name: string) { try { return localStorage.getItem(key(name)); } catch { return null; } },
  set(name: string, v: string) { try { localStorage.setItem(key(name), v); } catch { /* 저장 불가 환경에서는 재접속 복구만 빠집니다 */ } },
  del(name: string) { try { localStorage.removeItem(key(name)); } catch { /* 무시 */ } }
};
export async function createRoom(mode: GameMode, settings?: RoomSettings) {
  const r = await fetch(`${BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode, settings }) });
  if (!r.ok) throw new Error('방을 만들지 못했습니다');
  return r.json() as Promise<{ code: string; operatorToken: string | null }>;
}
export async function roomInfo(code: string) {
  const r = await fetch(`${BASE}/api/rooms/${code}`);
  if (!r.ok) throw new Error('방을 찾을 수 없습니다. 코드를 확인해 주세요');
  return r.json() as Promise<{ code: string; status: string; mode: GameMode }>;
}
export const joinUrl = (code: string) => `${BASE || location.origin + location.pathname}#/room/${code}`;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
/** 초대 주소. PC에서 localhost로 열었다면 휴대폰이 들어올 수 있도록 PC의 와이파이 주소로 바꿉니다.
    note: 'lan'이면 같은 와이파이 안내, 'none'이면 휴대폰으로는 못 들어오는 주소라는 안내를 띄웁니다. */
export function useJoinUrl(code: string): { url: string; note: 'ok' | 'lan' | 'none' } {
  const local = !BASE && LOCAL_HOSTS.includes(location.hostname);
  const [state, setState] = useState<{ url: string; note: 'ok' | 'lan' | 'none' }>({ url: joinUrl(code), note: local ? 'none' : 'ok' });
  useEffect(() => {
    if (!local) { setState({ url: joinUrl(code), note: 'ok' }); return; }
    let alive = true;
    fetch('/api/lan').then(r => r.ok ? r.json() : { addrs: [] }).then((d: { addrs: string[] }) => {
      if (!alive) return;
      const ip = d.addrs[0];
      if (ip) setState({ url: `${location.protocol}//${ip}${location.port ? `:${location.port}` : ''}${location.pathname}#/room/${code}`, note: 'lan' });
      else setState({ url: joinUrl(code), note: 'none' });
    }).catch(() => { if (alive) setState({ url: joinUrl(code), note: 'none' }); });
    return () => { alive = false; };
  }, [code, local]);
  return state;
}
/** 초대 주소 아래에 붙이는 안내 문구 */
export const joinNote = (note: 'ok' | 'lan' | 'none') => note === 'lan'
  ? '휴대폰이 이 PC와 같은 와이파이에 있어야 들어올 수 있어요. 안 열리면 Windows 방화벽에서 Node.js의 "개인 네트워크" 접근을 허용해 주세요.'
  : note === 'none' ? '지금 주소(localhost)로는 다른 기기가 들어올 수 없어요. PC의 와이파이 주소나 배포된 주소로 열어 주세요.' : '';

export interface OrderOutcome { ok: boolean; reason?: string; fill?: FillInfo | null }
export function useRoom(code: string, opts: { display?: boolean; operatorToken?: string | null } = {}) {
  const [view, setView] = useState<RoomView | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, { msg: ClientMsg; resolve: (o: OrderOutcome) => void }>());

  useEffect(() => {
    let closed = false, retry = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const tokenKey = `room:${code}`;
    function connect() {
      if (closed) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0; setOnline(true);
        ws.send(JSON.stringify({ t: 'hello', code, token: opts.display || opts.operatorToken ? null : store.get(tokenKey), display: opts.display, operatorToken: opts.operatorToken } satisfies ClientMsg));
        /* 응답을 못 받은 주문은 같은 요청 ID로 다시 보냅니다. 서버가 중복을 걸러 줍니다. */
        pending.current.forEach(p => ws.send(JSON.stringify(p.msg)));
      };
      ws.onmessage = e => {
        const m = JSON.parse(e.data) as ServerMsg;
        if (m.t === 'welcome') { if (m.token) store.set(tokenKey, m.token); setRole(m.role); }
        else if (m.t === 'view') { setView(m.view); setOffset(m.view.serverNow - Date.now()); setError(null); }
        else if (m.t === 'ack') { const p = pending.current.get(m.requestId); if (p) { pending.current.delete(m.requestId); p.resolve({ ok: m.ok, reason: m.reason, fill: m.fill }); } }
        else if (m.t === 'tick') setView(v => applyTick(v, m));
        else if (m.t === 'error') setError(m.reason);
      };
      ws.onclose = () => {
        setOnline(false);
        if (closed) return;
        timer = setTimeout(connect, Math.min(4000, 400 * 2 ** retry++));
      };
      ws.onerror = () => ws.close();
    }
    connect();
    /* Android 앱이 백그라운드에서 돌아오면 끊어진 소켓을 바로 복구합니다. */
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) { clearTimeout(timer); retry = 0; connect(); }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    const ping = setInterval(() => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('{"t":"ping"}'); }, 20000);
    return () => {
      closed = true; clearTimeout(timer); clearInterval(ping);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      wsRef.current?.close();
    };
  }, [code, opts.display, opts.operatorToken]);

  const send = useCallback((m: ClientMsg) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(m)); }, []);
  const request = useCallback((msg: Extract<ClientMsg, { requestId: string }>) => new Promise<OrderOutcome>(resolve => {
    pending.current.set(msg.requestId, { msg, resolve });
    send(msg);
    setTimeout(() => { if (pending.current.delete(msg.requestId)) resolve({ ok: false, reason: '서버 응답이 늦습니다. 내 자산에서 체결 내역을 확인해 주세요' }); }, 6000);
  }), [send]);
  const placeOrder = useCallback((code: StockCode, side: Side, qty: number, kind: OrderKind = 'market', limit?: number) => request({ t: 'order', requestId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, code, side, qty, kind, limit }), [request]);
  const setStop = useCallback((code: StockCode, stop: number | null, take: number | null) => request({ t: 'stop', requestId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, code, stop, take }), [request]);
  const cancelOrder = useCallback((code: StockCode) => request({ t: 'cancel', requestId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, code }), [request]);
  return { view, role, online, error, offset, send, placeOrder, cancelOrder, setStop };
}
export function useSecondsLeft(endsAt: number | null | undefined, offset: number) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, []);
  if (!endsAt) return 0;
  return Math.max(0, (endsAt - (Date.now() + offset)) / 1000);
}
