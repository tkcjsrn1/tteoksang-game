/* 종목 목록을 업종별로 묶고, 어떤 업종을 처음부터 펼쳐 둘지 정합니다.
   화면(React)과 떼어 두어 테스트할 수 있게 했습니다. */
import { GROUPS, STOCKS, stockOf, type StockGroup } from '../../shared/rules';
import type { RoomView, StockCode, StockView } from '../../shared/types';
import { intradayBp } from './live';

export interface SectorBlock {
  group: StockGroup;
  label: string;
  color: string;
  stocks: StockView[];
  /** 등락(bp)의 평균(장중에는 오늘 등락). 아직 등락이 없으면 null */
  avgChangeBp: number | null;
}

/** GROUPS 순서대로 묶습니다. 이번 판에 종목이 없는 업종은 빠집니다. */
export function groupStocks(stocks: StockView[], live = false): SectorBlock[] {
  return (Object.keys(GROUPS) as StockGroup[]).map(group => {
    const list = stocks.filter(s => stockOf(s.code).group === group);
    /* 장중에는 오늘(시가 대비) 등락, 그 밖에는 직전 라운드 등락 */
    const changes = list.map(s => live && s.ticks ? intradayBp(s) : s.lastChangeBp).filter((x): x is number => x !== null);
    return {
      group, label: GROUPS[group].label, color: GROUPS[group].color, stocks: list,
      avgChangeBp: changes.length ? Math.round(changes.reduce((a, b) => a + b, 0) / changes.length) : null
    };
  }).filter(b => b.stocks.length > 0);
}

/** 이번 라운드 뉴스가 다루는 종목(뉴스·주문 시간에만) */
export function newsTargets(view: RoomView): StockCode[] {
  if (view.phase !== 'news' && view.phase !== 'trade') return [];
  return view.news[view.news.length - 1]?.cards.flatMap(c => c.card.targets) ?? [];
}

/** 처음부터 펼칠 업종: 이번 뉴스가 있는 업종, 내가 가진 종목이나 예약 주문이 있는 업종. */
export function defaultOpenGroups(view: RoomView): Set<StockGroup> {
  const codes = new Set<StockCode>([
    ...newsTargets(view),
    ...(view.portfolio?.holdings.map(h => h.code) ?? []),
    ...(view.portfolio?.orders.map(o => o.code) ?? [])
  ]);
  return new Set([...codes].filter(c => stockOf(c)).map(c => stockOf(c).group));
}

/** 로고 테두리 모양 가짓수. 한 업종의 기업 수가 이보다 많아지면 모양이 겹칩니다(tests/fx.test.ts가 막습니다). */
export const LOGO_VARIANTS = 5;
/** 업종 안에서 몇 번째 기업인지(0~3). 로고 테두리 모양을 고릅니다 */
export function logoVariant(code: string): number {
  const s = STOCKS.find(x => x.code === code);
  return s ? STOCKS.filter(x => x.group === s.group).findIndex(x => x.code === code) : 0;
}
