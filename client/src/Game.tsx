import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { feeOf, maxBuyQty, MODES } from '../../shared/rules';
import type { NewsCard, NewsResult, Order, RoomView, Side, StockCode, StockView } from '../../shared/types';
import { termById, termsIn } from '../../shared/glossary';
import { navigate } from './App';
import { coachStep, type CoachStep } from './coach';
import { addRecord, parseRecords, RECORDS_KEY } from './records';
import { Rich, TermLink, useGlossary } from './glossary/GlossaryContext';
import { joinUrl, store, useRoom, useSecondsLeft, type OrderOutcome } from './net';
import { arrow, BreakdownPanel, dir, Disclaimer, pct, pctBp, PriceChart, signedWon, useToast, won } from './ui';

type Tab = 'market' | 'assets' | 'news';

export function Game({ code }: { code: string }) {
  const r = useRoom(code);
  const { view, error, online } = r;
  if (!view) return <main className="center">{error ? <><p className="error">{error}</p><button className="cta" onClick={() => navigate('/')}>처음으로</button></> : <p>방에 들어가는 중입니다</p>}<Disclaimer /></main>;
  if (view.status === 'lobby') return <Lobby view={view} send={r.send} error={error} />;
  if (view.status === 'finished') return <Finished view={view} send={r.send} />;
  return <Playing view={view} offset={r.offset} online={online} send={r.send} placeOrder={r.placeOrder} cancelOrder={r.cancelOrder} />;
}

function Lobby({ view, send, error }: { view: RoomView; send: (m: never) => void; error: string | null }) {
  const [qr, setQr] = useState('');
  const url = joinUrl(view.code);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setQr).catch(() => setQr('')); }, [url]);
  const humans = view.leaderboard.filter(p => p.kind === 'human');
  const copy = () => navigator.clipboard?.writeText(url);
  const cfg = MODES[view.mode];
  const canStart = view.you.isHost && view.humanCount >= view.minToStart;
  return (
    <main className="lobby">
      <p className="course">{cfg.label} · 대기실</p>
      <h1 className="code-big num">{view.code}</h1>
      <p className="lede">친구에게 코드나 링크를 보내 주세요. 이름은 받지 않고 참가 코드를 자동으로 드립니다.</p>
      {qr && <img className="qr" src={qr} alt="입장 QR 코드" width="180" height="180" />}
      <button className="ghost" onClick={copy}>초대 링크 복사</button>
      <dl className="kv">
        <dt>내 참가 코드</dt><dd>{view.you.label ?? '관전 중'}</dd>
        <dt>시작 자금</dt><dd className="num">{won(view.startCash)}</dd>
        <dt>진행</dt><dd>{cfg.rounds}라운드 · 뉴스 {cfg.news}초, 주문 {cfg.trade}초, 결과 {cfg.recap}초</dd>
      </dl>
      <h2 className="h">입장 {view.humanCount}/{view.maxPlayers}명 + NPC 3명</h2>
      <ul className="people">{humans.map(p => <li key={p.playerId} className={p.connected ? '' : 'off'}>{p.label}{p.playerId === view.you.id ? ' (나)' : ''}{!p.connected ? ' · 접속 끊김' : ''}</li>)}</ul>
      {view.you.isHost
        ? <button className="cta" disabled={!canStart} onClick={() => (send as unknown as (m: object) => void)({ t: 'start' })}>{canStart ? '게임 시작' : `${view.minToStart}명이 모이면 시작할 수 있어요`}</button>
        : <p className="hint">{view.mode === 'academic' ? '운영자가 시작하면 자동으로 넘어갑니다.' : '방장이 시작하면 자동으로 넘어갑니다.'}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="rules">
        <li>뉴스를 보고, 주문을 예약하면, 마감 때 직전 종료가로 전량 체결됩니다.</li>
        <li>뉴스는 단서일 뿐입니다. 시장 기대와 실제 결과의 차이가 주가를 움직입니다.</li>
        <li>판을 끝내면 같은 멤버로 바로 다시 할 수 있습니다.</li>
      </ul>
      <button className="link" onClick={() => { (send as unknown as (m: object) => void)({ t: 'leave' }); store.del(`room:${view.code}`); navigate('/'); }}>방 나가기</button>
      <Disclaimer />
    </main>
  );
}

const PHASE_LABEL: Record<string, string> = { news: '뉴스 확인', trade: '주문 가능', settling: '체결 확인 중', recap: '라운드 결과' };

