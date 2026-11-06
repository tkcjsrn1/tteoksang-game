import { useState } from 'react';
import { DISCLAIMER, formatPct } from '../../shared/rules';
import type { PriceBreakdown, StockView } from '../../shared/types';

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
export const signedWon = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`;
export const pctBp = (bp: number) => formatPct(bp, 2);
export const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}%`;
export const dir = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
export const arrow = (x: number) => (x > 0 ? '▲' : x < 0 ? '▼' : '·');

export function Disclaimer() { return <p className="disclaimer">{DISCLAIMER}</p>; }

export const bpText = (bp: number) => `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${Math.abs(bp).toLocaleString('ko-KR')}bp`;

/** 그래프 점을 눌렀을 때 보여 주는 변동 근거 */
export function BreakdownPanel({ b }: { b: PriceBreakdown }) {
  return (
    <div className="breakdown">
      <p className="bd-title">R{String(b.round).padStart(2, '0')} · {b.summary}</p>
      <dl className="kv">
        <dt>이전가</dt><dd className="num">{won(b.basePrice)}</dd>
        <dt>종료가</dt><dd className="num">{won(b.closePrice)}</dd>
        <dt>실제 등락률</dt><dd className={`num ${dir(b.changeBp)}`}>{arrow(b.changeBp)} {pctBp(b.changeBp)}</dd>
      </dl>
      <h4>변동 근거</h4>
      <ul className="bd-list">
        {b.events.map((e, i) => <li key={i}><span><b>{e.label}</b><small>{e.reason}</small></span><span className={`num ${dir(e.bp)}`}>{bpText(e.bp)}</span></li>)}
        {!b.events.length && <li><span>이 종목에 직접 영향을 준 사건은 없었습니다</span></li>}
        <li><span>공통 시장 변동</span><span className={`num ${dir(b.marketBp)}`}>{bpText(b.marketBp)}</span></li>
        <li><span>종목 변동</span><span className={`num ${dir(b.stockBp)}`}>{bpText(b.stockBp)}</span></li>
        <li className="bd-sum"><span>합계</span><span className={`num ${dir(b.rawBp)}`}>{bpText(b.rawBp)}</span></li>
      </ul>
      {b.capped && <p className="note">±2,000bp 제한이 적용되어 합계 {bpText(b.rawBp)} 대신 {bpText(b.cappedBp)}을 썼습니다.</p>}
      {b.limit && <p className="note">{b.limit === 'upper' ? `상한가 ${won(b.upperLimit)}` : `하한가 ${won(b.lowerLimit)}`}가 적용되었습니다.</p>}
      {b.roundingWon !== 0 && <p className="note">10원 단위 반올림으로 가격이 {signedWon(b.roundingWon)} 조정되어, 실제 등락률이 합계와 조금 다를 수 있습니다.</p>}
    </div>
  );
}

/** 라운드 종료가 선 그래프. 가격은 마감 때만 찍히고, 점을 누르면 이유를 봅니다. */
export function PriceChart({ stock, totalRounds, selected, onSelect }: { stock: StockView; totalRounds: number; selected: number | null; onSelect: (round: number) => void }) {
  const W = 340, H = 170, L = 8, R = 58, T = 14, B = 22;
  const pts = [{ round: 0, price: stock.startPrice }, ...stock.history.map(h => ({ round: h.round, price: h.closePrice }))];
  const lo0 = Math.min(...pts.map(p => p.price)), hi0 = Math.max(...pts.map(p => p.price));
  const pad = Math.max((hi0 - lo0) * .12, stock.startPrice * .02);
  const lo = lo0 - pad, hi = hi0 + pad;
  const x = (r: number) => L + r / totalRounds * (W - L - R), y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const line = pts.map(p => `${x(p.round).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const color = last.price >= stock.startPrice ? 'var(--up)' : 'var(--down)';
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stock.name} 라운드별 종료가`}>
      <line x1={L} x2={W - R} y1={y(stock.startPrice)} y2={y(stock.startPrice)} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth=".8" />
      <text x={W - R + 6} y={y(stock.startPrice) + 4} fontSize="11" fill="var(--muted)">시작 {stock.startPrice.toLocaleString('ko-KR')}</text>
      <polyline fill="none" stroke={color} strokeWidth="2.2" points={line} />
      {Array.from({ length: totalRounds + 1 }, (_, r) => r).filter(r => r % (totalRounds > 5 ? 2 : 1) === 0).map(r => <text key={r} x={x(r)} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--muted)">{r === 0 ? '시작' : `R${r}`}</text>)}
      {Math.abs(y(last.price) - y(stock.startPrice)) > 13 && <text x={W - R + 6} y={y(last.price) + 4} fontSize="12" fontWeight="700" fill={color}>{last.price.toLocaleString('ko-KR')}</text>}
      {pts.slice(1).map(p => (
        <g key={p.round} onClick={() => onSelect(p.round)} role="button" aria-label={`라운드 ${p.round} 변동 이유 보기`} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onSelect(p.round); }} style={{ cursor: 'pointer' }}>
          <circle cx={x(p.round)} cy={y(p.price)} r="16" fill="transparent" />
          <circle cx={x(p.round)} cy={y(p.price)} r={selected === p.round ? 6 : 4} fill={selected === p.round ? 'var(--led)' : color} stroke="var(--panel)" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(c => (c === m ? null : c)), 2200); };
  return { node: msg ? <div className="toast" role="status">{msg}</div> : null, show };
}
