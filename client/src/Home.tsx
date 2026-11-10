import { useState } from 'react';
import { navigate } from './App';
import { createRoom, roomInfo, store } from './net';
import { TERMS } from '../../shared/glossary';
import { cleanSettings, MODES, ROOM_OPTIONS, STOCKS_PER_GAME } from '../../shared/rules';
import type { RoomSettings } from '../../shared/types';
import { useGlossary } from './glossary/GlossaryContext';
import { parseRecords, RECORDS_KEY } from './recordStore';
import { Chevron, Disclaimer, Logo } from './ui';
import { needsOnboarding, Onboarding } from './Onboarding';
import { SettingsButton } from './Settings';

/** 날짜마다 바뀌는 오늘의 용어. 같은 날에는 누구에게나 같은 용어가 나옵니다. */
function todayTerm() {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return TERMS[day % TERMS.length];
}

export function Home() {
  const [joining, setJoining] = useState(false);
  const [howTo, setHowTo] = useState(needsOnboarding);
  const [tutorial, setTutorial] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* 게임 설정은 고른 값을 이 기기에 기억합니다. 처음에는 기본값(10종목·5라운드·90초) */
  const [settings, setSettings] = useState<RoomSettings>(() => cleanSettings(store.get('settings')));
  const { open, seen } = useGlossary();
  const games = parseRecords(store.get(RECORDS_KEY)).length;
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요'); } finally { setBusy(false); }
  };
  const make = (mode: 'friend' | 'solo') => run(async () => { const r = await createRoom(mode, settings); navigate(`/room/${r.code}`); });
  const stocks = settings.stocks ?? STOCKS_PER_GAME, rounds = settings.rounds ?? MODES.solo.rounds, trade = settings.trade ?? MODES.solo.trade;
  const minutes = Math.max(1, Math.round(rounds * (MODES.solo.news + trade + MODES.solo.recap) / 60));
  const pick = (o: RoomSettings) => { const next = { ...settings, ...o }; setSettings(next); store.set('settings', JSON.stringify(next)); };
  const join = () => run(async () => { await roomInfo(code); navigate(`/room/${code}`); });
  /* 튜토리얼: 게임 방법 카드를 처음부터 보여 주고, 혼자 연습 첫 라운드에 단계 안내를 다시 켭니다. */
  const startTutorial = () => { store.del('tutorial'); setTutorial(true); setHowTo(true); };
  const t = todayTerm();
  const links = [
    { to: '/glossary', mark: '가', cls: 'blue', title: '용어 사전', sub: `${TERMS.length}개 · 퀴즈로 복습`, badge: `${seen.size}/${TERMS.length}` },
    { to: '/lessons', mark: '봉', cls: 'red', title: '차트 연습실', sub: '봉, 거래량, 뉴스와 주가', badge: '' },
    { to: '/records', mark: '기', cls: 'green', title: '내 기록', sub: '판별 수익률과 순위', badge: games ? `${games}판` : '' }
  ];
  return (
    <main className="home">
      <section className="sec" style={{ paddingTop: 28 }}>
        <div className="home-head">
          <Logo />
          <SettingsButton />
        </div>
        <h1 className="hero">같은 뉴스, 다른 판단.<br />누가 왜 이겼는지 바로 나와요</h1>
        <p className="lede">가상 기업과 가상 자금 1,000만 원으로 하는 주식 게임</p>
        <div className="home-actions">
          <details className="game-opts">
            <summary>게임 설정 · {stocks}종목 · {rounds}라운드 · 장 {trade}초 <small className="hint">(한 판 약 {minutes}분)</small></summary>
            <div className="room-settings" role="group" aria-label="혼자 연습과 친구 대전 설정">
              <label>종목 수
                <select value={stocks} onChange={e => pick({ stocks: Number(e.target.value) })}>
                  {ROOM_OPTIONS.stocks.map(n => <option key={n} value={n}>{n}개</option>)}
                </select>
              </label>
              <label>라운드 수
                <select value={rounds} onChange={e => pick({ rounds: Number(e.target.value) })}>
                  {ROOM_OPTIONS.rounds.map(n => <option key={n} value={n}>{n}회</option>)}
                </select>
              </label>
              <label>장 시간
                <select value={trade} onChange={e => pick({ trade: Number(e.target.value) })}>
                  {ROOM_OPTIONS.trade.map(n => <option key={n} value={n}>{n}초</option>)}
                </select>
              </label>
            </div>
            <p className="hint">혼자 연습과 친구 방 모두에 적용돼요. 친구 방은 만든 사람의 설정을 따릅니다. 처음이라면 10종목·5라운드를 권합니다.</p>
          </details>
          <button className="cta" disabled={busy} onClick={() => make('solo')}>혼자 연습 시작</button>
          <button className="ghost" disabled={busy} onClick={startTutorial}>처음이라면 · 튜토리얼로 시작</button>
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
      <Disclaimer />
      {howTo && <Onboarding onDone={() => { setHowTo(false); if (tutorial) { setTutorial(false); make('solo'); } }} />}
    </main>
  );
}
