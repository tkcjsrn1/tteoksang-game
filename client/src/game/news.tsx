/* 뉴스·사건 화면: 뉴스 카드, 속보 알림, 돌발 카드와 결과 창, VI·발표 일정·배당 안내, 라운드 결과.
   Game.tsx에서 옮겼습니다(2026-11). 옮기기만 했고 동작은 그대로입니다. */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CardView, ClientMsg, NewsCard, NewsResult, RoomView, StockCode, StockView } from '../../../shared/types';
import { navigate } from '../App';
import { buzz, play, useCountUp } from '../fx';
import { Rich, TermLink } from '../glossary/GlossaryContext';
import { arrow, bpText, CandleReplay, Confetti, dir, Disclaimer, pct, pctBp, signedWon, StockAvatar, won } from '../ui';
import { intradayBp } from '../live';
import { CONFIDENCES } from '../../../shared/rules';
import { lessonLink, Sheet } from './parts';

export function NewsBody({ card, result, compact = false, action }: { card: NewsCard; result: NewsResult | null; compact?: boolean; action?: React.ReactNode }) {
  if (compact) return (
    <article className="news">
      <p className="news-meta">{card.breaking ? <span className="chip alert">속보</span> : <span className="chip">이번 뉴스</span>}<span className="chip soft">{card.arcTitle}</span></p>
      <h2 className="headline"><Rich text={card.headline} /></h2>
      <dl className="facts">
        <dt><TermLink id="expectation">시장 기대</TermLink></dt><dd className="expect"><Rich text={card.expectation} /></dd>
        <dt>단서</dt><dd><Rich text={card.clue} /></dd>
      </dl>
      <details className="more"><summary>자세히: 확인된 사실 · 남은 변수</summary>
        <dl className="facts"><dt>확인된 사실</dt><dd><Rich text={card.facts} /></dd><dt>남은 변수</dt><dd><Rich text={card.remaining} /></dd></dl>
      </details>
      {action}
    </article>
  );
  return (
    <article className="news">
      <p className="news-meta">{card.breaking && <span className="chip alert">속보</span>}<span className="chip soft">{card.arcTitle}</span></p>
      <h2 className="headline"><Rich text={card.headline} /></h2>
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
export function CurrentNews({ view, onOpen, send }: { view: RoomView; onOpen?: (code: StockCode) => void; send?: (m: ClientMsg) => void }) {
  const now = view.news[view.news.length - 1];
  if (!now) return null;
  return <div className="panel">{now.cards.map(({ card }, i) => {
    const stock = i === 0 && onOpen ? view.stocks.find(s => s.code === card.targets[0]) : null;
    return <NewsBody key={card.stageId} card={card} result={null} compact
      action={stock && onOpen && <button className="ghost blue" onClick={() => onOpen(stock.code)}>{stock.name} 종목 보기</button>} />;
  })}
  {send && view.prediction?.open && <Predict view={view} send={send} />}
  </div>;
}
/** 결과 예측. 뉴스를 읽고 결과가 시장 기대보다 좋을지 고릅니다. 점수와 상관없고, 판이 끝나면 정답률과 확신도를 비교합니다. */
export function Predict({ view, send }: { view: RoomView; send: (m: ClientMsg) => void }) {
  const p = view.prediction!;
  const pick = (choice: 'up' | 'down', confidence: number) => send({ t: 'predict', choice, confidence });
  const conf = p.confidence ?? 70;
  const two = view.news[view.news.length - 1]?.cards.length > 1;
  return (
    <div className="predict" role="group" aria-label="결과 예측">
      <p className="predict-q"><span className="chip">예측</span> {two ? '첫 번째 뉴스의 결과가' : '이 뉴스의 결과가'} 시장 기대보다 좋을까요?</p>
      <div className="seg">
        <button aria-pressed={p.choice === 'up'} onClick={() => pick('up', conf)}>기대보다 좋다</button>
        <button aria-pressed={p.choice === 'down'} onClick={() => pick('down', conf)}>기대보다 나쁘다</button>
      </div>
      {p.choice && <div className="seg conf" aria-label="확신도">{CONFIDENCES.map(c =>
        <button key={c} aria-pressed={p.confidence === c} onClick={() => pick(p.choice!, c)}>{c === 50 ? '반반' : c === 70 ? '꽤 확신' : '거의 확실'} {c}%</button>)}</div>}
      <p className="hint">{p.choice ? '결과 공개 전까지 바꿀 수 있어요. 점수와는 상관없어요.' : '점수와는 상관없어요. 판이 끝나면 내 정답률을 보여 드려요.'}</p>
    </div>
  );
}
/** 결과 시간: 내 예측이 맞았는지와 참가자 전체가 어떻게 골랐는지 */
function PredictResult({ view }: { view: RoomView }) {
  const p = view.prediction, c = view.crowd;
  if (!p?.choice && !c) return null;
  const total = c ? c.up + c.down : 0;
  const upPct = total ? Math.round(c!.up / total * 100) : 0;
  return (
    <div className={`panel predict-result ${p?.correct ? 'hit' : p?.correct === false ? 'miss' : ''}`}>
      {p?.choice && p.correct !== null && <p className="predict-verdict"><b>{p.correct ? '예측이 맞았어요' : '예측이 빗나갔어요'}</b> · {p.choice === 'up' ? '기대보다 좋다' : '기대보다 나쁘다'}, 확신 {p.confidence}%</p>}
      {c && total > 1 && <p className="hint">참가자 {total}명 중 {upPct}%가 '기대보다 좋다'를 골랐고, 결과는 기대보다 {c.beat ? '좋았어요' : '나빴어요'}.</p>}
    </div>
  );
}
/** 내 투자 행동 리포트. 관찰이 모자라 계산하지 못한 지표는 카드로 늘어놓지 않고 한 줄로 줄입니다. */

export function Card({ view, send }: { view: RoomView; send: (m: ClientMsg) => void }) {
  const c = view.card!;
  /* 고른 즉시 결과 창을 띄웁니다. 닫은 카드는 라운드가 바뀔 때까지 다시 뜨지 않습니다. */
  const [closed, setClosed] = useState('');
  const mine = c.answered ? c.options.find(o => o.key === c.answered) ?? null : null;
  const key = `${view.round}:${c.id}`;
  return (
    <div className="card-box">
      <h3>{c.title}</h3><p><Rich text={c.body} /></p>
      <div className="seg">{c.options.map(o => <button key={o.key} aria-pressed={c.answered === o.key} disabled={!!c.answered} onClick={() => send({ t: 'card', choice: o.key })}>{o.key}. {o.label}</button>)}</div>
      {mine && c.feedback
        ? <p className="card-done">내 판단 <b>{mine.key}. {mine.label}</b></p>
        : <p className="hint">한 번 고르면 바꿀 수 없고, 고르면 바로 결과가 나옵니다. 응답은 판단 기록으로만 저장되며 주문은 주문 패널에서 따로 확정합니다.</p>}
      {mine && c.feedback && closed !== key && <CardResult card={c} mine={mine} onClose={() => setClosed(key)} />}
    </div>
  );
}
/** 돌발 카드를 고른 뒤 바로 뜨는 결과 창. 어떤 판단이었는지와 그 이유를 알려 줍니다. */
export function CardResult({ card, mine, onClose }: { card: CardView; mine: { key: 'A' | 'B'; label: string }; onClose: () => void }) {
  useEffect(() => { play('stamp'); buzz('trigger'); }, []);
  return (
    <Sheet title="판단 결과" onClose={onClose}>
      <p className="news-meta"><span className="chip soft">{card.title}</span><span className="chip">{card.concept}</span></p>
      <p className="card-pick">내 판단 <b>{mine.key}. {mine.label}</b></p>
      <p className="card-feedback"><Rich text={card.feedback ?? ''} /></p>
      <p className="hint">점수는 아니에요. 판단 기록은 판이 끝난 뒤 보고서에 모아 보여 드립니다.</p>
      <button className="primary" onClick={onClose}>알겠어요</button>
      <Disclaimer />
    </Sheet>
  );
}
/** 내 평가액 구역. 관전자에게는 상위 순위만 보여 줍니다. */

/** 속보 창이 저절로 닫히기까지의 초 */
export const BREAKING_SECONDS = 5;
export function BreakingPopup({ view, card, onClose, onOpen }: { view: RoomView; card: NewsCard; onClose: () => void; onOpen: (c: StockCode) => void }) {
  const targets = card.targets.map(c => view.stocks.find(s => s.code === c)).filter((s): s is StockView => !!s);
  /* 5 → 4 → 3 → 2 → 1로 줄어들다가 0이 되면 닫습니다. 새 속보가 오면 창을 새로 그려(key) 5부터 다시 셉니다. */
  const [left, setLeft] = useState(BREAKING_SECONDS);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setInterval(() => setLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left <= 0) closeRef.current(); }, [left]);
  return (
    <div className="breaking-wrap" role="status" aria-label="속보">
      <div className="breaking">
        <p className="news-meta"><span className="chip alert">속보</span><span className="chip soft">{card.arcTitle}</span></p>
        <p className="headline"><Rich text={card.headline} /></p>
        <dl className="facts"><dt>시장 기대</dt><dd><Rich text={card.expectation} /></dd><dt>단서</dt><dd><Rich text={card.clue} /></dd></dl>
        {targets.length > 0 && <ul className="list breaking-stocks">{targets.map(s => {
          const bp = intradayBp(s);
          return <li key={s.code}><button className="plain" onClick={() => onOpen(s.code)}>
            <span>{s.name}<small>지금 {won(s.price)}</small></span>
            <b className={dir(bp)}>{arrow(bp)} {pctBp(bp)}</b>
          </button></li>;
        })}</ul>}
        <p className="hint">속보가 뜨는 순간 가격이 먼저 반응했어요. 결과는 장 마감 때 공개됩니다. 아무 곳이나 누르면 닫혀요.</p>
        {/* 남은 초는 화면 읽기 프로그램이 매초 다시 읽지 않게 숨기고, 버튼 이름은 '닫기'로 고정합니다 */}
        <button className="ghost" onClick={onClose} aria-label="닫기"><span>닫기 <span className="num" aria-hidden="true">({Math.max(left, 1)}초 뒤 자동)</span></span></button>
      </div>
    </div>
  );
}
/** VI(변동성 완화장치)로 멈춘 종목 안내 */
export function ViNotice({ view }: { view: RoomView }) {
  const halted = view.stocks.filter(s => s.haltLeft);
  if (view.phase !== 'trade' || halted.length === 0) return null;
  return (
    <section className="panel vi-note" role="status" aria-label="변동성 완화장치 안내">
      <p className="news-meta"><span className="chip alert">VI</span></p>
      <p><b>{halted.map(s => s.name).join(', ')}의 거래가 잠깐 멈췄어요.</b> 시가 대비 10% 넘게 움직여 <TermLink id="vi">변동성 완화장치</TermLink>가 걸렸습니다. 걸어 둔 예약은 취소됐어요.</p>
      <ul className="list">{halted.map(s => <li key={s.code}><span>{s.name}<small>시가 대비 {pctBp(Math.round((s.price - s.openPrice) * 10000 / s.openPrice))}</small></span><b className="num">{s.haltLeft}초 뒤 재개</b></li>)}</ul>
    </section>
  );
}
/** 결과 공개 뒤 다음 라운드 발표 예정 */
export function SchedulePanel({ view }: { view: RoomView }) {
  if (view.schedule.length === 0 || view.phase !== 'recap') return null;
  return (
    <section className="panel schedule" aria-label="다음 라운드 발표 예정">
      <div className="list-head"><span><TermLink id="earnings-calendar">발표 일정</TermLink> · {view.schedule[0].round}라운드 예정</span></div>
      <ul className="list">{view.schedule.map(x => <li key={x.code}><span>{x.name}<small>{x.arcTitle || '처음 나오는 소식'}</small></span></li>)}</ul>
      <p className="hint">다음 라운드에 소식이 나올 회사를 알려 드려요. 내용과 결과는 그 라운드에 공개됩니다.</p>
    </section>
  );
}
export function DividendNotice({ view }: { view: RoomView }) {
  const d = view.dividend;
  if (!d || d.status === 'before' || d.status === 'done') return null;
  const list = d.items.map(i => `${i.name} 주당 ${won(i.dps)}`).join(', ');
  const mine = (view.portfolio?.dividendLog ?? []).filter(x => x.round === view.round);
  const got = mine.reduce((a, x) => a + x.amount, 0);
  return (
    <section className="panel dividend-note" aria-label="배당 안내">
      <p className="news-meta"><span className="chip">배당</span></p>
      {d.status === 'upcoming' && <p><b>다음 라운드 장 마감이 <TermLink id="record-date">배당 기준일</TermLink>이에요.</b> {list}. 기준일 장 마감 때 가진 주식만 받아요.</p>}
      {d.status === 'record' && <p><b>오늘 장 마감 때 가진 주식에 배당이 확정돼요.</b> {list}. 다음 라운드 시작 때 배당금이 들어오고, 시가는 배당금만큼 낮아져요(<TermLink id="ex-dividend">배당락</TermLink>).</p>}
      {d.status === 'ex' && <p><b><TermLink id="ex-dividend">배당락</TermLink>: 배당주의 시가가 배당금만큼 낮아졌어요.</b> {got ? <>내 배당금 <span className="up">+{won(got)}</span> 입금. 받은 돈과 떨어진 가격이 같아 평가액은 그대로예요.</> : '기준일에 가진 주식이 없어 받은 배당금은 없어요.'}</p>}
    </section>
  );
}

