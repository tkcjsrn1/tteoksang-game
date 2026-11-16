/* 학술제 대형 화면(강당 스크린, 1920×1080 기준).
   모두가 보는 화면이라 공개된 정보만 씁니다: 방 코드·QR·입장 인원, 라운드·남은 시간, 지금 뉴스(결과는 공개 뒤),
   움직임이 큰 종목, 상위 5명의 이름과 수익률. 개인 보유·현금·주문은 서버가 보내지도 않습니다(view의 portfolio가 null).
   운영자 열쇠가 이 기기에 있으면 시작·다음 판 버튼이 보이고, 없으면 읽기 전용입니다. */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { LEVEL_LABEL, MODES } from '../../shared/rules';
import type { LeaderRow, RoomView } from '../../shared/types';
import { navigate } from './App';
import { pickDisplayStocks } from './bigscreen';
import { displayUrl, joinNote, operatorKey, store, useJoinUrl, useRoom, useSecondsLeft } from './net';
import { arrow, dir, Disclaimer, formatCountdown, Logo, pct, pctBp } from './ui';
import { PredictionTrend } from './game/final';

const PHASE: Record<string, string> = { news: '뉴스 확인 · 주문은 장이 열리면', trade: '장중 거래', settling: '결과 집계 중', recap: '라운드 결과' };
const CLOCK: Record<string, string> = { news: '장 시작까지', trade: '장 마감까지', settling: '', recap: '다음 라운드까지' };

export function Display({ code }: { code: string }) {
  const [opKey] = useState(() => store.get(operatorKey(code)));
  const { view, offset, send, error, role } = useRoom(code, { operatorToken: opKey });
  const left = useSecondsLeft(view?.phaseEndsAt, offset);
  if (!view) return (
    <main className="display center">
      {error ? <><p className="error">{error}</p><button className="cta" onClick={() => navigate('/')}>처음으로</button></> : <p>대형 화면을 준비하는 중입니다</p>}
      <Disclaimer />
    </main>
  );
  const isOp = role === 'operator';
  if (view.status === 'lobby') return <DisplayLobby view={view} isOp={isOp} start={() => send({ t: 'start' })} error={error} />;
  const clock = view.phase === 'recap' && view.round >= view.totalRounds ? '최종 결과까지' : CLOCK[view.phase ?? 'news'];
  return (
    <main className="display">
      <header className="d-top">
        <Logo />
        {view.status === 'finished'
          ? <h1 className="d-phase">최종 결과</h1>
          : <span className="d-phase"><b className="num">R{view.round}</b><span className="d-of num">/{view.totalRounds}</span> {PHASE[view.phase ?? 'news']}</span>}
        <span className="d-people num">참가 {view.humanCount}명</span>
        {view.status !== 'finished' && view.phase !== 'settling' &&
          <span className="d-clock"><small>{clock}</small><b className="num" aria-live="off">{formatCountdown(Math.ceil(left))}</b></span>}
        {isOp && view.status === 'playing' && view.phase !== 'settling' &&
          <button className="ghost d-skip" onClick={() => send({ t: 'skip' })} title="남은 시간을 기다리지 않고 다음 단계로">다음 단계 ▶</button>}
      </header>
      {view.status === 'finished'
        ? <DisplayFinal view={view} isOp={isOp} rematch={() => send({ t: 'rematch' })} />
        : <div className="d-grid">
            <DisplayNews view={view} />
            <DisplayStocks view={view} />
            <DisplayRank rows={view.leaderboard} />
          </div>}
      {error && <p className="error" role="alert">{error}</p>}
      <Disclaimer />
    </main>
  );
}

