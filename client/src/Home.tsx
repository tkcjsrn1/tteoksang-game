import { useState } from 'react';
import { navigate } from './App';
import { createRoom, roomInfo, store } from './net';
import { TERMS } from '../../shared/glossary';
import { useGlossary } from './glossary/GlossaryContext';
import { parseRecords, RECORDS_KEY } from './recordStore';
import { Chevron, Disclaimer, Logo } from './ui';
import { needsOnboarding, Onboarding } from './Onboarding';

/** 날짜마다 바뀌는 오늘의 용어. 같은 날에는 누구에게나 같은 용어가 나옵니다. */
function todayTerm() {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return TERMS[day % TERMS.length];
}

export function Home() {
  const [joining, setJoining] = useState(false);
  const [howTo, setHowTo] = useState(needsOnboarding);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { open, seen } = useGlossary();
  const games = parseRecords(store.get(RECORDS_KEY)).length;
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
  const t = todayTerm();
  const links = [
    { to: '/glossary', mark: '가', cls: 'blue', title: '용어 사전', sub: `${TERMS.length}개 · 퀴즈로 복습`, badge: `${seen.size}/${TERMS.length}` },
    { to: '/lessons', mark: '봉', cls: 'red', title: '차트 연습실', sub: '봉, 거래량, 뉴스와 주가', badge: '' },
    { to: '/records', mark: '기', cls: 'green', title: '내 기록', sub: '판별 수익률과 순위', badge: games ? `${games}판` : '' }
  ];
  return (
    <main className="home">
      <section className="sec" style={{ paddingTop: 28 }}>
        <Logo />
        <h1 className="hero">같은 뉴스, 다른 판단.<br />누가 왜 이겼는지 바로 나와요</h1>
        <p className="lede">가상 기업과 가상 자금 1,000만 원으로 하는 주식 게임</p>
        <div className="home-actions">
          <button className="cta" disabled={busy} onClick={() => make('solo')}>혼자 연습 시작</button>
          <div className="btn-row">
            <button className="ghost" disabled={busy} onClick={() => make('friend')}>친구 방 만들기</button>
            <button className="ghost" disabled={busy} aria-expanded={joining} onClick={() => setJoining(!joining)}>코드로 참가</button>
          </div>
          {joining && <form className="sub-actions" onSubmit={e => { e.preventDefault(); if (code.length === 6) join(); }}>
            <label htmlFor="code" className="hint">친구에게 받은 6자리 방 코드</label>
            <input id="code" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            <button className="cta" disabled={busy || code.length !== 6}>입장하기</button>
          </form>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="sec today-term" aria-label="오늘의 용어">
        <p className="hint">오늘의 용어</p>
        <button className="plain" onClick={() => open(t.id)}>
          <span style={{ display: 'grid', gap: 2 }}><span className="t-name">{t.term}</span><span className="t-short">{t.short}</span></span>
          <Chevron />
        </button>
      </section>

      <section className="sec tight">
        <div className="nav-list">
          {links.map(l => (
            <button key={l.to} className="nav-row" onClick={() => navigate(l.to)}>
              <span className={`nav-icon ${l.cls}`} aria-hidden="true">{l.mark}</span>
              <span className="t"><b>{l.title}</b><small>{l.sub}</small></span>
              {l.badge && <span className="badge">{l.badge}</span>}
              <Chevron />
            </button>
          ))}
        </div>
      </section>

      <button className="link" style={{ alignSelf: 'center' }} onClick={() => setHowTo(true)}>게임 방법 다시 보기</button>
      <button className="link" style={{ alignSelf: 'center', marginTop: -10 }} disabled={busy} onClick={academic}>학술제 운영자: 대형 화면과 QR 열기</button>
      <Disclaimer />
      {howTo && <Onboarding onDone={() => setHowTo(false)} />}
    </main>
  );
}
