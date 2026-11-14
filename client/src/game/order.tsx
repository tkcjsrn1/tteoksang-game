/* 종목 창과 주문 패널: 호가창, 지정가, 손절·익절, 기업 정보.
   Game.tsx에서 옮겼습니다(2026-11). 옮기기만 했고 동작은 그대로입니다. */
import { useMemo, useState } from 'react';
import type { Order, OrderKind, RoomView, Side, StockCode, StockView } from '../../../shared/types';
import { BOOK_SHOW, GROUPS, dividendYieldBp, feeOf, formatEok, fundOf, lowerLimit, marketCapWon, marketFill, maxBuyQty, perOf, quoteBook, stockOf, taxOf, upperLimit, type QuoteBook } from '../../../shared/rules';
import { play } from '../fx';
import { Rich, TermLink } from '../glossary/GlossaryContext';
import type { CoachStep } from '../coach';
import { arrow, BreakdownPanel, dir, LiveChart, pctBp, PriceChart, signedWon, won } from '../ui';
import { Coach, Sheet, type PlayProps } from './parts';
import { intradayBp } from '../live';

export function StockSheet({ stock, view, left, coach, onClose, onWatch, favorite, onFavorite, place, cancel, setStop, toast }: { stock: StockView; view: RoomView; left: number; coach: CoachStep | null; onClose: () => void; onWatch: () => void; favorite: boolean; onFavorite: () => void; place: PlayProps['placeOrder']; cancel: PlayProps['cancelOrder']; setStop: PlayProps['setStop']; toast: (m: string) => void }) {
  const [point, setPoint] = useState<number | null>(stock.history.length ? stock.history[stock.history.length - 1].round : null);
  /* 그래프 종류: 1초 선 · 10초봉 · 일봉(라운드 하나가 하루). 고른 값은 이 기기에 저장합니다. */
  const hasTicks = !!stock.ticks && stock.ticks.length > 1;
  const [chart, setChart] = useState<'line' | 'candle' | 'day'>(() => {
    try { const v = localStorage.getItem('tteoksang:chart'); return v === 'candle' || v === 'day' ? v : 'line'; } catch { return 'line'; }
  });
  const pickChart = (m: 'line' | 'candle' | 'day') => { setChart(m); try { localStorage.setItem('tteoksang:chart', m); } catch { /* 저장 못 해도 됨 */ } };
  const news = view.news.find(r => r.round === view.round)?.cards ?? [];
  const related = news.filter(c => c.card.targets.includes(stock.code));
  const breakingHeadline = news.find(c => c.card.breaking)?.card.headline;
  const breaking = view.breakingAt !== undefined && breakingHeadline ? { tick: view.breakingAt, headline: breakingHeadline } : null;
  const fills = (view.portfolio?.fillLog ?? []).flatMap(f =>
    f.round === view.round && f.code === stock.code && f.tick !== undefined
      ? [{ tick: f.tick, side: f.side, qty: f.qty, price: f.price }] : []);
  const held = view.portfolio?.holdings.find(h => h.code === stock.code);
  const pointData = stock.history.find(h => h.round === point);
  const intro = coach?.target === stock.code && (view.phase === 'news' || view.phase === 'trade');
  const order = view.you.role === 'player' && <OrderPanel stock={stock} view={view} left={left} place={place} cancel={cancel} toast={toast} intro={intro} />;
  const details = <>
      <p className="hint"><Rich text={`${GROUPS[stockOf(stock.code).group].label} 업종 · ${stock.sector}${stockOf(stock.code).linkBeta === 1 ? ' · 대장주' : ''}`} /></p>
      <p className="hint">{stock.desc}</p>
      <CompanyInfo stock={stock} />
      {view.phase === 'trade' && stock.ticks
        ? <p className="bigpx num">{stock.price.toLocaleString('ko-KR')}원 <small className={dir(intradayBp(stock))}>{arrow(intradayBp(stock))} {pctBp(intradayBp(stock))} <span className="hint">오늘</span></small></p>
        : <p className="bigpx num">{stock.price.toLocaleString('ko-KR')}원 {stock.lastChangeBp !== null && <small className={dir(stock.lastChangeBp)}>{arrow(stock.lastChangeBp)} {pctBp(stock.lastChangeBp)}</small>}</p>}
      <div className="seg mini" role="group" aria-label="그래프 종류">
        <button aria-pressed={chart === 'line'} disabled={!hasTicks} onClick={() => pickChart('line')}>1초</button>
        <button aria-pressed={chart === 'candle'} disabled={!hasTicks} onClick={() => pickChart('candle')}>10초봉</button>
        <button aria-pressed={chart === 'day'} onClick={() => pickChart('day')}>일봉</button>
      </div>
      {chart !== 'day' && hasTicks
        ? <LiveChart stock={stock} steps={view.phase === 'trade' ? view.phaseSeconds : stock.ticks!.length - 1} closing={view.phase === 'recap' ? stock.history[stock.history.length - 1] ?? null : null} breaking={breaking} fills={fills} mode={chart} />
        : <PriceChart stock={stock} totalRounds={view.totalRounds} selected={point} onSelect={setPoint} live={view.phase === 'trade' || view.phase === 'settling'} />}
      {pointData ? <BreakdownPanel b={pointData} /> : <p className="hint">주문 시간 동안 시세가 1초마다 움직이고, 장 마감 때 뉴스 결과가 공개되면 크게 움직여요. 첫 결과가 나오면 봉을 눌러 이유를 볼 수 있어요.</p>}
      {related.length > 0 && view.phase !== 'recap' && <p className="hint">관련 뉴스: {related.map(r => r.card.headline).join(', ')}</p>}
      {held && <p className="hint">보유 {held.qty.toLocaleString('ko-KR')}주 · <TermLink id="avg-cost">평균</TermLink> {won(held.avgCost)} · <TermLink id="unrealized-pnl">평가손익</TermLink> <span className={dir(held.pnl)}>{signedWon(held.pnl)}</span></p>}
      {held && view.level === 'pro' && view.you.role === 'player' && view.status === 'playing' && <StopEditor key={`${held.stop}-${held.take}`} held={held} price={stock.price} setStop={setStop} toast={toast} />}
  </>;
  return (
    <Sheet title={stock.name} onClose={onClose}>
      <button type="button" className="ghost small favorite-toggle" aria-pressed={favorite} onClick={onFavorite}>
        <span aria-hidden="true">{favorite ? '★' : '☆'}</span> 관심종목
      </button>
      {coach?.no === 3 && <>
        <Coach step={coach} />
        <button className="ghost" onClick={onWatch}>이번에는 지켜보기</button>
      </>}
      {intro ? <>
        {order}
        <details className="more"><summary>차트·기업 정보</summary>{details}</details>
      </> : <>{details}{order}</>}
    </Sheet>
  );
}

