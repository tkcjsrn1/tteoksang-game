/* 대형 화면(Display.tsx)에 무엇을 올릴지 고르는 계산. 화면 없이 테스트할 수 있게 따로 둡니다. */
import type { LeaderRow, RoomView, StockView } from '../../shared/types';
import { intradayBp } from './live';

/** 대형 화면에 올리는 종목 수. 강당 뒤에서도 읽히게 적게 둡니다 */
export const STOCK_ROWS = 8;
/** 이번 뉴스 종목을 먼저, 나머지는 많이 움직인 순서로 몇 개만 */
export function pickDisplayStocks(view: RoomView, n = STOCK_ROWS): { stock: StockView; bp: number | null; news: boolean }[] {
  const targets = new Set((view.news[view.news.length - 1]?.round === view.round ? view.news[view.news.length - 1].cards : []).flatMap(c => c.card.targets));
  const live = view.phase === 'trade';
  const rows = view.stocks.map(s => ({ stock: s, bp: live && s.ticks ? intradayBp(s) : s.lastChangeBp, news: targets.has(s.code) }));
  return rows.sort((a, b) => Number(b.news) - Number(a.news) || Math.abs(b.bp ?? 0) - Math.abs(a.bp ?? 0)).slice(0, n);
}
/** 대형 화면 순위는 사람끼리 매깁니다(같은 평가액은 같은 등수). NPC는 비교용으로 가장 잘한 하나만 따로 적습니다. */
export function humanRanks(rows: LeaderRow[]): LeaderRow[] {
  const humans = rows.filter(r => r.kind === 'human');
  return humans.map(h => ({ ...h, rank: 1 + humans.filter(o => o.value > h.value).length })).sort((a, b) => a.rank - b.rank);
}
