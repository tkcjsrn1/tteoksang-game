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
