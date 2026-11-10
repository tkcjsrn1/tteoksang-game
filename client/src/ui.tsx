import { useState } from 'react';
import { DISCLAIMER, formatPct, GROUPS, STOCKS } from '../../shared/rules';
import type { PriceBreakdown, StockView } from '../../shared/types';
import { Rich, TermLink } from './glossary/GlossaryContext';
import { replayAt, replayPath, replayTicks, useReplay } from './fx';
import { bucketCandles, movingAverage } from './live';

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
export const signedWon = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`;
export const pctBp = (bp: number) => formatPct(bp, 2);
export const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}%`;
export const dir = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
export const arrow = (x: number) => (x > 0 ? '▲' : x < 0 ? '▼' : '·');

export function Disclaimer() { return <p className="disclaimer">{DISCLAIMER}</p>; }

/** 로고: 파란 상승 화살표 + 이름 */
export function Logo() {
  return (
    <p className="logo"><span className="logo-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
    </span>떡상개론</p>
  );
}
export function Chevron() {
  return <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;
}
/** 종목 머리글자 동그라미. 같은 업종은 같은 색입니다. */
const avatarColor = (code: string) => { const s = STOCKS.find(x => x.code === code); return s ? GROUPS[s.group].color : '#8B95A1'; };
export function StockAvatar({ code, name }: { code: string; name: string }) {
  return <span className="avatar" style={{ background: avatarColor(code) }} aria-hidden="true">{name[0]}</span>;
}

export const bpText = (bp: number) => `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${Math.abs(bp).toLocaleString('ko-KR')}bp`;

/** 그래프 점을 눌렀을 때 보여 주는 변동 근거 */
export function BreakdownPanel({ b }: { b: PriceBreakdown }) {
  return (
    <div className="breakdown">
      <p className="bd-title">R{String(b.round).padStart(2, '0')} · {b.summary}</p>
      <dl className="kv">
        <dt><TermLink id="reference-price">이전가</TermLink></dt><dd className="num">{won(b.basePrice)}</dd>
        <dt><TermLink id="close-price">종료가</TermLink></dt><dd className="num">{won(b.closePrice)}</dd>
        {b.high !== undefined && b.low !== undefined && <><dt><TermLink id="high-low">고가·저가</TermLink></dt><dd className="num">{won(b.high)} · {won(b.low)}</dd></>}
        {b.preClose !== undefined && <><dt>장 마감 직전 시세</dt><dd className="num">{won(b.preClose)}</dd>
          <dt>결과 공개로 움직인 몫</dt><dd className={`num ${dir(b.closePrice - b.preClose)}`}>{signedWon(b.closePrice - b.preClose)} ({pctBp(Math.round((b.closePrice - b.preClose) * 10000 / b.preClose))})</dd></>}
        {b.volume !== undefined && <><dt><TermLink id="volume">거래량</TermLink></dt><dd className="num">{b.volume.toLocaleString('ko-KR')}주{b.volume > 0 ? ` (매수 ${(b.buyQty ?? 0).toLocaleString('ko-KR')} · 매도 ${(b.sellQty ?? 0).toLocaleString('ko-KR')})` : ''}</dd></>}
        <dt>실제 <TermLink id="change-rate">등락률</TermLink></dt><dd className={`num ${dir(b.changeBp)}`}>{arrow(b.changeBp)} {pctBp(b.changeBp)}</dd>
      </dl>
      <h4>변동 근거</h4>
      <ul className="bd-list">
        {b.events.map((e, i) => <li key={i}><span><b>{e.label}</b><small><Rich text={e.reason} /></small></span><span className={`num ${dir(e.bp)}`}>{bpText(e.bp)}</span></li>)}
        {!b.events.length && <li><span>이 종목에 직접 영향을 준 사건은 없었습니다</span></li>}
        <li><span><TermLink id="systematic-risk">공통 시장 변동</TermLink></span><span className={`num ${dir(b.marketBp)}`}>{bpText(b.marketBp)}</span></li>
        <li><span><TermLink id="volatility">종목 변동</TermLink></span><span className={`num ${dir(b.stockBp)}`}>{bpText(b.stockBp)}</span></li>
        <li className="bd-sum"><span>합계</span><span className={`num ${dir(b.rawBp)}`}>{bpText(b.rawBp)}</span></li>
      </ul>
      {b.exDividend && <p className="note"><TermLink id="ex-dividend">배당락</TermLink>으로 이전가가 배당금 {won(b.exDividend)}만큼 낮아진 뒤 시작한 라운드입니다.</p>}
      {b.capped && <p className="note">±2,000<TermLink id="bp">bp</TermLink> 제한이 적용되어 합계 {bpText(b.rawBp)} 대신 {bpText(b.cappedBp)}을 썼습니다.</p>}
      {b.limit && <p className="note"><TermLink id="price-limit">{b.limit === 'upper' ? '상한가' : '하한가'}</TermLink> {won(b.limit === 'upper' ? b.upperLimit : b.lowerLimit)}가 적용되었습니다.</p>}
      {b.roundingWon !== 0 && <p className="note">10원 단위 반올림으로 가격이 {signedWon(b.roundingWon)} 조정되어, 실제 등락률이 합계와 조금 다를 수 있습니다.</p>}
    </div>
  );
}