export function OrderPanel({ stock, view, left, place, cancel, toast, intro }: { stock: StockView; view: RoomView; left: number; place: PlayProps['placeOrder']; cancel: PlayProps['cancelOrder']; toast: (m: string) => void; intro: boolean }) {
  const pf = view.portfolio!;
  const existing = pf.orders.find(o => o.code === stock.code) ?? null;
  const [side, setSide] = useState<Side>('buy');
  /* 쉬움 난이도에서는 지정가·호가창·슬리피지 숫자를 감추고 시장가만 씁니다 */
  const easy = view.level === 'easy';
  const [kindPick, setKind] = useState<OrderKind>('market');
  const kind: OrderKind = easy ? 'market' : kindPick;
  const [qty, setQty] = useState('');
  const [limitText, setLimitText] = useState('');
  const [busy, setBusy] = useState(false);
  const open = view.phase === 'trade' && left > 0;
  const heldQty = pf.holdings.find(h => h.code === stock.code)?.qty ?? 0;
  const ctx = useMemo(() => ({ cash: pf.cash, holdings: {}, orders: Object.fromEntries(pf.orders.map(o => [o.code, o])) as Partial<Record<StockCode, Order>> }), [pf.cash, pf.orders]);
  const lo = lowerLimit(stock.openPrice), hi = upperLimit(stock.openPrice);
  const book = useMemo(() => quoteBook(stock.code, stock.price, stock.openPrice, view.round, Math.max(0, (stock.ticks?.length ?? 1) - 1)), [stock.code, stock.price, stock.openPrice, view.round, stock.ticks?.length]);
  const lim = Math.floor(Number(limitText) || 0);
  const limitOk = lim >= lo && lim <= hi && lim % 10 === 0;
  const isLimit = kind === 'limit';
  const lockedSell = !isLimit && existing?.side === 'sell' ? existing.qty : 0;
  const max = side === 'buy'
    ? (isLimit ? (limitOk ? maxBuyQty(ctx, stock.code, stock.price, { limit: lim }) : 0) : maxBuyQty(ctx, stock.code, stock.price, { replace: false, book }))
    : Math.max(0, heldQty - lockedSell);
  const n = Math.floor(Number(qty) || 0);
  const mf = isLimit ? null : marketFill(book, side, n);
  const fp = isLimit ? { price: lim, slipBp: 0, best: lim } : mf ?? { price: 0, slipBp: 0, best: 0 };
  const gross = n * fp.price, commission = feeOf(gross), tax = side === 'sell' ? taxOf(gross) : 0, fee = commission + tax;
  const slipWon = isLimit ? 0 : Math.abs(fp.price - fp.best) * n;
  const bestBid = book.bids[0]?.price ?? null;
  const marketable = isLimit && limitOk && (side === 'buy' ? stock.price <= lim : bestBid !== null && bestBid >= lim);
  const pickLevel = (price: number) => { setKind('limit'); setLimitText(String(price)); };
  const chooseKind = (k: OrderKind) => { setKind(k); if (k === 'limit' && !limitText) setLimitText(String(stock.price)); };
  const nudge = (d: number) => setLimitText(String(Math.min(hi, Math.max(lo, (limitOk ? lim : stock.price) + d))));
  const submit = async () => {
    setBusy(true);
    const res = await place(stock.code, side, n, kind, isLimit ? lim : undefined);
    setBusy(false);
    if (!res.ok) { toast(res.reason ?? '주문하지 못했습니다'); return; }
    if (!res.fill) play('book');
    setQty('');
    if (res.fill) toast(`체결 · ${res.fill.side === 'buy' ? '매수' : '매도'} ${res.fill.qty.toLocaleString('ko-KR')}주 × ${won(res.fill.price)}`);
    else toast('지정가 예약 완료 · 시세가 닿으면 체결돼요');
  };
  const doCancel = async () => {
    setBusy(true);
    const res = await cancel(stock.code);
    setBusy(false);
    toast(res.ok ? '예약을 취소했습니다' : res.reason ?? '취소하지 못했습니다');
  };
  if (!open && view.phase !== 'news') return <p className="hint strong">이번 라운드 장 마감</p>;
  const sideLabel = side === 'buy' ? '매수' : '매도';
  const bookPanel = !easy && view.phase === 'trade' && <OrderBook book={book} price={stock.price} open={stock.openPrice} onPick={pickLevel} />;
  const kindPanel = !easy && <div className="seg kind" role="group" aria-label="주문 방식">
    <button aria-pressed={kind === 'market'} onClick={() => chooseKind('market')}>시장가 · 바로 체결</button>
    <button aria-pressed={kind === 'limit'} onClick={() => chooseKind('limit')}>지정가 · 예약</button>
  </div>;
  return (
    <div className="order">
      {existing && <div className="booked">
        <p><b>{existing.side === 'buy' ? '매수' : '매도'} {existing.qty.toLocaleString('ko-KR')}주 · 지정가 {won(existing.price)}</b> 예약 중 · 시세가 닿으면 체결, 안 닿으면 마감 때 자동 취소</p>
        <button className="ghost small" disabled={!open || busy} onClick={doCancel}>예약 취소</button>
      </div>}
      {!intro && bookPanel}
      <div className="seg side"><button data-s="buy" aria-pressed={side === 'buy'} onClick={() => { setSide('buy'); setQty(''); }}>매수</button><button data-s="sell" aria-pressed={side === 'sell'} onClick={() => { setSide('sell'); setQty(''); }}>매도</button></div>
      {easy ? null : intro ? <details className="more"><summary>주문 방식·호가창</summary>{kindPanel}{bookPanel}</details> : kindPanel}
      {isLimit && <>
        <label htmlFor="order-limit" className="hint"><TermLink id="limit-order">지정가</TermLink> · 오늘 가능 범위 {won(lo)}~{won(hi)}</label>
        <div className="stepper">
          <button aria-label="지정가 10원 내리기" onClick={() => nudge(-10)}>−</button>
          <input id="order-limit" inputMode="numeric" value={limitText} onChange={e => setLimitText(e.target.value.replace(/\D/g, ''))} />
          <button aria-label="지정가 10원 올리기" onClick={() => nudge(10)}>+</button>
        </div>
        {!limitOk && limitText && <p className="error">10원 단위로, 가능 범위 안에서 정해 주세요</p>}
      </>}
      <label htmlFor="order-qty" className="hint">수량 · {side === 'buy' ? '최대' : '팔 수 있는 수량'} {max.toLocaleString('ko-KR')}주</label>
      <div className="stepper">
        <button aria-label="1주 빼기" onClick={() => setQty(String(Math.max(0, n - 1)))}>−</button>
        <input id="order-qty" inputMode="numeric" value={qty} placeholder="0" onChange={e => setQty(e.target.value.replace(/\D/g, ''))} />
        <button aria-label="1주 더하기" onClick={() => setQty(String(n + 1))}>+</button>
      </div>
      <div className="pcts">{([[0.1, '10%'], [0.25, '25%'], [0.5, '50%'], [1, '최대']] as const).map(([r, label]) => <button key={label} onClick={() => setQty(String(Math.floor(max * r)))}>{label}</button>)}</div>
      <dl className="kv">
        <dt>지금 시세</dt><dd>{won(stock.price)}</dd>
        {!isLimit && !easy && <><dt>{side === 'buy' ? '최우선 매도 호가' : '최우선 매수 호가'}</dt><dd>{mf ? won(mf.best) : '없음'}</dd></>}
        {isLimit
          ? <><dt>지정가</dt><dd>{limitOk ? won(lim) : '—'}</dd></>
          : <><dt>예상 체결가</dt><dd>{won(fp.price)}</dd>
            {!easy && <><dt><TermLink id="slippage">슬리피지</TermLink>{fp.slipBp ? ` ${fp.slipBp}bp` : ''}</dt><dd>{slipWon ? `${side === 'buy' ? '+' : '−'}${won(slipWon)}` : '없음'}</dd></>}</>}
        <dt>주문 금액</dt><dd>{won(gross)}</dd>
        <dt><TermLink id="fee">수수료</TermLink> 0.10%</dt><dd>{won(commission)}</dd>
        {side === 'sell' && <><dt><TermLink id="transaction-tax">증권거래세</TermLink> 0.20%</dt><dd>{won(tax)}</dd></>}
        <dt className="total">{side === 'buy' ? (isLimit ? '묶어 둘 돈(예약금)' : '빠져나갈 돈') : '받을 돈'}</dt><dd className="total">{won(side === 'buy' ? gross + fee : Math.max(0, gross - fee))}</dd>
      </dl>
      {n > max && <p className="error">가능한 수량을 넘었어요</p>}
      <p className="hint">{easy
        ? (side === 'buy' ? '지금 시세로 바로 체결돼요. 한 번에 많이 사면 체결가가 조금 올라갈 수 있어요.' : '지금 시세로 바로 팔려요. 파는 값은 시세보다 한 칸(10원) 낮은 값부터 시작해요.')
        : isLimit
          ? (marketable ? '지금 시세가 지정가보다 유리해서 바로 체결돼요.' : '시세가 지정가에 닿으면 그 가격에 체결돼요. 장 마감까지 안 닿으면 자동 취소돼요.' + (existing ? ' 이 종목의 기존 예약은 새 예약으로 바뀌어요.' : ''))
          : side === 'buy' ? '가장 싼 매도 호가부터 차례로 사요. 수량이 많으면 더 비싼 호가까지 사게 돼요(슬리피지).' : `가장 비싼 매수 호가부터 차례로 팔아요. 시세보다 한 칸(10원) 낮은 값부터 시작해요(스프레드).`}</p>
      {!isLimit && !mf && <p className="error">{side === 'sell' ? '사려는 주문이 없어 지금은 시장가로 팔 수 없어요(하한가).' : '팔려는 주문이 없어 지금은 시장가로 살 수 없어요.'}</p>}
      <button className={`go ${side}`} disabled={!open || busy || n < 1 || n > max || (isLimit && !limitOk) || (!isLimit && !mf)} onClick={submit}>{view.phase === 'news' ? `${Math.ceil(left)}초 후 장 시작` : busy ? '요청 중' : `${isLimit && limitOk ? `${won(lim)}에 ` : ''}${n > 0 ? `${n.toLocaleString('ko-KR')}주 ` : ''}${sideLabel}${isLimit && !marketable ? ' 예약' : ''}`}</button>
    </div>
  );
}
/** 호가창: 위(파랑)는 팔려는 주문, 아래(빨강)는 사려는 주문. 가격을 누르면 그 가격으로 지정가를 채웁니다. */
/** 손절·익절 자동 주문 설정. 가격을 직접 넣거나 평균 단가 대비 ±5%·±10%를 고릅니다. */

