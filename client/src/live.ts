/* 장중 시세 메시지(tick)를 화면 상태에 반영합니다. 서버는 1초마다 종목 가격만 보내고,
   여기서 종목 가격·장중 시세 목록·내 평가액을 다시 계산합니다. React와 떼어 두어 테스트합니다. */
import type { RoomView, ServerMsg, StockView } from '../../shared/types';

type Tick = Extract<ServerMsg, { t: 'tick' }>;

export function applyTick(v: RoomView | null, m: Tick): RoomView | null {
  if (!v || v.round !== m.round || v.phase !== 'trade') return v;
  const stocks: StockView[] = v.stocks.map(s => {
    const p = m.prices[s.code];
    if (p === undefined) return s;
    const ticks = (s.ticks ?? [s.openPrice]).slice(0, m.k + 1);
    while (ticks.length < m.k) ticks.push(ticks[ticks.length - 1]);   // 놓친 칸은 직전 값으로 채움
    ticks[m.k] = p;
    return { ...s, price: p, ticks };
  });
  const pf = v.portfolio;
  if (!pf) return { ...v, stocks };
  const priceOf = (code: string) => stocks.find(s => s.code === code)?.price ?? 0;
  const holdings = pf.holdings.map(h => { const price = priceOf(h.code); return { ...h, price, pnl: h.qty * (price - h.avgCost) }; });
  const value = pf.cash + holdings.reduce((a, h) => a + h.qty * h.price, 0);
  return { ...v, stocks, portfolio: { ...pf, holdings, value, returnPct: (value / v.startCash - 1) * 100 } };
}

/** 오늘(이번 라운드) 등락률(bp). 시가 대비 지금 가격 */
export const intradayBp = (s: StockView) => s.openPrice ? Math.round((s.price - s.openPrice) * 10000 / s.openPrice) : 0;

/** 1초 시세를 size초씩 묶어 봉(시가·고가·저가·종가)으로. 마지막 묶음은 덜 찼을 수 있습니다. */
export interface MiniCandle { i: number; open: number; high: number; low: number; close: number }
export function bucketCandles(ticks: number[], size: number): MiniCandle[] {
  const out: MiniCandle[] = [];
  if (ticks.length < 2 || size < 1) return out;
  /* k초 봉은 (k−1)초 가격에서 열어 k초 가격으로 닫습니다. 첫 봉의 시가는 장 시작 가격 */
  for (let s = 1, i = 0; s < ticks.length; s += size, i++) {
    const seg = ticks.slice(s - 1, Math.min(ticks.length, s + size));
    out.push({ i, open: seg[0], high: Math.max(...seg), low: Math.min(...seg), close: seg[seg.length - 1] });
  }
  return out;
}
/** 이동평균(원, 반올림): n개가 모이기 전은 null */
export function movingAverage(values: number[], n: number): (number | null)[] {
  let sum = 0;
  return values.map((v, i) => { sum += v; if (i >= n) sum -= values[i - n]; return i >= n - 1 ? Math.round(sum / n) : null; });
}