/** 라운드 봉 차트. 한 라운드가 봉 하나입니다.
    시가 = 라운드 시작 가격, 고가·저가 = 1초 시세와 종료가 중 최고·최저, 종가 = 결과 공개 뒤 종료가.
    주문 시간에는 지금까지의 시세로 만들어지는 중인 봉을 점선으로 그립니다.
    아래 막대는 라운드별 체결 수량(거래량)입니다. 매수가 많으면 빨강, 매도가 많으면 파랑.
    봉을 누르면 그 라운드의 변동 이유를 봅니다. */
export function PriceChart({ stock, totalRounds, selected, onSelect, live = false }: { stock: StockView; totalRounds: number; selected: number | null; onSelect: (round: number) => void; live?: boolean }) {
  const W = 340, H = 214, L = 8, R = 78, T = 14, B = 22;   /* R: 오른쪽 가격 라벨 자리. 좁으면 '시작 12,400'이 잘립니다 */
  const VOL = 30, GAP = 6;                                    /* 아래 거래량 막대 영역 */
  const PB = B + VOL + GAP;                                   /* 가격 영역의 아래 여백 */
  const candles = stock.history.map(h => ({ round: h.round, open: h.basePrice, close: h.closePrice, high: h.high ?? Math.max(h.basePrice, h.closePrice), low: h.low ?? Math.min(h.basePrice, h.closePrice), volume: h.volume ?? 0, buy: h.buyQty ?? 0, sell: h.sellQty ?? 0 }));
  /* 만들어지는 중인 봉: 주문 시간·집계 중에 장중 시세가 있고, 아직 이 라운드 기록이 없을 때 */
  const forming = live && stock.ticks && stock.ticks.length
    ? { round: stock.history.length + 1, open: stock.ticks[0], close: stock.ticks[stock.ticks.length - 1], high: Math.max(...stock.ticks), low: Math.min(...stock.ticks) } : null;
  const vals = [stock.startPrice, ...candles.flatMap(c => [c.high, c.low]), ...(forming ? [forming.high, forming.low] : [])];
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const pad = Math.max((hi0 - lo0) * .1, stock.startPrice * .02);
  const lo = lo0 - pad, hi = hi0 + pad;
  const slot = (W - L - R) / (totalRounds + 0.5);
  const x = (r: number) => L + slot * (r - 0.25);
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - PB);
  const maxVol = Math.max(0, ...stock.history.map(h => h.volume ?? 0));
  const volH = (v: number) => maxVol > 0 ? Math.max(v > 0 ? 2 : 0, v / maxVol * VOL) : 0;
  const bw = Math.min(16, slot * 0.55);
  const last = candles[candles.length - 1];
  const lastPrice = last ? last.close : stock.startPrice;
  const lastColor = lastPrice >= stock.startPrice ? 'var(--up)' : 'var(--down)';
  const colorOf = (c: { open: number; close: number }) => c.close > c.open ? 'var(--up)' : c.close < c.open ? 'var(--down)' : 'var(--faint)';
  return (
    <figure className="chart-fig">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stock.name} 라운드별 봉 차트`}>
        <line x1={L} x2={W - R} y1={y(stock.startPrice)} y2={y(stock.startPrice)} stroke="var(--chev)" strokeDasharray="3 3" strokeWidth=".8" />
        <text x={W - R + 6} y={y(stock.startPrice) + 4} fontSize="11" fill="var(--muted)">시작 {stock.startPrice.toLocaleString('ko-KR')}</text>
        {Array.from({ length: totalRounds }, (_, i) => i + 1).filter(r => totalRounds <= 5 || r % 2 === 1).map(r => <text key={r} x={x(r)} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--muted)">R{r}</text>)}
        {candles.map(c => {
          const col = colorOf(c), top = Math.max(c.open, c.close), bottom = Math.min(c.open, c.close);
          const label = `${c.round}라운드: 시가 ${c.open.toLocaleString('ko-KR')}원, 종가 ${c.close.toLocaleString('ko-KR')}원, 고가 ${c.high.toLocaleString('ko-KR')}원, 저가 ${c.low.toLocaleString('ko-KR')}원, 거래량 ${c.volume.toLocaleString('ko-KR')}주. 변동 이유 보기`;
          return (
            <g key={c.round} onClick={() => onSelect(c.round)} role="button" aria-label={label} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(c.round); }} style={{ cursor: 'pointer' }}>
              <rect x={x(c.round) - slot / 2} y={T - 6} width={slot} height={H - T - B + 10} rx="6" fill={selected === c.round ? 'var(--led-soft)' : 'transparent'} />
              {c.volume > 0 && <rect x={x(c.round) - bw / 2} y={H - B - volH(c.volume)} width={bw} height={volH(c.volume)} rx="1.5" fill={c.buy >= c.sell ? 'var(--up)' : 'var(--down)'} opacity=".35" />}
              <line x1={x(c.round)} x2={x(c.round)} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth="1.5" />
              <rect x={x(c.round) - bw / 2} y={y(top)} width={bw} height={Math.max(2, y(bottom) - y(top))} rx="2" fill={col} />
            </g>
          );
        })}
        {forming && (() => {
          const col = colorOf(forming), top = Math.max(forming.open, forming.close), bottom = Math.min(forming.open, forming.close);
          return <g aria-label={`${forming.round}라운드 진행 중: 시가 ${forming.open.toLocaleString('ko-KR')}원, 지금 ${forming.close.toLocaleString('ko-KR')}원`}>
            <line x1={x(forming.round)} x2={x(forming.round)} y1={y(forming.high)} y2={y(forming.low)} stroke={col} strokeWidth="1.5" strokeDasharray="2 2" />
            <rect x={x(forming.round) - bw / 2} y={y(top)} width={bw} height={Math.max(2, y(bottom) - y(top))} rx="2" fill="var(--panel)" stroke={col} strokeWidth="1.5" strokeDasharray="3 2" />
          </g>;
        })()}
        {last && !forming && Math.abs(y(lastPrice) - y(stock.startPrice)) > 13 && <text x={W - R + 6} y={y(lastPrice) + 4} fontSize="12" fontWeight="700" fill={lastColor}>{lastPrice.toLocaleString('ko-KR')}</text>}
      </svg>
      <figcaption className="chart-note">
        <span className="legend up" aria-hidden="true" /> 오름 <span className="legend down" aria-hidden="true" /> 내림 ·{' '}
        <TermLink id="candle">봉</TermLink> 하나가 라운드 하나예요. 점선 봉은 지금 만들어지는 중이에요. 아래 막대는 <TermLink id="volume">거래량</TermLink>. 봉을 누르면 이유가 나와요.
      </figcaption>
    </figure>
  );
}

/** 결과 화면의 봉 재생. 이번 라운드 1초 시세를 빠르게 다시 보여 주고, 마지막에 결과 공개로 종료가까지 움직입니다.
    예전 기록처럼 시세가 없으면 시가→꼬리→종가 순서의 단순 경로(연출)를 씁니다(client/src/fx.ts replayAt). */
export function CandleReplay({ b, name, ticks }: { b: PriceBreakdown; name: string; ticks?: number[] }) {
  const high = b.high ?? Math.max(b.basePrice, b.closePrice), low = b.low ?? Math.min(b.basePrice, b.closePrice);
  const { t, replay } = useReplay(ticks && ticks.length > 1 ? 3200 : 2400);
  const real = ticks && ticks.length > 1 ? [...ticks, b.closePrice] : null;
  const now = real ? replayTicks(real, t) : replayAt(replayPath(b.basePrice, high, low, b.closePrice), t);
  const W = 300, H = 132, T = 12, Bm = 12, cx = 70, bw = 28;
  const pad = Math.max((high - low) * .12, b.basePrice * .004);
  const hi = high + pad, lo = low - pad;
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - Bm);
  const col = now.price > b.basePrice ? 'var(--up)' : now.price < b.basePrice ? 'var(--down)' : 'var(--faint)';
  const chg = Math.round((now.price - b.basePrice) * 10000 / b.basePrice);
  const revealed = real ? t >= 1 : true;
  return (
    <figure className="replay">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} 이번 라운드 봉: 시가 ${b.basePrice.toLocaleString('ko-KR')}원, 고가 ${high.toLocaleString('ko-KR')}원, 저가 ${low.toLocaleString('ko-KR')}원, 종가 ${b.closePrice.toLocaleString('ko-KR')}원`}>
        <line x1={cx - 40} x2={W - 8} y1={y(b.basePrice)} y2={y(b.basePrice)} stroke="var(--chev)" strokeDasharray="3 3" strokeWidth=".8" />
        <text x={W - 8} y={y(b.basePrice) - 4} fontSize="11" textAnchor="end" fill="var(--muted)">시가 {b.basePrice.toLocaleString('ko-KR')}</text>
        <line x1={cx} x2={cx} y1={y(now.high)} y2={y(now.low)} stroke={col} strokeWidth="2" />
        <rect x={cx - bw / 2} y={y(Math.max(b.basePrice, now.price))} width={bw} height={Math.max(2, Math.abs(y(now.price) - y(b.basePrice)))} rx="3" fill={col} />
        <line x1={cx + bw / 2 + 4} x2={cx + bw / 2 + 18} y1={y(now.price)} y2={y(now.price)} stroke={col} strokeWidth="1.5" />
        <text x={cx + bw / 2 + 22} y={y(now.price) + 5} fontSize="15" fontWeight="700" fill={col} className="num">{now.price.toLocaleString('ko-KR')}원 {chg > 0 ? '+' : chg < 0 ? '−' : ''}{(Math.abs(chg) / 100).toFixed(2)}%</text>
        {real && <text x={cx + bw / 2 + 22} y={y(now.price) + 22} fontSize="11" fill="var(--muted)">{revealed ? '결과 공개 뒤 종료가' : '장중 시세 재생'}</text>}
      </svg>
      <figcaption className="chart-note">
        <TermLink id="candle">봉</TermLink> 재생 · {real ? <>이번 라운드 1초 시세를 빠르게 다시 보여 주고, 마지막에 뉴스 결과 공개로 종료가까지 움직여요.</> : <>시가와 종가는 실제 계산값, 그 사이 움직임과 꼬리는 <b>연출</b>이에요.</>}{' '}
        {t >= 1 && <button type="button" className="link small" onClick={replay}>다시 보기</button>}
      </figcaption>
    </figure>
  );
}

