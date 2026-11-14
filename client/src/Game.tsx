import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { LABEL_MAX, LEVEL_LABEL, LEVEL_NOTE, MODES, STOCKS } from '../../shared/rules';
import type { ClientMsg, NewsCard, RoomView, StockCode } from '../../shared/types';
import { navigate } from './App';
import { coachStep } from './coach';
import { buzz, fillTone, play, revealTone, setMusicScene } from './fx';
import { SettingsButton } from './Settings';
import { TermLink } from './glossary/GlossaryContext';
import { store, useRoom, useSecondsLeft, joinNote, useJoinUrl } from './net';
import { defaultOpenGroups } from './sectors';
import { dir, Disclaimer, formatCountdown, pct, pctBp, signedWon, StockAvatar, useToast, won } from './ui';
import { Coach, SectorBoard, StockRow, Sheet, TAB_ICON, type PlayProps, type Tab } from './game/parts';
import { BreakingPopup, Card, CurrentNews, DividendNotice, NewsLog, Recap, SchedulePanel, ViNotice } from './game/news';
import { StockSheet } from './game/order';
import { Finished } from './game/final';


export function Game({ code }: { code: string }) {
  const r = useRoom(code);
  const { view, error, online } = r;
  if (!view) return <main className="center">{error ? <><p className="error">{error}</p><button className="cta" onClick={() => navigate('/')}>처음으로</button></> : <p>방에 들어가는 중입니다</p>}<Disclaimer /></main>;
  if (view.status === 'lobby') return <Lobby view={view} send={r.send} error={error} />;
  if (view.status === 'finished') return <Finished view={view} send={r.send} />;
  return <Playing view={view} offset={r.offset} online={online} send={r.send} placeOrder={r.placeOrder} cancelOrder={r.cancelOrder} setStop={r.setStop} />;
}