export function StopEditor({ held, price, setStop, toast }: { held: NonNullable<RoomView['portfolio']>['holdings'][number]; price: number; setStop: PlayProps['setStop']; toast: (m: string) => void }) {
  const [stop, setStopText] = useState(held.stop ? String(held.stop) : '');
  const [take, setTakeText] = useState(held.take ? String(held.take) : '');
  const [busy, setBusy] = useState(false);
  const round10 = (v: number) => Math.round(v / 10) * 10;
  const ns = stop ? Math.floor(Number(stop)) : null, nt = take ? Math.floor(Number(take)) : null;
  const err = ns !== null && (ns >= price || ns % 10) ? '손절가는 지금 시세보다 낮게, 10원 단위로' : nt !== null && (nt <= price || nt % 10) ? '익절가는 지금 시세보다 높게, 10원 단위로' : '';
  const save = async (s: number | null, t: number | null) => {
    setBusy(true);
    const r = await setStop(held.code, s, t);
    setBusy(false);
    toast(r.ok ? (s === null && t === null ? '손절·익절을 해제했어요' : '손절·익절을 걸었어요') : r.reason ?? '설정하지 못했습니다');
  };
  const on = held.stop || held.take;
  return (
    <details className="company stops" open={!!on}>
      <summary>손절·익절 자동 주문{on ? ` · ${held.stop ? `손절 ${won(held.stop)}` : ''}${held.stop && held.take ? ' · ' : ''}${held.take ? `익절 ${won(held.take)}` : ''}` : ''}</summary>
      <p className="hint">시세가 정한 값에 닿으면 가진 수량 전부를 그 순간 <TermLink id="market-order">시장가</TermLink>로 팔아요. 결과 공개로 값이 건너뛰면 정한 값보다 불리하게 팔릴 수 있어요.</p>
      <div className="stop-grid">
        <label><span><TermLink id="stop-loss">손절가</TermLink></span><input inputMode="numeric" value={stop} placeholder="없음" onChange={e => setStopText(e.target.value.replace(/\D/g, ''))} /></label>
        <div className="pcts">{[5, 10].map(pc => <button key={pc} onClick={() => setStopText(String(round10(held.avgCost * (100 - pc) / 100)))}>평균 −{pc}%</button>)}</div>
        <label><span><TermLink id="take-profit">익절가</TermLink></span><input inputMode="numeric" value={take} placeholder="없음" onChange={e => setTakeText(e.target.value.replace(/\D/g, ''))} /></label>
        <div className="pcts">{[5, 10].map(pc => <button key={pc} onClick={() => setTakeText(String(round10(held.avgCost * (100 + pc) / 100)))}>평균 +{pc}%</button>)}</div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="btn-row">
        <button className="ghost" disabled={busy || !!err || (ns === null && nt === null)} onClick={() => save(ns, nt)}>걸기</button>
        {on && <button className="ghost" disabled={busy} onClick={() => { setStopText(''); setTakeText(''); save(null, null); }}>해제</button>}
      </div>
    </details>
  );
}
export function OrderBook({ book, price, open, onPick }: { book: QuoteBook; price: number; open: number; onPick: (p: number) => void }) {
  const asks = book.asks.slice(0, BOOK_SHOW).reverse(), bids = book.bids.slice(0, BOOK_SHOW);
  const maxQ = Math.max(1, ...asks.map(a => a.qty), ...bids.map(b => b.qty));
  const pctOf = (p: number) => { const bp = Math.round((p - open) * 10000 / open); return `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${(Math.abs(bp) / 100).toFixed(2)}%`; };
  const row = (l: { price: number; qty: number }, kind: 'ask' | 'bid') => (
    <tr key={`${kind}${l.price}`} className={`${kind}${l.price === price ? ' now' : ''}`}>
      <td>{kind === 'ask' && <><i style={{ width: `${Math.round(l.qty / maxQ * 100)}%` }} />{l.qty.toLocaleString('ko-KR')}</>}</td>
      <td><button type="button" className="lvl" onClick={() => onPick(l.price)} aria-label={`${l.price.toLocaleString('ko-KR')}원으로 지정가 채우기`}><b className="num">{l.price.toLocaleString('ko-KR')}</b><small>{pctOf(l.price)}</small></button></td>
      <td>{kind === 'bid' && <><i style={{ width: `${Math.round(l.qty / maxQ * 100)}%` }} />{l.qty.toLocaleString('ko-KR')}</>}</td>
    </tr>
  );
  return (
    <figure className="qbook">
      <table aria-label="호가창">
        <thead><tr><th>팔려는 수량</th><th>가격</th><th>사려는 수량</th></tr></thead>
        <tbody>{asks.map(a => row(a, 'ask'))}{bids.map(b => row(b, 'bid'))}</tbody>
      </table>
      <figcaption className="chart-note"><TermLink id="order-book">호가창</TermLink> · 가격을 누르면 그 값으로 <TermLink id="limit-order">지정가</TermLink>를 채워요. 상대방은 가상 시장이고, 수량은 1초마다 바뀌어요.</figcaption>
    </figure>
  );
}
/** 떡상 지수: 이번 판 10종목의 시가총액 가중 지수(시작 1,000). 라운드 종료 값과 지금 값을 작은 그래프로 */
/** 배당 일정 안내: 기준일 전·당일·배당락 라운드에 보여 줍니다. */
/** 장중 속보가 뜨면 화면 위에서 큼직하게 내려옵니다. 주문을 막지 않도록 아래쪽은 그대로 쓸 수 있고, 5초 뒤 저절로 닫힙니다. */