/** 이번 라운드 장중 시세 그래프. 선(1초)과 10초봉을 고를 수 있고, 20초 이동평균선을 함께 그립니다.
    결과 시간에는 마지막에 결과 공개로 움직인 몫을 점선으로 이어 줍니다. */
const MA_SECONDS = 20, CANDLE_SECONDS = 10;
export function LiveChart({ stock, steps, closing }: { stock: StockView; steps: number; closing: PriceBreakdown | null }) {
  const [mode, setMode] = useState<'line' | 'candle'>(() => { try { return (localStorage.getItem('tteoksang:livemode') as 'line' | 'candle') ?? 'line'; } catch { return 'line'; } });
  const pick = (m: 'line' | 'candle') => { setMode(m); try { localStorage.setItem('tteoksang:livemode', m); } catch { /* 저장 못 해도 됨 */ } };
  const ticks = stock.ticks ?? [];
  const W = 340, H = 130, L = 8, R = 70, T = 12, B = 18;
  const n = Math.max(steps, ticks.length - 1, 1);
  const end = closing && closing.basePrice === ticks[0] ? closing.closePrice : null;
  const vals = [...ticks, ...(end !== null ? [end] : [])];
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const pad = Math.max((hi0 - lo0) * .12, ticks[0] * .003);
  const lo = lo0 - pad, hi = hi0 + pad;
  const x = (k: number) => L + (W - L - R) * k / (n + (end !== null ? 4 : 0));
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const last = ticks[ticks.length - 1];
  const col = last > ticks[0] ? 'var(--up)' : last < ticks[0] ? 'var(--down)' : 'var(--faint)';
  const path = (pts: [number, number][]) => pts.map(([k, v], i) => `${i ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ma = movingAverage(ticks, MA_SECONDS);
  const maPts = ma.map((v, k) => [k, v] as [number, number | null]).filter((p): p is [number, number] => p[1] !== null);
  const candles = mode === 'candle' ? bucketCandles(ticks, CANDLE_SECONDS) : [];
  const cw = Math.max(2, (x(CANDLE_SECONDS) - x(0)) * 0.6);
  return (
    <figure className="chart-fig live-chart">
      <div className="seg mini" role="group" aria-label="장중 그래프 모양">
        <button aria-pressed={mode === 'line'} onClick={() => pick('line')}>선(1초)</button>
        <button aria-pressed={mode === 'candle'} onClick={() => pick('candle')}>10초봉</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stock.name} 이번 라운드 시세: 시가 ${ticks[0].toLocaleString('ko-KR')}원, 지금 ${last.toLocaleString('ko-KR')}원${end !== null ? `, 결과 공개 뒤 ${end.toLocaleString('ko-KR')}원` : ''}`}>
        <line x1={L} x2={W - R} y1={y(ticks[0])} y2={y(ticks[0])} stroke="var(--chev)" strokeDasharray="3 3" strokeWidth=".8" />
        <text x={W - R + 6} y={y(ticks[0]) + 4} fontSize="11" fill="var(--muted)">시가 {ticks[0].toLocaleString('ko-KR')}</text>
        {mode === 'line' && <path d={path(ticks.map((v, k) => [k, v]))} fill="none" stroke={col} strokeWidth="1.8" strokeLinejoin="round" />}
        {mode === 'candle' && candles.map(c => {
          const cx = x(c.i * CANDLE_SECONDS + CANDLE_SECONDS / 2), cc = c.close > c.open ? 'var(--up)' : c.close < c.open ? 'var(--down)' : 'var(--faint)';
          return <g key={c.i}><line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={cc} strokeWidth="1.2" />
            <rect x={cx - cw / 2} y={y(Math.max(c.open, c.close))} width={cw} height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))} fill={cc} rx="1" /></g>;
        })}
        {maPts.length > 1 && <path d={path(maPts)} fill="none" stroke="var(--gold)" strokeWidth="1.4" opacity=".9" />}
        {mode === 'line' && <circle cx={x(ticks.length - 1)} cy={y(last)} r="3" fill={col} />}
        {end !== null && <>
          <line x1={x(ticks.length - 1)} x2={x(n + 4)} y1={y(last)} y2={y(end)} stroke={end >= last ? 'var(--up)' : 'var(--down)'} strokeWidth="1.8" strokeDasharray="4 3" />
          <circle cx={x(n + 4)} cy={y(end)} r="3.5" fill={end >= last ? 'var(--up)' : 'var(--down)'} />
          <text x={W - R + 6} y={y(end) + 4} fontSize="12" fontWeight="700" fill={end >= last ? 'var(--up)' : 'var(--down)'}>{end.toLocaleString('ko-KR')}</text>
        </>}
        {end === null && Math.abs(y(last) - y(ticks[0])) > 13 && <text x={W - R + 6} y={y(last) + 4} fontSize="12" fontWeight="700" fill={col}>{last.toLocaleString('ko-KR')}</text>}
        <text x={L} y={H - 4} fontSize="10" fill="var(--muted)">장 시작</text>
        <text x={x(n)} y={H - 4} fontSize="10" textAnchor="end" fill="var(--muted)">장 마감</text>
      </svg>
      <figcaption className="chart-note">이번 라운드 시세 · <span className="legend ma" aria-hidden="true" /> {MA_SECONDS}초 <TermLink id="moving-average">이동평균선</TermLink>{end !== null ? ' · 점선은 장 마감 뒤 뉴스 결과 공개로 움직인 몫' : ''}</figcaption>
    </figure>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(c => (c === m ? null : c)), 2200); };
  return { node: msg ? <div className="toast" role="status">{msg}</div> : null, show };
}