function Lobby({ view, send, error }: { view: RoomView; send: (m: ClientMsg) => void; error: string | null }) {
  const [qr, setQr] = useState('');
  const { url, note } = useJoinUrl(view.code);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setQr).catch(() => setQr('')); }, [url]);
  const humans = view.leaderboard.filter(p => p.kind === 'human');
  const copy = () => navigator.clipboard?.writeText(url);
  const cfg = MODES[view.mode];
  const canStart = view.you.isHost && view.humanCount >= view.minToStart;
  return (
    <main className="lobby">
      <div className="lobby-head">
        <p className="course">{cfg.label} · 대기실</p>
        <button className="back-btn" aria-label="방 나가기" title="방 나가기"
          onClick={() => { send({ t: 'leave' }); store.del(`room:${view.code}`); navigate('/'); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          나가기
        </button>
      </div>
      <h1 className="code-big num">{view.code}</h1>
      <p className="lede">친구에게 코드나 링크를 보내 주세요. 이름은 바꿀 수 있고, 비워 두면 자동으로 드린 이름을 씁니다.</p>
      {qr && <img className="qr" src={qr} alt="입장 QR 코드" width="180" height="180" />}
      {note !== 'ok' && <p className="hint">{joinNote(note)}</p>}
      <button className="ghost" onClick={copy}>초대 링크 복사</button>
      <dl className="kv">
        <dt>내 이름</dt><dd>{view.you.role === 'player' ? <NameEditor view={view} send={send} /> : '관전 중'}</dd>
        <dt>시작 자금</dt><dd className="num">{won(view.startCash)}</dd>
        <dt>진행</dt><dd>{view.stocks.length}종목 · {view.totalRounds}라운드 · 뉴스 {cfg.news}초, 장 {view.tradeSeconds ?? cfg.trade}초, 결과 {cfg.recap}초</dd>
        <dt>난이도</dt><dd>{LEVEL_LABEL[view.level]} <small className="hint">· {LEVEL_NOTE[view.level]}</small></dd>
      </dl>
      <h2 className="h">입장 {view.humanCount}/{view.maxPlayers}명 + NPC 3명</h2>
      <ul className="people">{humans.map(p => <li key={p.playerId} className={p.connected ? '' : 'off'}>{p.label}{p.playerId === view.you.id ? ' (나)' : ''}{!p.connected ? ' · 접속 끊김' : ''}</li>)}</ul>
      {view.you.isHost
        ? <button className="cta" disabled={!canStart} onClick={() => send({ t: 'start' })}>{canStart ? '게임 시작' : `${view.minToStart}명이 모이면 시작할 수 있어요`}</button>
        : <p className="hint">방장이 시작하면 자동으로 넘어갑니다.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="rules">
        <li>시장가 주문은 현재 호가로 바로 체결됩니다. 지정가 주문은 가격 조건을 충족하면 체결됩니다.</li>
        <li>뉴스는 단서일 뿐입니다. 시장 기대와 실제 결과의 차이가 주가를 움직입니다.</li>
        <li>판을 끝내면 같은 멤버로 바로 다시 할 수 있습니다.</li>
      </ul>
      <Disclaimer />
    </main>
  );
}

/** 대기실에서 내 이름 바꾸기. 게임이 시작되면 바꿀 수 없습니다. */
function NameEditor({ view, send }: { view: RoomView; send: (m: ClientMsg) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(view.you.label ?? '');
  useEffect(() => { if (!editing) setText(view.you.label ?? ''); }, [view.you.label, editing]);
  if (!editing) return (
    <span className="name-row">
      <b>{view.you.label}</b>
      <button className="ghost small" onClick={() => setEditing(true)}>이름 바꾸기</button>
    </span>
  );
  const save = () => { const t = text.trim(); if (t && t !== view.you.label) send({ t: 'rename', label: t }); setEditing(false); };
  return (
    <form className="name-row" onSubmit={e => { e.preventDefault(); save(); }}>
      <input aria-label="내 이름" value={text} maxLength={LABEL_MAX} autoFocus
        onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }} />
      <button className="ghost small" type="submit">저장</button>
    </form>
  );
}
const PHASE_LABEL: Record<string, string> = { news: '뉴스 확인', trade: '장중 거래', settling: '결과 집계 중', recap: '라운드 결과' };
const CLOCK_LABEL: Record<string, string> = { news: '장 시작까지', trade: '장 마감', settling: '', recap: '다음 라운드' };
/* 마지막 라운드의 결과 시간에는 다음 라운드가 없습니다 */
const clockLabel = (phase: string | null, round: number, total: number) =>
  phase === 'recap' && round >= total ? '최종 결과까지' : CLOCK_LABEL[phase ?? 'news'];

function Playing({ view, offset, online, send, placeOrder, cancelOrder, setStop }: PlayProps) {
  const [tab, setTab] = useState<Tab>('market');
  const [detail, setDetail] = useState<StockCode | null>(null);
  const [help, setHelp] = useState(false);
  const [favorites, setFavorites] = useState<StockCode[]>(() => {
    try {
      const saved: unknown = JSON.parse(store.get('favorites') ?? '[]');
      return Array.isArray(saved) ? saved.filter((code): code is StockCode => STOCKS.some(s => s.code === code)) : [];
    } catch { return []; }
  });
  const toggleFavorite = (code: StockCode) => {
    const next = favorites.includes(code) ? favorites.filter(c => c !== code) : [...favorites, code];
    setFavorites(next);
    store.set('favorites', JSON.stringify(next));
  };
  const favoriteStocks = view.stocks.filter(s => favorites.includes(s.code));
  const toast = useToast();
  const left = useSecondsLeft(view.phaseEndsAt, offset);
  const isPlayer = view.you.role === 'player';
  const soon = view.phase === 'trade' && left <= 10;
  const seconds = Math.ceil(left);
  const [tutorialOff, setTutorialOff] = useState(() => store.get('tutorial') === '1');
  const [watching, setWatching] = useState(false);
  const coach = tutorialOff ? null : coachStep(view, detail, watching);
  const skipTutorial = () => { store.set('tutorial', '1'); setTutorialOff(true); };
  useEffect(() => { if (view.mode === 'solo' && view.round >= 2) store.set('tutorial', '1'); }, [view.mode, view.round]);
  useEffect(() => { if (view.phase === 'recap') setDetail(null); }, [view.phase]);
  /* 효과음: 주문 마감 5초 전부터 째깍, 결과 공개 때 오름·내림, 상·하한가가 나오면 도장 소리 */
  useEffect(() => { if (view.phase === 'trade' && seconds > 0 && seconds <= 5) play('tick'); }, [view.phase, seconds]);
  /* 장 시작·마감 종. 처음 들어왔을 때(새로 고침)는 울리지 않습니다 */
  const prevPhase = useRef(view.phase);
  useEffect(() => {
    const before = prevPhase.current; prevPhase.current = view.phase;
    if (before === view.phase) return;
    if (view.phase === 'trade') { play('open'); buzz('bell'); }
    else if (before === 'trade') { play('close'); buzz('bell'); }
  }, [view.phase]);
  /* 배경음: 장중에만. 마감 10초 전부터 빨라집니다 */
  useEffect(() => { setMusicScene(view.phase === 'trade', soon); }, [view.phase, soon]);
  useEffect(() => () => setMusicScene(false), []);
  /* 장중 속보가 뜨면 알림음 */
  const breakingCount = view.phase === 'trade' ? (view.news[view.news.length - 1]?.cards.filter(c => c.card.breaking).length ?? 0) : 0;
  const prevBreaking = useRef(breakingCount);
  const [breakingPop, setBreakingPop] = useState<NewsCard | null>(null);
  useEffect(() => {
    if (breakingCount > prevBreaking.current) {
      play('news'); buzz('news');
      const card = view.news[view.news.length - 1]?.cards.filter(c => c.card.breaking).at(-1)?.card ?? null;
      setBreakingPop(card);
    }
    prevBreaking.current = breakingCount;
  }, [breakingCount]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 속보 창은 5초 뒤 저절로 닫힙니다. 주문 시간을 너무 잡아먹지 않게 */
  useEffect(() => {
    if (!breakingPop) return;
    const t = setTimeout(() => setBreakingPop(null), 5000);
    /* 화면 아무 곳이나 건드리면 바로 닫습니다. 주문하려는데 알림이 가리고 있으면 안 되니까요. */
    const close = () => setBreakingPop(null);
    document.addEventListener('pointerdown', close);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', close); };
  }, [breakingPop]);
  useEffect(() => { if (view.phase !== 'trade') setBreakingPop(null); }, [view.phase]);
  /* 체결 소리와 진동: 바로 체결, 지정가 체결, 손절·익절 자동 매도 모두 체결 기록이 늘어날 때 울립니다 */
  const fillCount = view.portfolio?.fillLog.length ?? 0;
  const prevFills = useRef(fillCount);
  useEffect(() => {
    const f = view.portfolio?.fillLog[fillCount - 1];
    if (f && fillCount > prevFills.current) { play(fillTone(f.side, f.trigger)); buzz(f.trigger ? 'trigger' : 'fill'); }
    prevFills.current = fillCount;
  }, [fillCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const revealKey = view.phase === 'recap' ? `${view.round}` : '';
  useEffect(() => {
    if (!revealKey) return;
    window.scrollTo({ top: 0 });
    play(revealTone(view.lastResult?.delta ?? 0));
    const hit = view.stocks.some(s => s.history[s.history.length - 1]?.round === view.round && s.history[s.history.length - 1]?.limit);
    if (hit) { const t = setTimeout(() => play('stamp'), 700); return () => clearTimeout(t); }
  }, [revealKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 손절·익절이 발동하면 알려 줍니다 */
  const triggered = view.portfolio?.fillLog.filter(f => f.trigger) ?? [];
  const lastTrig = triggered[triggered.length - 1];
  const trigKey = `${triggered.length}`;
  useEffect(() => {
    if (!lastTrig || triggered.length === 0) return;
    const name = view.stocks.find(s => s.code === lastTrig.code)?.name ?? '';
    toast.show(`${lastTrig.trigger === 'stop' ? '손절' : '익절'} 자동 매도 · ${name} ${lastTrig.qty.toLocaleString('ko-KR')}주 × ${won(lastTrig.price)}`);
  }, [trigKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stock = detail ? view.stocks.find(s => s.code === detail)! : null;
  const news = view.phase === 'news' || view.phase === 'trade'
    ? <CurrentNews view={view} onOpen={coach ? setDetail : undefined} />
    : null;
  return (
    <div className="game">
      <header className="topbar">
        {/* 화면에는 안 보이지만 읽어 주는 제목. 페이지마다 h1이 하나 있어야 합니다. */}
        <h1 className="sr-only">{view.mode === 'solo' ? '혼자 연습' : '친구 대전'} {view.round}라운드 · {PHASE_LABEL[view.phase ?? 'news']}</h1>
        <div className="status">
          <b>{PHASE_LABEL[view.phase ?? 'news']}</b>
          <span className="num" aria-label={`${view.round}라운드, 전체 ${view.totalRounds}라운드`}>{view.round}/{view.totalRounds}</span>
        </div>
        {view.phase !== 'settling' && <span className={`clock${soon ? ' soon' : ''}`} role="timer" aria-label={`${clockLabel(view.phase, view.round, view.totalRounds)} ${seconds}초`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
          {clockLabel(view.phase, view.round, view.totalRounds)} {formatCountdown(seconds)}
        </span>}
        <SettingsButton />
        <button className="help-btn" aria-label="도움말" onClick={() => setHelp(true)}>?</button>
        <div className="timer"><i style={{ width: `${view.phaseSeconds ? Math.min(100, left / view.phaseSeconds * 100) : 0}%` }} /></div>
      </header>
      {!online && <p className="offline" role="alert">연결이 끊겼습니다. 다시 연결하는 중입니다. 걸어 둔 지정가 예약은 그대로 유지됩니다.</p>}
      {!isPlayer && <p className="offline">관전 중입니다. 시작 후 처음 들어오면 관전자로 입장합니다.</p>}
      <main className="game-body">
        {coach && tab === 'market' && news}
        {coach && <Coach step={coach} onSkip={skipTutorial} />}
        {view.phase === 'recap' && <Recap view={view} onOpen={c => { setDetail(c); setTab('market'); }} />}
        {view.phase === 'settling' && <div className="panel"><p className="headline">시장 결과 집계 중</p><p className="hint">체결을 확인하고 있습니다. 잠시만 기다려 주세요.</p></div>}
        {tab === 'market' && view.phase !== 'recap' && <>
          <Standing view={view} />
          <MyHoldings view={view} onOpen={setDetail} />
          <ViNotice view={view} />
          <DividendNotice view={view} />
          <SchedulePanel view={view} />
          {!coach && news}
          {isPlayer && view.card && view.phase === 'trade' && <Card view={view} send={send} />}
          {favoriteStocks.length > 0 && <section className="panel flush" aria-label="관심종목">
            <div className="list-head"><span>★ 관심종목</span></div>
            <div className="board">{favoriteStocks.map(s => <StockRow key={s.code} s={s} view={view} onOpen={() => setDetail(s.code)} />)}</div>
          </section>}
          <div className="panel flush">
            <div className="list-head"><span><TermLink id="sector">업종</TermLink>별 종목 {view.stocks.length}개</span>{view.phase === 'trade' ? <span className="live-dot">실시간 시세 · 오늘 등락</span> : <span><TermLink id="reference-price">기준가</TermLink> · 직전 등락</span>}</div>
            <SectorBoard stocks={view.stocks} live={view.phase === 'trade'} defaultOpen={defaultOpenGroups(view)} pinned={coach?.no === 2 && coach.target ? [coach.target] : []}
              renderRow={s => <StockRow key={s.code} s={s} view={view} hint={coach?.no === 2 && coach.target === s.code} onOpen={() => setDetail(s.code)} />} />
          </div>
        </>}
        {tab === 'assets' && <Assets view={view} cancel={cancelOrder} toast={toast.show} />}
        {tab === 'news' && <NewsLog view={view} />}
      </main>
      <nav className="tabs">
        {(['market', 'assets', 'news'] as Tab[]).map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{TAB_ICON[t]}{t === 'market' ? '시장' : t === 'assets' ? '내 자산' : '뉴스'}</button>)}
      </nav>
      <footer className="foot"><Disclaimer /></footer>
      {stock && <StockSheet stock={stock} view={view} left={left} coach={coach} onClose={() => setDetail(null)}
        favorite={favorites.includes(stock.code)} onFavorite={() => toggleFavorite(stock.code)}
        onWatch={() => { setWatching(true); setDetail(null); }}
        place={placeOrder} cancel={cancelOrder} setStop={setStop} toast={toast.show} />}
      {help && <HelpSheet phase={view.phase} level={view.level} onClose={() => setHelp(false)} onReplayTutorial={view.mode === 'solo' ? () => { store.del('tutorial'); setTutorialOff(false); setWatching(false); setHelp(false); } : null} />}
      {breakingPop && <BreakingPopup view={view} card={breakingPop} onClose={() => setBreakingPop(null)}
        onOpen={c => { setBreakingPop(null); setTab('market'); setDetail(c); }} />}
      {toast.node}
    </div>
  );
}

function HelpSheet({ phase, level, onClose, onReplayTutorial }: { phase: RoomView['phase']; level: RoomView['level']; onClose: () => void; onReplayTutorial: (() => void) | null }) {
  return (
    <Sheet title="짧은 도움말" onClose={onClose}>
      <p className="hint">타이머는 멈추지 않고 계속 진행됩니다.</p>
      <p className="hint">소리·진동·다크 모드는 위쪽 톱니바퀴(설정)에서 바꿀 수 있어요.</p>
      <ul className="rules">
        {phase === 'news' && <li>지금은 뉴스 시간입니다. 곧 장이 열리고 시세가 움직이기 시작합니다.</li>}
        {phase === 'trade' && <li>장중입니다. 시세가 1초마다 움직이고, 중간에 속보가 뜰 수 있습니다. 종목을 눌러 사고팔 수 있습니다.</li>}
        {phase === 'recap' && <li>그래프의 봉을 누르면 가격이 움직인 이유가 나옵니다.</li>}
        {level === 'easy'
          ? <li><TermLink id="market-order">시장가</TermLink>로 지금 시세에 바로 <TermLink id="execution">체결</TermLink>됩니다. 한 번에 많이 사면 체결가가 조금 올라갈 수 있습니다.</li>
          : <li><TermLink id="market-order">시장가</TermLink>는 누르는 순간의 시세로 바로 <TermLink id="execution">체결</TermLink>됩니다. <TermLink id="order-book">호가창</TermLink>의 가장 좋은 가격부터 차례로 채우므로, 수량이 많으면 평균 체결가가 불리해집니다(<TermLink id="slippage">슬리피지</TermLink>).</li>}
        {level === 'pro' && <li><TermLink id="limit-order">지정가</TermLink>는 원하는 가격을 걸어 두는 예약입니다. 시세가 닿으면 그 가격에 체결되고, 라운드가 끝날 때까지 안 닿으면 자동 취소됩니다.</li>}
        <li>뉴스의 실제 결과는 장 마감 때 공개되고, 그때 주가가 크게 움직입니다.</li>
        <li>같은 <TermLink id="sector">업종</TermLink> 종목은 <TermLink id="leader-stock">대장주</TermLink> 뉴스에 함께 움직입니다.</li>
        <li><TermLink id="fee">수수료</TermLink>는 매수와 매도 모두 <TermLink id="turnover">거래대금</TermLink>의 0.10%이고, 팔 때는 <TermLink id="transaction-tax">증권거래세</TermLink> 0.20%가 더 붙습니다.</li>
        <li><TermLink id="sell">매도</TermLink> 대금은 바로 다시 쓸 수 있습니다(<TermLink id="settlement">결제일</TermLink>을 단순화).</li>
        <li>1<TermLink id="bp">bp</TermLink>는 0.01%입니다. 100bp가 1%입니다.</li>
        <li>밑줄 친 낱말을 누르면 뜻이 나옵니다.</li>
      </ul>
      <button className="ghost" onClick={() => { onClose(); navigate('/glossary'); }}>주식 용어 사전 열기</button>
      {onReplayTutorial && <button className="link" onClick={onReplayTutorial}>따라 하기 안내 다시 켜기(다음 혼자 연습 첫 라운드부터)</button>}
    </Sheet>
  );
}
/** 뉴스 카드. compact면 시장 기대와 단서만 보이고 나머지는 '자세히'에 접어 둡니다. */
function Standing({ view }: { view: RoomView }) {
  const me = view.leaderboard.find(l => l.playerId === view.you.id);
  if (!me) return <div className="panel"><ol className="mini-rank">{view.leaderboard.slice(0, 5).map(l => <li key={l.playerId}>{l.rank}위 {l.label} <span className={dir(l.returnPct)}>{pct(l.returnPct)}</span></li>)}</ol></div>;
  const value = view.portfolio?.value ?? me.value;
  const other = view.leaderboard.find(l => l.playerId !== me.playerId && (me.rank === 1 ? l.rank >= 1 : l.rank === 1));
  const gap = other ? value - other.value : 0;
  return (
    <div className="panel standing">
      <p className="wallet-label"><TermLink id="portfolio-value">내 평가액</TermLink> · {view.leaderboard.length}명 중 {me.rank}위</p>
      <p className="wallet-value">{won(value)}</p>
      <p className={`wallet-change ${dir(value - view.startCash)}`}>{signedWon(value - view.startCash)} ({pct(me.returnPct)})</p>
      <div className="stat-pair">
        <div className="stat"><small><TermLink id="cash">주문 가능</TermLink></small><b>{won(view.portfolio?.available ?? 0)}</b></div>
        <div className="stat"><small>{me.rank === 1 ? '2위보다' : '1위와 차이'}</small><b className={dir(gap)}>{signedWon(gap)}</b></div>
      </div>
    </div>
  );
}
/** 업종별로 묶은 종목 목록. 머리줄을 누르면 접고 펼칩니다. 접힌 업종은 종목 수와 평균 등락만 보여 줍니다.
    pinned 종목이 있는 업종(따라 하기 안내 대상)은 항상 펼칩니다. 머리줄은 버튼이라 안에 용어 링크를 넣지 않습니다. */
function MyHoldings({ view, onOpen }: { view: RoomView; onOpen: (c: StockCode) => void }) {
  const p = view.portfolio;
  if (!p || p.holdings.length === 0) return null;
  const pnl = p.holdings.reduce((a, h) => a + h.pnl, 0);
  const cost = p.holdings.reduce((a, h) => a + h.qty * h.avgCost, 0);
  return (
    <section className="panel flush mine" aria-label="내 보유 종목">
      <div className="list-head">
        <span>내 보유 종목 {p.holdings.length}개</span>
        <span className={dir(pnl)}><TermLink id="unrealized-pnl">평가손익</TermLink> {signedWon(pnl)}{cost ? ` (${pctBp(Math.round(pnl * 10000 / cost))})` : ''}</span>
      </div>
      <div className="board">{p.holdings.map(h => {
        const s = view.stocks.find(x => x.code === h.code);
        const stops = h.stop !== null || h.take !== null;
        return (
          <button key={h.code} className="row" onClick={() => onOpen(h.code)}>
            <StockAvatar code={h.code} name={h.name} />
            <span className="row-main">
              <b>{h.name}</b>
              <small>{h.qty.toLocaleString('ko-KR')}주 · <TermLink id="avg-cost">평균</TermLink> {won(h.avgCost)}{stops ? ' · 손절·익절 걸림' : ''}{s?.haltLeft ? ` · VI ${s.haltLeft}초` : ''}</small>
            </span>
            <span className="row-price">
              <b className="num">{won(h.price)}</b>
              <small className={`num ${dir(h.pnl)}`}>{signedWon(h.pnl)}</small>
            </span>
          </button>
        );
      })}</div>
      <p className="hint">종목을 누르면 바로 사고팔 수 있어요.</p>
    </section>
  );
}
function Assets({ view, cancel, toast }: { view: RoomView; cancel: PlayProps['cancelOrder']; toast: (m: string) => void }) {
  const p = view.portfolio;
  if (!p) return <div className="panel"><p className="hint">관전자는 개인 자산이 없습니다.</p></div>;
  return (
    <div className="panel">
      <h2 className="h">내 자산</h2>
      <dl className="kv">
        <dt><TermLink id="portfolio-value">평가액</TermLink></dt><dd className="num">{won(p.value)}</dd>
        <dt><TermLink id="return-rate">수익률</TermLink></dt><dd className={`num ${dir(p.returnPct)}`}>{pct(p.returnPct)}</dd>
        <dt><TermLink id="cash">보유 현금</TermLink></dt><dd className="num">{won(p.cash)}</dd>
        <dt><TermLink id="deposit-reserved">매수 예약금</TermLink></dt><dd className="num">{won(p.reserved)}</dd>
        <dt>낸 <TermLink id="fee">수수료</TermLink>·<TermLink id="transaction-tax">세금</TermLink></dt><dd className="num">{won(p.fees)}</dd>
      </dl>
      <h3 className="h small">보유 종목 <small className="hint">· 오른쪽 숫자는 <TermLink id="unrealized-pnl">평가손익</TermLink></small></h3>
      {p.holdings.length ? <ul className="list">{p.holdings.map(h => <li key={h.code}><span>{h.name}<small>{h.qty.toLocaleString('ko-KR')}주 · 평균 {won(h.avgCost)}</small></span><span className={dir(h.pnl)}>{signedWon(h.pnl)}</span></li>)}</ul> : <p className="hint">아직 보유 종목이 없습니다.</p>}
      {(view.level === 'pro' || p.orders.length > 0) && <h3 className="h small">걸어 둔 <TermLink id="limit-order">지정가</TermLink> 예약</h3>}
      {p.orders.length ? <ul className="list">{p.orders.map(o => <li key={o.code}><span>{view.stocks.find(s => s.code === o.code)!.name}<small>{o.side === 'buy' ? '매수' : '매도'} {o.qty.toLocaleString('ko-KR')}주 · 지정가 {won(o.price)}</small></span><button className="ghost small" disabled={view.phase !== 'trade'} onClick={async () => { const r = await cancel(o.code); toast(r.ok ? '예약을 취소했습니다' : r.reason ?? '취소하지 못했습니다'); }}>취소</button></li>)}</ul> : view.level === 'pro' ? <p className="hint">예약한 주문이 없습니다.</p> : null}
      {!!p.dividendLog?.length && <>
        <h3 className="h small">받은 <TermLink id="dividend">배당금</TermLink></h3>
        <ul className="list">{p.dividendLog.map((d, i) => <li key={i}><span>R{d.round} {view.stocks.find(s => s.code === d.code)!.name}<small>{d.qty.toLocaleString('ko-KR')}주 × {won(d.dps)}</small></span><span className="up">+{won(d.amount)}</span></li>)}</ul>
      </>}
      <h3 className="h small">체결 내역</h3>
      {p.fillLog.length ? <ul className="list">{p.fillLog.slice().reverse().map((f, i) => <li key={i}><span>R{f.round} {view.stocks.find(s => s.code === f.code)!.name}<small>{f.side === 'buy' ? '매수' : '매도'} {f.qty.toLocaleString('ko-KR')}주 · {won(f.price)} · 수수료 {won(f.fee)}</small></span></li>)}</ul> : <p className="hint">아직 체결된 주문이 없습니다.</p>}
    </div>
  );
}
