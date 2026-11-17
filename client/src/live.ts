/* 장중 시세 메시지(tick)를 화면 상태에 반영합니다. 서버는 1초마다 종목 가격과 참가자별 평가액(순위용)을 보내고,
   여기서 종목 가격·장중 시세 목록·내 평가액·순위를 다시 계산합니다. React와 떼어 두어 테스트합니다. */
import type { LeaderRow, RoomView, ServerMsg, StockView } from '../../shared/types';

type Tick = Extract<ServerMsg, { t: 'tick' }>;

export function applyTick(v: RoomView | null, m: Tick): RoomView | null {
  if (!v || v.round !== m.round || v.phase !== 'trade') return v;
  const stocks: StockView[] = v.stocks.map(s => {
    const p = m.prices[s.code];
    if (p === undefined) return s;
    const prevK = (s.ticks?.length ?? 1) - 1;
    const ticks = (s.ticks ?? [s.openPrice]).slice(0, m.k + 1);
    while (ticks.length < m.k) ticks.push(ticks[ticks.length - 1]);   // 놓친 칸은 직전 값으로 채움
    ticks[m.k] = p;
    const next: StockView = { ...s, price: p, ticks };
    /* VI 남은 시간도 지난 초만큼 줄입니다. 서버는 VI가 걸릴 때만 화면 전체를 보내서,
       예전에는 '10초 뒤 재개'가 그대로 멈춰 있고 풀린 뒤에도 안내가 남아 있었습니다. */
    const halt = s.haltLeft ? viLeft(s.haltLeft, prevK, m.k) : 0;
    if (halt) next.haltLeft = halt; else delete next.haltLeft;
    return next;
  });
  const leaderboard = m.board ? applyBoard(v.leaderboard, m.board, v.startCash) : v.leaderboard;
  const pf = v.portfolio;
  if (!pf) return { ...v, stocks, leaderboard };
  const priceOf = (code: string) => stocks.find(s => s.code === code)?.price ?? 0;
  const holdings = pf.holdings.map(h => { const price = priceOf(h.code); return { ...h, price, pnl: h.qty * (price - h.avgCost) }; });
  const value = pf.cash + holdings.reduce((a, h) => a + h.qty * h.price, 0);
  return { ...v, stocks, leaderboard, portfolio: { ...pf, holdings, value, returnPct: (value / v.startCash - 1) * 100 } };
}

/** VI로 멈춘 종목의 남은 초. 화면을 받은 칸(prevK)에서 k칸까지 지난 만큼 줄이고, 다 지나면 0 */
export function viLeft(left: number, prevK: number, k: number): number {
  return Math.max(0, left - Math.max(0, k - prevK));
}

/** 시세 메시지에 실려 온 [id, 평가액]으로 순위표의 평가액·수익률·순위를 다시 매깁니다.
    서버 leaderboard()와 같은 규칙: 평가액이 큰 순서, 같으면 이름 순, 같은 평가액은 같은 순위.
    prevRank(직전 라운드 끝 순위)는 그대로 둡니다. 목록에 없는 사람은 원래 값을 씁니다. */
export function applyBoard(rows: LeaderRow[], board: [string, number][], startCash: number): LeaderRow[] {
  const now = new Map(board);
  const sorted = rows.map(r => {
    const value = now.get(r.playerId) ?? r.value;
    return { ...r, value, returnPct: (value / startCash - 1) * 100 };
  }).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.value !== sorted[i - 1].value) rank = i + 1;
    return { ...r, rank };
  });
}

/** 내 평가액 칸의 숫자. 원 금액과 수익률을 같은 평가액에서 계산합니다.
    순위표의 평가액은 시세 메시지에 실려 올 때만 바뀌므로(큰 방은 몇 초에 한 번), 내 칸은 내 평가액을 그대로 씁니다. */
export function walletChange(v: RoomView, me: LeaderRow) {
  const value = v.portfolio?.value ?? me.value;
  const pct = v.portfolio ? v.portfolio.returnPct : me.returnPct;
  return { value, diff: value - v.startCash, pct };
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
/** 그래프의 가로 위치(svg 좌표)를 몇 초째 시세인지로 바꿉니다. 범위를 벗어나면 양 끝으로 붙입니다. */
export function probeIndex(svgX: number, left: number, stepWidth: number, count: number): number {
  if (count <= 1 || stepWidth <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round((svgX - left) / stepWidth)));
}