export function CompanyInfo({ stock }: { stock: StockView }) {
  const f = fundOf(stock.code), per = perOf(stock.code, stock.price), dy = dividendYieldBp(stock.code, stock.price);
  return (
    <details className="company">
      {/* 요약 줄에 시가총액·PER을 적어 두면 처음 하는 사람에게 읽을 숫자만 늘어서 안으로 넣었습니다(2026-11 결정) */}
      <summary>기업 정보 · 지난해 실적과 PER</summary>
      <dl className="kv">
        <dt>발행 주식 수</dt><dd className="num">{(f.shares / 10000).toLocaleString('ko-KR')}만 주</dd>
        <dt><TermLink id="market-cap">시가총액</TermLink></dt><dd className="num">{formatEok(marketCapWon(stock.code, stock.price))}</dd>
        <dt>지난해 <TermLink id="net-income">순이익</TermLink></dt><dd className={`num ${f.netIncome < 0 ? 'down' : ''}`}>{f.netIncome < 0 ? `−${Math.abs(f.netIncome).toLocaleString('ko-KR')}억 원(적자)` : `${f.netIncome.toLocaleString('ko-KR')}억 원`}</dd>
        <dt><TermLink id="per">PER</TermLink></dt><dd className="num">{per === null ? '적자라 계산하지 않음' : `${per}배`}</dd>
        <dt>주당 <TermLink id="dividend">배당금</TermLink></dt><dd className="num">{f.dps ? `${f.dps.toLocaleString('ko-KR')}원 · ` : '없음'}{f.dps ? <><TermLink id="dividend-yield">배당수익률</TermLink> {pctBp(dy)}</> : null}</dd>
      </dl>
      <p className="hint">가상 기업의 지어낸 숫자입니다. PER은 지금 주가로 계산해서 주가가 오르면 함께 올라갑니다.</p>
    </details>
  );
}