function DisplayLobby({ view, isOp, start, error }: { view: RoomView; isOp: boolean; start: () => void; error: string | null }) {
  const [qr, setQr] = useState('');
  const { url, note } = useJoinUrl(view.code);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 640 }).then(setQr).catch(() => setQr('')); }, [url]);
  /* 대기실에서 탭을 닫은 사람은 자리를 내놓으므로(#15) 접속 중인 사람만 보여 줍니다 */
  const humans = view.leaderboard.filter(p => p.kind === 'human' && p.connected);
  const recent = humans.slice(-24).reverse();
  const cfg = MODES[view.mode];
  const ready = view.humanCount >= view.minToStart;
  return (
    <main className="display d-lobby">
      <section className="d-lobby-main">
        <Logo />
        <p className="d-kicker">학술제 대전 · 대기실</p>
        <h1 className="d-title">휴대폰 카메라로<br />QR을 찍어 들어오세요</h1>
        <p className="d-sub">또는 앱 첫 화면 <b>코드로 참가</b>에 입력</p>
        <p className="d-code num" aria-label={`방 코드 ${view.code.split('').join(' ')}`}>{view.code}</p>
        <p className="d-count"><b className="num">{view.humanCount}</b><span className="num"> / {view.maxPlayers}명</span> 입장 <small>+ NPC 3명</small></p>
        <p className="d-meta">{view.stocks.length}종목 · {view.totalRounds}라운드 · 장 {view.tradeSeconds ?? cfg.trade}초 · {LEVEL_LABEL[view.level]} · 가상 자금 1,000만 원</p>
        {view.humanCount >= view.maxPlayers && <p className="d-full">정원 {view.maxPlayers}명이 찼습니다. 지금부터 들어오는 사람은 관전만 할 수 있습니다.</p>}
        {recent.length > 0 && <ul className="d-joined" aria-label="방금 들어온 참가자">{recent.map(p => <li key={p.playerId}>{p.label}</li>)}</ul>}
        {isOp
          ? <div className="d-op">
              <button className="cta" disabled={!ready} onClick={start}>{ready ? `게임 시작 (${view.humanCount}명)` : '참가자를 기다리는 중'}</button>
              <p className="hint">운영자 권한은 이 기기에만 있습니다. 이 창을 닫거나 기기를 바꾸지 마세요.</p>
              <p className="hint">다른 기기에 화면만 띄우려면: <span className="num">{displayUrl(view.code)}</span></p>
            </div>
          : <p className="hint">운영자가 시작하면 자동으로 넘어갑니다.</p>}
        {note !== 'ok' && <p className="hint">{joinNote(note)}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      {qr ? <img className="d-qr" src={qr} alt={`입장 QR 코드. 방 코드 ${view.code}`} /> : <div className="d-qr" aria-hidden="true" />}
      <Disclaimer />
    </main>
  );
}

/** 지금 라운드 뉴스. 결과 시간에는 실제 결과와 기대 대비 차이를 크게 보여 줍니다 */
function DisplayNews({ view }: { view: RoomView }) {
  const now = view.news[view.news.length - 1];
  if (!now || now.round !== view.round) return <section className="d-news"><p className="d-wait">뉴스를 기다리는 중입니다</p></section>;
  return (
    <section className="d-news" aria-label="이번 라운드 뉴스">
      {now.cards.map(({ card, result }) => (
        <article key={card.stageId} className={card.breaking ? 'breaking' : ''}>
          <p className="d-tag">{card.breaking ? '속보' : '이번 뉴스'} · {card.arcTitle}</p>
          <h2>{card.headline}</h2>
          {result
            ? <dl><dt>시장 기대</dt><dd>{card.expectation}</dd><dt>실제 결과</dt><dd className="d-actual">{result.actual} <small>· {result.gap}</small></dd></dl>
            : <dl><dt>시장 기대</dt><dd>{card.expectation}</dd><dt>단서</dt><dd>{card.clue}</dd></dl>}
        </article>
      ))}
      {view.crowd && <Crowd crowd={view.crowd} first={now.cards.length > 1} />}
    </section>
  );
}