interface PlayProps { view: RoomView; offset: number; online: boolean; send: (m: never) => void; placeOrder: (c: StockCode, s: Side, q: number) => Promise<OrderOutcome>; cancelOrder: (c: StockCode) => Promise<OrderOutcome> }
function Playing({ view, offset, online, send, placeOrder, cancelOrder }: PlayProps) {
  const [tab, setTab] = useState<Tab>('market');
  const [detail, setDetail] = useState<StockCode | null>(null);
  const [help, setHelp] = useState(false);
  const toast = useToast();
  const left = useSecondsLeft(view.phaseEndsAt, offset);
  const send2 = send as unknown as (m: object) => void;
  const isPlayer = view.you.role === 'player';
  const soon = view.phase === 'trade' && left <= 10;
  const [tutorialOff, setTutorialOff] = useState(() => store.get('tutorial') === '1');
  const coach = tutorialOff ? null : coachStep(view, detail);
  const skipTutorial = () => { store.set('tutorial', '1'); setTutorialOff(true); };
  useEffect(() => { if (view.mode === 'solo' && view.round >= 2) store.set('tutorial', '1'); }, [view.mode, view.round]);
  useEffect(() => { if (view.phase === 'recap') setDetail(null); }, [view.phase]);
  const stock = detail ? view.stocks.find(s => s.code === detail)! : null;
  const seconds = Math.ceil(left);
  return (
    <div className="game">
      <header className="topbar">
        <div className="status">
          <b className="num">R{String(view.round).padStart(2, '0')}/{view.totalRounds}</b>
          <span> · {PHASE_LABEL[view.phase ?? 'news']}</span>
          {view.phase !== 'settling' && <span className="num"> · 00:{String(seconds).padStart(2, '0')}</span>}
          {soon && <span className="soon"> 곧 마감</span>}
        </div>
        <button className="help-btn" aria-label="도움말" onClick={() => setHelp(true)}>?</button>
        <div className="timer"><i style={{ width: `${view.phaseSeconds ? Math.min(100, left / view.phaseSeconds * 100) : 0}%` }} /></div>
      </header>
      {!online && <p className="offline" role="alert">연결이 끊겼습니다. 다시 연결하는 중이며, 접수된 주문은 마감 때 체결됩니다.</p>}
      {!isPlayer && <p className="offline">관전 중입니다. 시작 후 처음 들어오면 관전자로 입장합니다.</p>}
      {coach && <Coach step={coach} onSkip={skipTutorial} />}
      <main className="game-body">
        {view.phase === 'recap' && <Recap view={view} onOpen={c => { setDetail(c); setTab('market'); }} />}
        {view.phase === 'settling' && <div className="panel"><p className="headline">시장 결과 집계 중</p><p className="hint">체결을 확인하고 있습니다. 잠시만 기다려 주세요.</p></div>}
        {tab === 'market' && <>
          {(view.phase === 'news' || view.phase === 'trade') && <CurrentNews view={view} />}
          {isPlayer && view.card && view.phase === 'trade' && <Card view={view} send={send2} />}
          {isPlayer && view.prediction && view.phase === 'trade' && <Prediction view={view} send={send2} />}
          <Standing view={view} />
          <h2 className="h">시장</h2>
          <div className="board">{view.stocks.map(s => <StockRow key={s.code} s={s} view={view} hint={coach?.no === 2 && coach.target === s.code} onOpen={() => setDetail(s.code)} />)}</div>
        </>}
        {tab === 'assets' && <Assets view={view} cancel={cancelOrder} toast={toast.show} />}
        {tab === 'news' && <NewsLog view={view} />}
      </main>
      <nav className="tabs">
        {(['market', 'assets', 'news'] as Tab[]).map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'market' ? '시장' : t === 'assets' ? '내 자산' : '뉴스'}</button>)}
      </nav>
      <div className="foot"><Disclaimer /></div>
      {stock && <StockSheet stock={stock} view={view} left={left} coach={coach} onClose={() => setDetail(null)} place={placeOrder} cancel={cancelOrder} toast={toast.show} />}
      {help && <HelpSheet phase={view.phase} onClose={() => setHelp(false)} onReplayTutorial={view.mode === 'solo' ? () => { store.del('tutorial'); setTutorialOff(false); setHelp(false); } : null} />}
      {toast.node}
    </div>
  );
}