export function NewsLog({ view }: { view: RoomView }) {
  return <div className="panel"><h2 className="h">뉴스</h2>{view.news.slice().reverse().map(r => <div key={r.round}><p className="round-tag">라운드 {r.round}</p>{r.cards.map(c => <NewsBody key={c.card.stageId} card={c.card} result={c.result} />)}</div>)}</div>;
}

export function Recap({ view, onOpen, send }: { view: RoomView; onOpen: (c: StockCode) => void; send?: (m: ClientMsg) => void }) {
  const r = view.lastResult;
  const now = view.news[view.news.length - 1];
  const movers = view.stocks.slice().sort((a, b) => Math.abs(b.lastChangeBp ?? 0) - Math.abs(a.lastChangeBp ?? 0));
  const delta = useCountUp(r?.delta ?? 0, 900);
  /* 폭죽: 내가 가진 종목이 상한가를 쳤거나, 이번 라운드에 1위로 올라섰을 때 */
  const held = new Set(view.portfolio?.holdings.map(h => h.code) ?? []);
  const fire = view.stocks.some(s => held.has(s.code) && s.history[s.history.length - 1]?.round === view.round && s.history[s.history.length - 1]?.limit === 'upper')
    || (!!r && r.rankAfter === 1 && r.rankBefore > 1);
  return (<>
    {r && <div className="panel recap-top">
      <p className="wallet-label">내 평가액 변화 {r.rankBefore !== r.rankAfter && <span className={`pill pop ${r.rankAfter < r.rankBefore ? 'up' : 'down'}`}>{r.rankBefore}위 → {r.rankAfter}위</span>}{r.rankBefore === r.rankAfter && <span className="pill">{r.rankAfter}위 유지</span>}</p>
      <p className={`delta-big ${dir(r.delta)}`} aria-label={signedWon(r.delta)}>{signedWon(delta)}</p>
      <p className="hint">{r.best ? `${r.best.name} ${signedWon(r.best.won)}` : '보유 종목 없음'}{r.fees ? ` · 수수료·세금 −${won(r.fees)}` : ''}{r.slippage ? ` · 슬리피지 ${won(r.slippage)}(체결가에 포함)` : ''}</p>
    </div>}
    {fire && <Confetti key={view.round} />}
    <PredictResult view={view} />
    {now?.cards.map(c => c.result && <RecapNews key={c.card.stageId} card={c.card} result={c.result} stock={view.stocks.find(s => s.code === c.card.targets[0])!} />)}
    {view.card?.feedback && <div className="card-box"><h3>{view.card.title}</h3><p><Rich text={view.card.feedback} /></p><p className="hint">학습 개념: <Rich text={view.card.concept} /></p></div>}
    {view.leaderboard.length > 1 && <RankMoves view={view} />}
    <div className="panel flush">
      <div className="list-head"><span>종목별 결과 · 눌러서 이유 보기</span></div>
      <div className="board">{movers.map(s => <button key={s.code} className="row" onClick={() => onOpen(s.code)}>
        <StockAvatar code={s.code} name={s.name} />
        <span className="row-main"><b>{s.name}{s.history[s.history.length - 1]?.limit && <span className={`stamp ${s.history[s.history.length - 1]!.limit === 'upper' ? 'up' : 'down'}`}>{s.history[s.history.length - 1]!.limit === 'upper' ? '상한가' : '하한가'}</span>}</b><small>{s.history[s.history.length - 1]?.summary}</small></span>
        <span className="row-price"><b className="num">{s.price.toLocaleString('ko-KR')}원</b><small className={dir(s.lastChangeBp ?? 0)}>{s.lastChangeBp === null ? '—' : `${arrow(s.lastChangeBp)} ${pctBp(s.lastChangeBp)}`}</small></span>
      </button>)}</div>
    </div>
    <SchedulePanel view={view} />
    <div className="panel"><button className="ghost" onClick={() => navigate(lessonLink(view))}>이 변동을 읽는 법 (차트 연습실)</button></div>
    {send && <RecapDone view={view} send={send} />}
  </>);
}
/** 결과 화면 '다 봤어요'. 화면 아래(탭 위)에 붙어 있어 어디까지 읽었든 바로 누를 수 있습니다.
    혼자 연습은 바로 다음으로, 친구 대전은 접속 중인 사람 모두가 누르면 넘어갑니다. 운영자 방에는 없습니다(운영자가 진행). */
