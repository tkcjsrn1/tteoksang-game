/* 서버 연결. 끊기면 자동 재접속하고, 앱이 백그라운드에서 돌아오면 바로 다시 연결합니다.
   이름이나 연락처는 저장하지 않습니다. 재접속 토큰만 이 브라우저나 앱에 남습니다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, GameMode, Role, RoomView, ServerMsg, Side, StockCode } from '../../shared/types';

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
export async function createRoom(mode: GameMode) {
  const r = await fetch(`${BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ mode }) });
  if (!r.ok) throw new Error('방을 만들지 못했습니다');
  return r.json() as Promise<{ code: string; operatorToken: string | null }>;
}
export async function roomInfo(code: string) {
  const r = await fetch(`${BASE}/api/rooms/${code}`);
  if (!r.ok) throw new Error('방을 찾을 수 없습니다. 코드를 확인해 주세요');
  return r.json() as Promise<{ code: string; status: string; mode: GameMode }>;
}
export const joinUrl = (code: string) => `${BASE || location.origin + location.pathname}#/room/${code}`;

export interface OrderOutcome { ok: boolean; reason?: string }
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
        else if (m.t === 'ack') { const p = pending.current.get(m.requestId); if (p) { pending.current.delete(m.requestId); p.resolve({ ok: m.ok, reason: m.reason }); } }
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
    setTimeout(() => { if (pending.current.delete(msg.requestId)) resolve({ ok: false, reason: '서버 응답이 늦습니다. 내 자산에서 예약을 확인해 주세요' }); }, 6000);
  }), [send]);
  const placeOrder = useCallback((code: StockCode, side: Side, qty: number) => request({ t: 'order', requestId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, code, side, qty }), [request]);
  const cancelOrder = useCallback((code: StockCode) => request({ t: 'cancel', requestId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, code }), [request]);
  return { view, role, online, error, offset, send, placeOrder, cancelOrder };
}
export function useSecondsLeft(endsAt: number | null | undefined, offset: number) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, []);
  if (!endsAt) return 0;
  return Math.max(0, (endsAt - (Date.now() + offset)) / 1000);
}
