/* 매매일지: 판이 끝나면 내 체결을 라운드 뉴스, 그 라운드 종가와 나란히 보여 줍니다. 메모는 이 기기에만 저장합니다. */
import type { OrderKind, RoomView, Side, StockCode } from '../../shared/types';

export interface JournalEntry {
  key: string; round: number; code: StockCode; name: string; side: Side; qty: number; price: number;
  kind: OrderKind; trigger: 'stop' | 'take' | null; headline: string | null;
  /** 그 라운드 종가 */
  close: number | null;
  /** 종가 기준으로 이 거래가 유리했던 정도(bp). 매수는 (종가 − 체결가)/체결가, 매도는 (체결가 − 종가)/종가 */
  afterBp: number | null;
  verdict: 'good' | 'bad' | 'flat' | null;
}
export function buildJournal(view: RoomView): JournalEntry[] {
  const log = view.portfolio?.fillLog ?? [];
  const seen = new Map<number, number>();
  return log.map(f => {
    const n = seen.get(f.round) ?? 0; seen.set(f.round, n + 1);
    const stock = view.stocks.find(s => s.code === f.code);
    const close = stock?.history.find(h => h.round === f.round)?.closePrice ?? null;
    const afterBp = close === null ? null : Math.round(f.side === 'buy' ? (close - f.price) * 10000 / f.price : (f.price - close) * 10000 / close);
    const verdict = afterBp === null ? null : afterBp > 20 ? 'good' : afterBp < -20 ? 'bad' : 'flat';
    return {
      key: `${f.round}-${n}`, round: f.round, code: f.code, name: stock?.name ?? f.code, side: f.side, qty: f.qty, price: f.price,
      kind: f.kind ?? 'market', trigger: f.trigger ?? null,
      headline: view.news.find(r => r.round === f.round)?.cards.find(c => c.card.targets.includes(f.code))?.card.headline ?? null,
      close, afterBp, verdict
    };
  });
}
export const journalKey = (roomCode: string) => `journal:${roomCode}`;
export function parseNotes(raw: string | null): Record<string, string> {
  try { const v = JSON.parse(raw ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, t]) => typeof t === 'string').map(([k, t]) => [k, (t as string).slice(0, 200)])) : {}; } catch { return {}; }
}
