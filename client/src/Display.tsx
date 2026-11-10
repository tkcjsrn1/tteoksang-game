/* 학술제 대형 화면. 최신 뉴스, 종목 등락, 남은 시간, 상위 5명만 보여 줍니다. 개인 주문과 자산은 나오지 않습니다. */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { intradayBp } from './live';
import { joinNote, store, useJoinUrl, useRoom, useSecondsLeft } from './net';
import { arrow, dir, Disclaimer, pct, pctBp } from './ui';

export function Display({ code }: { code: string }) {
  const [operatorToken] = useState(() => store.get(`operator:${code}`));
  const opts = operatorToken ? { operatorToken } : { display: true };
  const { view, offset, send, error } = useRoom(code, opts);
  const [qr, setQr] = useState('');
  const { url, note } = useJoinUrl(code);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 420 }).then(setQr).catch(() => setQr('')); }, [url]);
  const left = useSecondsLeft(view?.phaseEndsAt, offset);
  if (!view) return <main className="center"><p>{error ?? '대형 화면을 준비하는 중입니다'}</p><Disclaimer /></main>;
  const isOp = view.you.role === 'operator';
  if (view.status === 'lobby') return (
    <main className="display lobby-screen">
      <div><p className="course">학술제 대전 · 대기실</p><h1 className="logo">떡상개론</h1>
        <p className="d-code num">{view.code}</p>
        <p className="d-count">입장 {view.humanCount}/{view.maxPlayers}명 + NPC 3명</p>
        {isOp && <button className="cta" disabled={view.humanCount < view.minToStart} onClick={() => send({ t: 'start' })}>{view.humanCount < view.minToStart ? '참가자를 기다리는 중' : '게임 시작'}</button>}
        {isOp && <p className="hint">이 화면을 대형 화면에 띄우세요. 운영자 권한은 이 기기에만 있습니다.</p>}
        {note !== 'ok' && <p className="hint">{joinNote(note)}</p>}
      </div>
      {qr && <img className="d-qr" src={qr} alt="입장 QR 코드" />}
      <Disclaimer />
    </main>
  );
  const news = view.news[view.news.length - 1];
  const top = view.leaderboard.slice(0, 5);
  return (
    <main className="display">
      <header className="d-top"><b className="num">R{String(view.round).padStart(2, '0')}/{view.totalRounds}</b>
        {view.status === 'finished' ? <span>최종 결과</span> : <><span>{view.phase === 'news' ? '뉴스 확인' : view.phase === 'trade' ? '주문 가능' : view.phase === 'settling' ? '시장 결과 집계 중' : '라운드 결과'}</span><b className="num d-timer">00:{String(Math.ceil(left)).padStart(2, '0')}</b></>}
      </header>
      <div className="d-grid">
        <section className="d-news">{news?.cards.map(c => <article key={c.card.stageId}>
          <h2>{c.card.headline}</h2>
          {c.result ? <><p className="d-actual">{c.result.actual}</p><p>{c.result.gap}</p></> : <><p>{c.card.expectation}</p><p className="hint">남은 변수: {c.card.remaining}</p></>}
        </article>)}</section>
        <section className="d-stocks">{view.stocks.map(s => <div key={s.code} className="d-stock"><span>{s.name}</span><b className="num">{s.price.toLocaleString('ko-KR')}</b>{(() => { const ch = view.phase === 'trade' && s.ticks ? intradayBp(s) : s.lastChangeBp; return <span className={`num ${ch === null ? 'flat' : dir(ch)}`}>{ch === null ? '—' : `${arrow(ch)} ${pctBp(ch)}`}</span>; })()}</div>)}</section>
        <section className="d-rank"><h2>상위 5명</h2><ol>{top.map(l => <li key={l.playerId}><b className="num">{l.rank}</b><span>{l.label}</span><span className={`num ${dir(l.returnPct)}`}>{pct(l.returnPct)}</span></li>)}</ol></section>
      </div>
      {view.status === 'finished' && isOp && <div className="final-actions">{view.nextRoomCode ? <a className="cta" href={`#/display/${view.nextRoomCode}`} onClick={() => store.set(`operator:${view.nextRoomCode}`, view.operatorToken ?? '')}>다음 판 대형 화면 열기</a> : <button className="cta" onClick={() => send({ t: 'rematch' })}>같은 멤버로 한 판 더</button>}</div>}
      <Disclaimer />
    </main>
  );
}