/** 첫 판 따라 하기 안내. 단계 판단은 coach.ts에 있습니다. */
function Coach({ step, onSkip }: { step: CoachStep; onSkip?: () => void }) {
  return (
    <section className="coach" aria-live="polite">
      <p className="coach-head"><span className="coach-dots" aria-label={`따라 하기 ${step.no}/${step.total}단계`}>{Array.from({ length: step.total }, (_, i) => <i key={i} className={i < step.no ? 'on' : ''} />)}</span>
        <b>{step.no}. {step.title}</b></p>
      <p>{step.text}</p>
      {onSkip && <button className="link" onClick={onSkip}>안내 끄기</button>}
    </section>
  );
}
function HelpSheet({ phase, onClose, onReplayTutorial }: { phase: RoomView['phase']; onClose: () => void; onReplayTutorial: (() => void) | null }) {
  return (
    <Sheet title="짧은 도움말" onClose={onClose}>
      <p className="hint">타이머는 멈추지 않고 계속 진행됩니다.</p>
      <ul className="rules">
        {phase === 'news' && <li>지금은 뉴스 시간입니다. 곧 주문 시간이 시작됩니다.</li>}
        {phase === 'trade' && <li>종목을 눌러 매수나 매도를 예약하세요. 마감 전까지 바꾸거나 취소할 수 있습니다.</li>}
        {phase === 'recap' && <li>그래프의 점을 누르면 가격이 움직인 이유가 나옵니다.</li>}
        <li><TermLink id="execution">체결</TermLink>가는 지금 화면의 <TermLink id="reference-price">기준가</TermLink>, 즉 직전 라운드 종료가입니다.</li>
        <li><TermLink id="fee">수수료</TermLink>는 매수와 매도 모두 <TermLink id="turnover">거래대금</TermLink>의 0.20%입니다.</li>
        <li><TermLink id="sell">매도</TermLink> 대금은 다음 라운드부터 쓸 수 있습니다(<TermLink id="settlement">결제일</TermLink>을 단순화).</li>
        <li>1<TermLink id="bp">bp</TermLink>는 0.01%입니다. 100bp가 1%입니다.</li>
        <li>밑줄 친 낱말을 누르면 뜻이 나옵니다.</li>
      </ul>
      <button className="ghost" onClick={() => { onClose(); navigate('/glossary'); }}>주식 용어 사전 열기</button>
      {onReplayTutorial && <button className="link" onClick={onReplayTutorial}>따라 하기 안내 다시 켜기(다음 혼자 연습 첫 라운드부터)</button>}
    </Sheet>
  );
}
function NewsBody({ card, result }: { card: NewsCard; result: NewsResult | null }) {
  return (
    <article className="news">
      <p className="news-meta">{card.breaking && <span className="chip alert">속보</span>}<span className="chip">{card.arcTitle}</span></p>
      <h3 className="headline"><Rich text={card.headline} /></h3>
      <dl className="facts">
        <dt>확인된 사실</dt><dd><Rich text={card.facts} /></dd>
        <dt><TermLink id="expectation">시장의 기대치</TermLink></dt><dd className="expect"><Rich text={card.expectation} /></dd>
        <dt>아직 남은 변수</dt><dd><Rich text={card.remaining} /></dd>
        <dt>주문 전 단서</dt><dd><Rich text={card.clue} /></dd>
      </dl>
      {result && <div className="result">
        <dl className="facts">
          <dt>실제 결과</dt><dd className="actual"><Rich text={result.actual} /></dd>
          <dt>기대와의 차이</dt><dd><Rich text={result.gap} /></dd>
          <dt>기업별 영향 이유</dt><dd><ul className="impact">{result.impacts.map((i, k) => <li key={k}><span className={dir(i.bp)}>{i.code} {arrow(i.bp)} {pctBp(i.bp)}</span> <Rich text={i.reason} /></li>)}</ul></dd>
          <dt>배운 점</dt><dd><Rich text={result.concept} /></dd>
        </dl>
      </div>}
    </article>
  );
}
function CurrentNews({ view }: { view: RoomView }) {
  const now = view.news[view.news.length - 1];
  if (!now) return null;
  return <div className="panel">{now.cards.map(c => <NewsBody key={c.card.stageId} card={c.card} result={null} />)}</div>;
}
function Card({ view, send }: { view: RoomView; send: (m: object) => void }) {
  const c = view.card!;
  return (
    <div className="card-box">
      <h3>{c.title}</h3><p><Rich text={c.body} /></p>
      <div className="seg">{c.options.map(o => <button key={o.key} aria-pressed={c.answered === o.key} onClick={() => send({ t: 'card', choice: o.key })}>{o.key}. {o.label}</button>)}</div>
      <p className="hint">{c.answered ? '판단을 저장했습니다. 마감 전까지 바꿀 수 있습니다. 주문은 주문 패널에서 따로 확정합니다.' : '응답은 판단 기록으로만 저장됩니다. 주문은 주문 패널에서 따로 확정합니다.'}</p>
    </div>
  );
}
function Prediction({ view, send }: { view: RoomView; send: (m: object) => void }) {
  const p = view.prediction!;
  const [conf, setConf] = useState(p.confidence ?? 70);
  const pick = (choice: 'A' | 'B', confidence = conf) => send({ t: 'predict', choice, confidence });
  return (
    <div className="card-box">
      <h3>결과 예측</h3><p>{p.question}</p>
      <div className="seg">
        <button aria-pressed={p.choice === 'A'} onClick={() => pick('A')}>기대 이상</button>
        <button aria-pressed={p.choice === 'B'} onClick={() => pick('B')}>기대 이하</button>
      </div>
      <p className="hint">얼마나 확신하나요?</p>
      <div className="seg">{[50, 70, 90].map(v => <button key={v} aria-pressed={conf === v} onClick={() => { setConf(v); if (p.choice) pick(p.choice, v); }}>{v}%</button>)}</div>
    </div>
  );
}
function Standing({ view }: { view: RoomView }) {
  const me = view.leaderboard.find(l => l.playerId === view.you.id);
  const top = view.leaderboard.slice(0, 4);
  return (
    <div className="standing">
      {me && <p className="me-line"><b>{me.rank}위</b> · <TermLink id="portfolio-value">평가액</TermLink> <b className="num">{won(view.portfolio?.value ?? me.value)}</b> <span className={dir(me.returnPct)}>{pct(me.returnPct)}</span> · <TermLink id="cash">주문 가능</TermLink> <b className="num">{won(view.portfolio?.available ?? 0)}</b></p>}
      <ol className="mini-rank">{top.map(l => <li key={l.playerId} className={l.playerId === view.you.id ? 'me' : ''}>{l.rank}위 {l.label} <span className={dir(l.returnPct)}>{pct(l.returnPct)}</span></li>)}</ol>
    </div>
  );
}
function StockRow({ s, view, onOpen, hint = false }: { s: StockView; view: RoomView; onOpen: () => void; hint?: boolean }) {
  const held = view.portfolio?.holdings.find(h => h.code === s.code);
  const ord = view.portfolio?.orders.find(o => o.code === s.code);
  const ch = s.lastChangeBp;
  return (
    <button className={`row${hint ? ' hint-pulse' : ''}`} onClick={onOpen}>
      <span className="row-main"><b>{s.name}</b><small>{s.code} · {s.sector}{held ? ` · ${held.qty.toLocaleString('ko-KR')}주 보유` : ''}{ord ? ` · ${ord.side === 'buy' ? '매수' : '매도'} 예약` : ''}</small></span>
      <span className="row-price"><b className="num">{s.price.toLocaleString('ko-KR')}</b>
        <small className={ch === null ? 'flat' : dir(ch)}>{ch === null ? '—' : `${arrow(ch)} ${pctBp(ch)}`}</small></span>
    </button>
  );
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-head"><h2>{title}</h2><button className="ghost small" onClick={onClose}>닫기</button></div>
        {children}
      </section>
    </div>
  );
}
function StockSheet({ stock, view, left, coach, onClose, place, cancel, toast }: { stock: StockView; view: RoomView; left: number; coach: CoachStep | null; onClose: () => void; place: PlayProps['placeOrder']; cancel: PlayProps['cancelOrder']; toast: (m: string) => void }) {
  const [point, setPoint] = useState<number | null>(stock.history.length ? stock.history[stock.history.length - 1].round : null);
  const related = view.news[view.news.length - 1]?.cards.filter(c => c.card.targets.includes(stock.code)) ?? [];
  const held = view.portfolio?.holdings.find(h => h.code === stock.code);
  const pointData = stock.history.find(h => h.round === point);
  return (
    <Sheet title={stock.name} onClose={onClose}>
      <p className="hint">{stock.code} · {stock.sector} · {stock.desc}</p>
      <p className="bigpx num">{stock.price.toLocaleString('ko-KR')}원 {stock.lastChangeBp !== null && <small className={dir(stock.lastChangeBp)}>{arrow(stock.lastChangeBp)} {pctBp(stock.lastChangeBp)}</small>}</p>
      <PriceChart stock={stock} totalRounds={view.totalRounds} selected={point} onSelect={setPoint} />
      {pointData ? <BreakdownPanel b={pointData} /> : <p className="hint">가격은 라운드 마감 때만 바뀝니다. 첫 결과가 나오면 점을 눌러 이유를 볼 수 있어요.</p>}
      {related.length > 0 && view.phase !== 'recap' && <p className="hint">관련 뉴스: {related.map(r => r.card.headline).join(', ')}</p>}
      {held && <p className="hint">보유 {held.qty.toLocaleString('ko-KR')}주 · <TermLink id="avg-cost">평균</TermLink> {won(held.avgCost)} · <TermLink id="unrealized-pnl">평가손익</TermLink> <span className={dir(held.pnl)}>{signedWon(held.pnl)}</span></p>}
      {coach && (coach.no === 3 || coach.no === 4) && <Coach step={coach} />}
      {view.you.role === 'player' && <OrderPanel stock={stock} view={view} left={left} place={place} cancel={cancel} toast={toast} onDone={onClose} />}
    </Sheet>
  );
}
function OrderPanel({ stock, view, left, place, cancel, toast, onDone }: { stock: StockView; view: RoomView; left: number; place: PlayProps['placeOrder']; cancel: PlayProps['cancelOrder']; toast: (m: string) => void; onDone: () => void }) {
  const pf = view.portfolio!;
  const existing = pf.orders.find(o => o.code === stock.code) ?? null;
  const [side, setSide] = useState<Side>(existing?.side ?? 'buy');
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(existing ? String(existing.qty) : '');
  const [busy, setBusy] = useState(false);
  const open = view.phase === 'trade' && left > 0;
  const heldQty = pf.holdings.find(h => h.code === stock.code)?.qty ?? 0;
  const ctx = useMemo(() => ({ cash: pf.cash, holdings: {}, orders: Object.fromEntries(pf.orders.map(o => [o.code, o])) as Partial<Record<StockCode, Order>> }), [pf.cash, pf.orders]);
  const max = side === 'buy' ? maxBuyQty(ctx, stock.code, stock.price) : heldQty;
  const n = Math.floor(Number(qty) || 0);
  const gross = n * stock.price, fee = feeOf(gross);
  const submit = async () => {
    setBusy(true);
    const res = await place(stock.code, side, n);
    setBusy(false);
    if (res.ok) { toast('예약 완료 · 마감 때 체결'); onDone(); }
    else toast(res.reason ?? '주문하지 못했습니다');
  };
  const doCancel = async () => {
    setBusy(true);
    const res = await cancel(stock.code);
    setBusy(false);
    toast(res.ok ? '예약을 취소했습니다' : res.reason ?? '취소하지 못했습니다');
  };
  if (!open && view.phase !== 'news') return <p className="hint strong">이번 라운드 주문 마감</p>;
  if (existing && !editing) return (
    <div className="booked">
      <p><b>{existing.side === 'buy' ? '매수' : '매도'} {existing.qty.toLocaleString('ko-KR')}주</b> · 기준가 {won(existing.price)} · 예약 완료, 마감 때 체결</p>
      <div className="seg"><button disabled={!open || busy} onClick={() => { setEditing(true); setSide(existing.side); }}>주문 변경</button><button disabled={!open || busy} onClick={doCancel}>취소</button></div>
    </div>
  );
  return (
    <div className="order">
      <div className="seg side"><button data-s="buy" aria-pressed={side === 'buy'} onClick={() => { setSide('buy'); setQty(''); }}>매수</button><button data-s="sell" aria-pressed={side === 'sell'} onClick={() => { setSide('sell'); setQty(''); }}>매도</button></div>
      <p className="hint"><TermLink id={side}>{side === 'buy' ? '매수' : '매도'}</TermLink>는 마감 때 <TermLink id="reference-price">기준가</TermLink>로 전량 <TermLink id="execution">체결</TermLink>됩니다.</p>
      <dl className="kv"><dt>기준가</dt><dd className="num">{won(stock.price)}</dd><dt>{side === 'buy' ? '최대 매수' : '라운드 시작 보유'}</dt><dd className="num">{max.toLocaleString('ko-KR')}주</dd></dl>
      <div className="stepper">
        <button aria-label="수량 줄이기" onClick={() => setQty(String(Math.max(0, n - 1)))}>−</button>
        <input aria-label="수량" inputMode="numeric" value={qty} placeholder="수량" onChange={e => setQty(e.target.value.replace(/\D/g, ''))} />
        <button aria-label="수량 늘리기" onClick={() => setQty(String(n + 1))}>+</button>
        <button className="max" onClick={() => setQty(String(max))}>최대</button>
      </div>
      {n > 0 && <p className="hint"><TermLink id="fee">수수료</TermLink> {won(fee)} · {side === 'buy' ? `총 차감액 ${won(gross + fee)}` : `수령액 ${won(gross - fee)}`}{n > max ? ' · 가능한 수량을 넘었어요' : ''}</p>}
      <button className={`go ${side}`} disabled={!open || busy || n < 1 || n > max} onClick={submit}>{view.phase === 'news' ? `${Math.ceil(left)}초 후 주문 시작` : busy ? '요청 중' : `${side === 'buy' ? '매수 예약' : '매도 예약'}${existing ? ' 변경' : ''}`}</button>
    </div>
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
        <dt>낸 <TermLink id="fee">수수료</TermLink></dt><dd className="num">{won(p.fees)}</dd>
      </dl>
      <h3 className="h small">보유 종목 <small className="hint">· 오른쪽 숫자는 <TermLink id="unrealized-pnl">평가손익</TermLink></small></h3>
      {p.holdings.length ? <ul className="list">{p.holdings.map(h => <li key={h.code}><span>{h.name}<small>{h.qty.toLocaleString('ko-KR')}주 · 평균 {won(h.avgCost)}</small></span><span className={dir(h.pnl)}>{signedWon(h.pnl)}</span></li>)}</ul> : <p className="hint">아직 보유 종목이 없습니다.</p>}
      <h3 className="h small">이번 라운드 예약</h3>
      {p.orders.length ? <ul className="list">{p.orders.map(o => <li key={o.code}><span>{view.stocks.find(s => s.code === o.code)!.name}<small>{o.side === 'buy' ? '매수' : '매도'} {o.qty.toLocaleString('ko-KR')}주 · {won(o.price)}</small></span><button className="ghost small" disabled={view.phase !== 'trade'} onClick={async () => { const r = await cancel(o.code); toast(r.ok ? '예약을 취소했습니다' : r.reason ?? '취소하지 못했습니다'); }}>취소</button></li>)}</ul> : <p className="hint">예약한 주문이 없습니다.</p>}
      <h3 className="h small">체결 내역</h3>
      {p.fillLog.length ? <ul className="list">{p.fillLog.slice().reverse().map((f, i) => <li key={i}><span>R{f.round} {view.stocks.find(s => s.code === f.code)!.name}<small>{f.side === 'buy' ? '매수' : '매도'} {f.qty.toLocaleString('ko-KR')}주 · {won(f.price)} · 수수료 {won(f.fee)}</small></span></li>)}</ul> : <p className="hint">아직 체결된 주문이 없습니다.</p>}
    </div>
  );
}
function NewsLog({ view }: { view: RoomView }) {
  return <div className="panel"><h2 className="h">뉴스</h2>{view.news.slice().reverse().map(r => <div key={r.round}><p className="round-tag">라운드 {r.round}</p>{r.cards.map(c => <NewsBody key={c.card.stageId} card={c.card} result={c.result} />)}</div>)}</div>;
}
function lessonLink(view: RoomView, code?: StockCode) {
  const r = view.lastResult?.round ?? view.round;
  const s = code ?? view.stocks.slice().sort((a, b) => Math.abs(b.lastChangeBp ?? 0) - Math.abs(a.lastChangeBp ?? 0))[0].code;
  const stock = view.stocks.find(x => x.code === s)!;
  const b = stock.history.find(h => h.round === r);
  const q = new URLSearchParams({ name: stock.name, summary: b?.summary ?? '', base: String(b?.basePrice ?? ''), close: String(b?.closePrice ?? ''), reason: b?.events[0]?.reason ?? '시장·종목 변동' });
  return `/lessons/news?${q.toString()}`;
}
function Recap({ view, onOpen }: { view: RoomView; onOpen: (c: StockCode) => void }) {
  const r = view.lastResult;
  const now = view.news[view.news.length - 1];
  const movers = view.stocks.slice().sort((a, b) => Math.abs(b.lastChangeBp ?? 0) - Math.abs(a.lastChangeBp ?? 0));
  return (
    <div className="panel recap">
      {r && <div className="recap-top">
        <p className="rank-move num">{r.rankBefore}위 → {r.rankAfter}위</p>
        <p>이번 라운드 평가액 변화 <b className={dir(r.delta)}>{signedWon(r.delta)}</b></p>
        <p>가장 큰 기여 종목 {r.best ? <><b>{r.best.name}</b> <span className={dir(r.best.won)}>{signedWon(r.best.won)}</span></> : '없음'}</p>
        <p className="hint">{r.fills.length ? `체결 ${r.fills.length}건 · 수수료 ${won(r.fees)} 별도` : '이번 라운드 체결 없음'}</p>
      </div>}
      {view.card?.feedback && <div className="card-box"><h3>{view.card.title}</h3><p><Rich text={view.card.feedback} /></p><p className="hint">학습 개념: <Rich text={view.card.concept} /></p></div>}
      {view.prediction?.correct !== null && view.prediction?.correct !== undefined && <p className="hint strong">결과 예측: {view.prediction.correct ? '맞혔어요' : '빗나갔어요'} (확신도 {view.prediction.confidence}%)</p>}
      {now?.cards.map(c => <NewsBody key={c.card.stageId} card={c.card} result={c.result} />)}
      <h3 className="h small">종목별 결과</h3>
      <ul className="list">{movers.map(s => <li key={s.code}><button className="plain" onClick={() => onOpen(s.code)}><span>{s.name}<small>{s.history[s.history.length - 1]?.summary}</small></span><span className={`num ${dir(s.lastChangeBp ?? 0)}`}>{s.price.toLocaleString('ko-KR')}</span></button></li>)}</ul>
      <button className="ghost" onClick={() => navigate(lessonLink(view))}>이 변동을 읽는 법</button>
    </div>
  );
}
function Finished({ view, send }: { view: RoomView; send: (m: never) => void }) {
  const rep = view.report;
  const [open, setOpen] = useState<StockCode | null>(null);
  const [point, setPoint] = useState<number | null>(null);
  const send2 = send as unknown as (m: object) => void;
  const stock = open ? view.stocks.find(s => s.code === open)! : null;
  const pointData = stock?.history.find(h => h.round === point);
  /* 끝난 판을 이 기기의 개인 기록에 한 번만 남깁니다. */
  useEffect(() => {
    if (!rep || view.you.role !== 'player') return;
    const humans = view.leaderboard.filter(l => l.kind === 'human');
    const rec = { code: view.code, mode: view.mode, at: Date.now(), rank: rep.rank, players: view.leaderboard.length, returnPct: rep.returnPct, fees: rep.fees,
      bestHuman: !humans.some(h => h.playerId !== view.you.id && h.value > rep.value) };
    store.set(RECORDS_KEY, JSON.stringify(addRecord(parseRecords(store.get(RECORDS_KEY)), rec)));
  }, [rep, view.code, view.mode, view.you.id, view.you.role, view.leaderboard]);
  return (
    <main className="final">
      <p className="course">최종 결과 · 방 {view.code}</p>
      {rep ? <><h1 className="rank-big num">{rep.rank}위</h1><p className="lede">최종 평가액 <b className="num">{won(rep.value)}</b> <span className={dir(rep.returnPct)}>{pct(rep.returnPct)}</span></p></> : <h1 className="logo small">결과 발표</h1>}
      <h2 className="h">순위</h2>
      <table className="rank-table"><thead><tr><th>순위</th><th>참가자</th><th>수익률</th></tr></thead><tbody>
        {view.leaderboard.map(l => <tr key={l.playerId} className={l.playerId === view.you.id ? 'me' : ''}><td className="num">{l.rank}</td><td>{l.label}{l.npcRule && <small className="npc-rule">{l.npcRule}</small>}</td><td className={`num ${dir(l.returnPct)}`}>{pct(l.returnPct)}</td></tr>)}
      </tbody></table>
      {rep && <>
        <h2 className="h">주요 거래</h2>
        {rep.majorTrades.length ? <ul className="list">{rep.majorTrades.map((t, i) => <li key={i}><span>R{t.round} {t.name}<small>{t.side === 'buy' ? '매수' : '매도'} {t.qty.toLocaleString('ko-KR')}주 · {won(t.price)}</small></span></li>)}</ul> : <p className="hint">이번 판에는 거래가 없었습니다.</p>}
        <p className="hint">낸 수수료 {won(rep.fees)}</p>
        {rep.judgments.length > 0 && <><h2 className="h">내 판단 기록</h2><ul className="list">{rep.judgments.map((j, i) => <li key={i}><span>{j.title}<small>{j.choice} · {j.concept}</small></span></li>)}</ul></>}
        {rep.metrics && <><h2 className="h">내 투자 행동 리포트</h2><p className="hint">이번 판에서 관찰한 행동만 설명합니다.</p><div className="metrics">{rep.metrics.map(m => <div className="metric" key={m.key}><h3>{m.title}</h3><p className={m.available ? 'metric-val' : 'hint'}>{m.value}</p>{m.available && <p>{m.text}</p>}<details><summary>계산 방법</summary><p className="hint">{m.formula} · 필요한 관찰 수: {m.minObservations}</p></details></div>)}</div></>}
      </>}
      <GameTerms view={view} />
      <h2 className="h">종목 그래프 다시 보기</h2>
      <div className="board">{view.stocks.map(s => <button key={s.code} className="row" onClick={() => { setOpen(s.code); setPoint(s.history[s.history.length - 1]?.round ?? null); }}><span className="row-main"><b>{s.name}</b><small>{s.code}</small></span><span className="row-price"><b className="num">{s.price.toLocaleString('ko-KR')}</b><small className={dir(s.price - s.startPrice)}>{pct((s.price / s.startPrice - 1) * 100)}</small></span></button>)}</div>
      {stock && <Sheet title={stock.name} onClose={() => setOpen(null)}><PriceChart stock={stock} totalRounds={view.totalRounds} selected={point} onSelect={setPoint} />{pointData && <BreakdownPanel b={pointData} />}</Sheet>}
      <div className="final-actions">
        {view.nextRoomCode
          ? <button className="cta" onClick={() => navigate(`/${view.you.role === 'operator' ? 'display' : 'room'}/${view.nextRoomCode}`)}>다음 판 대기실로 가기</button>
          : <button className="cta" onClick={() => send2({ t: 'rematch' })}>같은 멤버로 한 판 더</button>}
        <button className="ghost" onClick={() => navigate('/records')}>내 기록 보기</button>
        <button className="ghost" onClick={() => navigate('/lessons')}>차트 연습실</button>
        <button className="link" onClick={() => navigate('/')}>처음으로</button>
      </div>
      <Disclaimer />
    </main>
  );
}

