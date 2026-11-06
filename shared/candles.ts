/* 차트 연습실의 봉 계산. 시간·가격·수량이 있는 가상 체결 기록에서만 만듭니다. */
export interface Trade { minute: number; price: number; qty: number }
export interface Candle { start: number; open: number; high: number; low: number; close: number; volume: number; trades: number; direction: 'up' | 'down' | 'flat' }

export function buildCandle(start: number, trades: Trade[]): Candle {
  const open = trades[0].price, close = trades[trades.length - 1].price;
  return {
    start, open, close,
    high: Math.max(...trades.map(t => t.price)),
    low: Math.min(...trades.map(t => t.price)),
    volume: trades.reduce((a, t) => a + t.qty, 0),
    trades: trades.length,
    direction: close > open ? 'up' : close < open ? 'down' : 'flat'
  };
}
/** 기간별 첫 체결가·최고·최저·마지막 체결가로 봉을 만듭니다. 체결이 없는 기간은 건너뜁니다. */
export function aggregate(trades: Trade[], minutes: number): Candle[] {
  const buckets = new Map<number, Trade[]>();
  for (const t of trades.slice().sort((a, b) => a.minute - b.minute)) {
    const k = Math.floor(t.minute / minutes) * minutes;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(t);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([k, list]) => buildCandle(k, list));
}
/** 단순 이동평균. i번째 점은 i-n+1 ~ i 종가의 평균이고, 앞쪽은 null입니다. */
export function movingAverage(closes: number[], n: number): (number | null)[] {
  return closes.map((_, i) => i + 1 < n ? null : closes.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n);
}
