import { useState } from 'react';
import { navigate } from './App';
import { createRoom, roomInfo, store } from './net';
import { Disclaimer } from './ui';

export function Home() {
  const [panel, setPanel] = useState<'none' | 'solo' | 'join'>('none');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요'); } finally { setBusy(false); }
  };
  const make = (mode: 'friend' | 'solo') => run(async () => { const r = await createRoom(mode); navigate(`/room/${r.code}`); });
  const academic = () => run(async () => {
    const r = await createRoom('academic');
    store.set(`operator:${r.code}`, r.operatorToken ?? '');
    navigate(`/display/${r.code}`);
  });
  const join = () => run(async () => { await roomInfo(code); navigate(`/room/${code}`); });
  return (
    <main className="home">
      <p className="course">STK-101 · 친구와 듣는 시장 수업</p>
      <h1 className="logo">떡상개론</h1>
      <p className="lede">같은 속보를 보고 각자 판단하세요. 마감 때 결말이 공개되고, 누가 왜 앞질렀는지 바로 나옵니다.</p>
      <div className="home-actions">
        <button className="cta" disabled={busy} onClick={() => setPanel(panel === 'solo' ? 'none' : 'solo')}>혼자 연습</button>
        {panel === 'solo' && <div className="sub-actions">
          <button className="ghost" disabled={busy} onClick={() => make('solo')}>NPC와 바로 한 판</button>
          <button className="ghost" onClick={() => navigate('/lessons')}>차트 연습실</button>
        </div>}
        <button className="cta" disabled={busy} onClick={() => make('friend')}>친구 방 만들기</button>
        <button className="cta" disabled={busy} onClick={() => setPanel(panel === 'join' ? 'none' : 'join')}>코드로 참가</button>
        {panel === 'join' && <form className="sub-actions" onSubmit={e => { e.preventDefault(); if (code.length === 6) join(); }}>
          <label htmlFor="code">6자리 방 코드</label>
          <input id="code" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
          <button className="ghost" disabled={busy || code.length !== 6}>입장하기</button>
        </form>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="link" disabled={busy} onClick={academic}>학술제 운영자: 대형 화면과 QR 열기</button>
      <Disclaimer />
    </main>
  );
}