/** 이번 판 뉴스·돌발 카드에 나온 용어를 모아 복습하게 합니다. 열어 본 용어는 ✓로 표시합니다. */
function GameTerms({ view }: { view: RoomView }) {
  const { open, seen } = useGlossary();
  /* 모든 뉴스 카드에 '시장의 기대치' 칸이 있으므로 항상 맨 앞에 넣습니다. */
  const ids = useMemo(() => termsIn([
    '시장의 기대치',
    ...view.news.flatMap(r => r.cards.flatMap(c => [c.card.headline, c.card.facts, c.card.expectation, c.card.remaining, c.card.clue,
      ...(c.result ? [c.result.actual, c.result.gap, c.result.concept, ...c.result.impacts.map(i => i.reason)] : [])])),
    ...(view.report?.judgments.map(j => j.concept) ?? [])
  ]), [view.news, view.report]);
  if (!ids.length) return null;
  const learned = ids.filter(id => seen.has(id)).length;
  return (
    <section className="game-terms">
      <h2 className="h">이번 판에 나온 용어</h2>
      <p className="hint">{ids.length}개 중 {learned}개를 열어 봤어요. 눌러서 뜻을 확인하세요.</p>
      <div className="term-chips">{ids.map(id => <button key={id} className={`term-chip${seen.has(id) ? ' seen' : ''}`} onClick={() => open(id)}>{termById.get(id)!.term}</button>)}</div>
      <button className="ghost" onClick={() => navigate(`/glossary?quiz=1&pool=${ids.join(',')}`)}>이번 판 용어로 퀴즈 풀기</button>
    </section>
  );
}