function RecapDone({ view, send }: { view: RoomView; send: (m: ClientMsg) => void }) {
  const d = view.recapDone;
  if (!d || view.you.role !== 'player') return null;
  const last = view.round >= view.totalRounds;
  const where = last ? '최종 결과' : '다음 라운드';
  const alone = d.total <= 1;
  return (
    <div className="recap-done" role="group" aria-label="결과 다 봤어요">
      {d.me
        ? <p className="hint" role="status">다른 참가자를 기다리는 중이에요 ({d.done}/{d.total}명). 모두 누르거나 시간이 다 되면 {where}로 넘어가요.</p>
        : <>
            <button className="cta" onClick={() => send({ t: 'done' })}>{alone ? `${where}로 ▶` : '다 봤어요 ▶'}</button>
            {!alone && <p className="hint">{d.done}/{d.total}명이 다 봤어요. 모두 누르면 바로 {where}로 넘어가요.</p>}
          </>}
    </div>
  );
}
/** 순위 변화. 사람이 많은 방에서는 상위 5명과 나만 먼저 보여 주고 나머지는 펼쳐 봅니다.
    결과 시간이 30초라 '기대 vs 실제' 설명이 긴 순위표에 밀리지 않게 설명 뒤에 둡니다. */
const RANK_TOP = 5;
function RankMoves({ view }: { view: RoomView }) {
  const all = view.leaderboard;
  const row = (l: RoomView['leaderboard'][number]) => { const move = l.prevRank - l.rank; return (
    <li key={l.playerId} className={l.playerId === view.you.id ? 'me' : ''} style={{ '--from': `${move * 100}%` } as CSSProperties}>
      <span className="r">{l.rank}</span>
      <b>{l.playerId === view.you.id ? `나 · ${l.label}` : l.label}</b>
      <span className={`mv ${move > 0 ? 'up' : move < 0 ? 'down' : 'flat'}`} aria-label={move > 0 ? `${move}계단 올라감` : move < 0 ? `${-move}계단 내려감` : '순위 그대로'}>{move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '–'}</span>
      <span className={`ret ${dir(l.returnPct)}`}>{pct(l.returnPct)}</span>
    </li>); };
  const short = all.length > RANK_TOP + 1;
  const top = short ? all.slice(0, RANK_TOP) : all;
  const me = short ? all.find((l, i) => i >= RANK_TOP && l.playerId === view.you.id) : undefined;
  return (
    <div className="panel">
      <p className="wallet-label">순위 변화</p>
      <ol className="rank-moves">{top.map(row)}{me && row(me)}</ol>
      {short && <details className="more"><summary>전체 순위 {all.length}명 보기</summary><ol className="rank-moves">{all.map(row)}</ol></details>}
    </div>
  );
}
/** 사건 하나의 결과: 기대와 실제를 나란히, 주인공 종목의 등락을 막대로 나눠 보여 줍니다. */
export function RecapNews({ card, result, stock }: { card: NewsCard; result: NewsResult; stock: StockView }) {
  const b = stock.history[stock.history.length - 1];
  const mainBp = result.impacts.find(i => i.code === stock.code)?.bp ?? 0;
  const parts = b ? [
    { label: '사건 결과', bp: b.eventBp },
    { label: '시장 전체', bp: b.marketBp },
    { label: '종목 변동', bp: b.stockBp }
  ] : [];
  const scale = Math.max(100, ...parts.map(p => Math.abs(p.bp)));
  return (
    <div className="panel">
      <p className="news-meta"><span className="chip soft">{card.arcTitle}</span></p>
      <p className="headline"><Rich text={result.gap} /></p>
      <div className="vs">
        <div><small>시장 기대</small><b><Rich text={card.expectation.replace(/^시장(은| 기대치는| 기대)\s*/, '')} /></b></div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--chev)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <div className={mainBp >= 0 ? 'hit' : 'miss'}><small>실제 결과</small><b className={dir(mainBp)}><Rich text={result.actual} /></b></div>
      </div>
      {b && <div className="bars" aria-label={`${stock.name} 등락 ${pctBp(b.changeBp)}의 구성`}>
        <p className="hint">{stock.name} {pctBp(b.changeBp)}는 이렇게 만들어졌어요</p>
        {parts.map(p => {
          const w = Math.abs(p.bp) / scale * 48;
          return <div key={p.label} className="bar-row"><span>{p.label}</span>
            <span className="bar"><i style={{ left: `${p.bp >= 0 ? 50 : 50 - w}%`, width: `${Math.max(w, 1)}%`, background: p.bp >= 0 ? 'var(--up)' : 'var(--down)', transformOrigin: p.bp >= 0 ? 'left' : 'right' }} /></span>
            <span className={dir(p.bp)}>{bpText(p.bp)}</span></div>;
        })}
      </div>}
      {b && <CandleReplay b={b} name={stock.name} ticks={stock.ticks} />}
      <p className="lesson-box"><b>배운 점</b> <Rich text={result.concept} /></p>
      <details className="more"><summary>기업별 영향 자세히</summary>
        <ul className="impact">{result.impacts.map((i, k) => <li key={k}><span className={dir(i.bp)}>{i.code} {arrow(i.bp)} {pctBp(i.bp)}</span> <Rich text={i.reason} /></li>)}</ul>
      </details>
    </div>
  );
}