/** 결과 공개 뒤: 참가자가 결과 전에 어떻게 예측했는지(집계만, 누가 골랐는지는 없음) */
function Crowd({ crowd, first }: { crowd: NonNullable<RoomView['crowd']>; first: boolean }) {
  const total = crowd.up + crowd.down;
  const up = Math.round(crowd.up / total * 100);
  const right = crowd.beat ? up : 100 - up;
  return (
    <div className="d-crowd" role="group" aria-label="참가자 예측">
      <p className="d-tag">결과 공개 전 참가자 예측{first ? ' (첫 번째 뉴스)' : ''} · {total}명</p>
      <div className="d-crowd-bar"><span style={{ width: `${up}%` }}>기대보다 좋다 {up}%</span><span>기대보다 나쁘다 {100 - up}%</span></div>
      <p className="d-crowd-note">결과는 기대보다 <b>{crowd.beat ? '좋았습니다' : '나빴습니다'}</b> · {right}%가 맞혔어요</p>
    </div>
  );
}
function DisplayStocks({ view }: { view: RoomView }) {
  const rows = pickDisplayStocks(view);
  return (
    <section className="d-stocks" aria-label="종목 등락">
      <h2>{view.phase === 'trade' ? '실시간 시세 · 오늘 등락' : '종목 · 직전 등락'} <small>{view.stocks.length}종목 중 {rows.length}개</small></h2>
      <ol>{rows.map(({ stock: s, bp, news }) => (
        <li key={s.code}>
          <span className="d-name">{s.name}{news && <em>뉴스</em>}</span>
          <b className="num">{s.price.toLocaleString('ko-KR')}</b>
          <span className={`num d-chg ${bp === null ? 'flat' : dir(bp)}`}>{bp === null ? '—' : `${arrow(bp)} ${pctBp(bp)}`}</span>
        </li>
      ))}</ol>
    </section>
  );
}
/** 순위는 게임 화면과 같이 NPC를 포함합니다(NPC를 이기는 것도 목표). NPC 줄은 흐리게 표시합니다 */
function DisplayRank({ rows }: { rows: LeaderRow[] }) {
  return (
    <section className="d-rank" aria-label="상위 5명">
      <h2>상위 5명 <small>NPC 포함</small></h2>
      <ol>{rows.slice(0, 5).map(l => (
        <li key={l.playerId} className={l.kind === 'npc' ? 'npc' : ''}>
          <b className="num d-pos">{l.rank}</b>
          <span className="d-name">{l.label}</span>
          <span className={`num ${dir(l.returnPct)}`}>{pct(l.returnPct)}</span>
        </li>
      ))}</ol>
    </section>
  );
}
function DisplayFinal({ view, isOp, rematch }: { view: RoomView; isOp: boolean; rematch: () => void }) {
  const top = view.leaderboard.slice(0, 5);
  const humans = view.leaderboard.filter(l => l.kind === 'human');
  const beatNpc = humans.filter(h => view.leaderboard.filter(l => l.kind === 'npc').every(n => h.value > n.value)).length;
  return (
    <section className="d-final">
      <ol className="d-podium">{top.map(l => (
        <li key={l.playerId} className={[l.rank === 1 ? 'first' : '', l.kind === 'npc' ? 'npc' : ''].join(' ').trim()}>
          <b className="num d-pos">{l.rank}위</b>
          <span className="d-name">{l.label}</span>
          <span className={`num d-ret ${dir(l.returnPct)}`}>{pct(l.returnPct)}</span>
        </li>
      ))}</ol>
      <p className="d-meta">참가 {humans.length}명 중 <b className="num">{beatNpc}</b>명이 NPC 3명을 모두 앞섰습니다. 내 매매일지와 행동 리포트는 각자 휴대폰에서 확인하세요.</p>
      <PredictionTrend rows={view.predictionTrend} big />
      {isOp && <div className="d-op">
        {view.nextRoomCode
          ? <a className="cta" href={`#/display/${view.nextRoomCode}`} onClick={() => { const k = store.get(operatorKey(view.code)); if (k) store.set(operatorKey(view.nextRoomCode!), k); }}>다음 판 대형 화면 열기</a>
          : <button className="cta" onClick={rematch}>같은 설정으로 다음 판 열기</button>}
        <p className="hint">다음 판을 열면 참가자 휴대폰에 입장 버튼이 나타납니다.</p>
      </div>}
    </section>
  );
}
