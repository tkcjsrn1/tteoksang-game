/* NPC 주문 규칙. 참가자와 같은 공개 정보, 가격, 수수료, 예산 제한만 사용합니다.
   decide()가 돌려준 주문은 사람의 주문과 똑같이 GameRoom.placeOrder 검증을 거칩니다. */
import { maxBuyQty, stockOf, type OrderContext } from '../../shared/rules';
import type { NpcType, Side, StockCode } from '../../shared/types';

export interface NpcInput {
  round: number;
  /** 공개된 뉴스 헤드라인이 주는 인상 */
  signals: Partial<Record<StockCode, 1 | -1>>;
  prices: Record<StockCode, number>;
  lastChangeBp: Partial<Record<StockCode, number>>;
  ctx: OrderContext;
}
export interface NpcOrder { code: StockCode; side: Side; qty: number }

export const NPC_RULES: Record<NpcType, { label: string; rule: string; decide: (i: NpcInput) => NpcOrder[] }> = {
  chaser: {
    label: '속보 추격형',
    rule: '호재처럼 보이는 뉴스 종목을 현금의 35%로 사고, 악재처럼 보이는 뉴스 종목은 전부 팝니다.',
    decide: ({ signals, prices, ctx }) => {
      const out: NpcOrder[] = [];
      for (const [code, dir] of Object.entries(signals) as [StockCode, 1 | -1][]) {
        if (dir > 0) out.push({ code, side: 'buy', qty: Math.min(Math.floor(ctx.cash * .35 / prices[code]), maxBuyQty(ctx, code, prices[code])) });
        else if (ctx.holdings[code]?.qty) out.push({ code, side: 'sell', qty: ctx.holdings[code]!.qty });
      }
      return out;
    }
  },
  waiter: {
    label: '확인 대기형',
    rule: '뉴스 당일에는 사지 않습니다. 직전 라운드에 3% 이상 오른 종목을 현금의 25%로 사고, 3% 이상 내린 보유 종목의 절반을 팝니다.',
    decide: ({ lastChangeBp, prices, ctx }) => {
      const out: NpcOrder[] = [];
      for (const [code, bp] of Object.entries(lastChangeBp) as [StockCode, number][]) {
        if (bp >= 300) out.push({ code, side: 'buy', qty: Math.min(Math.floor(ctx.cash * .25 / prices[code]), maxBuyQty(ctx, code, prices[code])) });
        else if (bp <= -300 && ctx.holdings[code]?.qty) out.push({ code, side: 'sell', qty: Math.ceil(ctx.holdings[code]!.qty / 2) });
      }
      return out;
    }
  },
  diversifier: {
    label: '분산형',
    rule: '첫 라운드에 이번 판 업종마다 변동이 가장 작은 종목을 하나씩 15%씩 사고(업종이 6개를 넘으면 현금의 90%를 고르게 나눔), 이후에는 한 종목이 평가액의 25%를 넘으면 초과분을 팝니다.',
    decide: ({ round, prices, ctx }) => {
      const codes = Object.keys(prices) as StockCode[];
      if (round === 1) {
        /* 업종이 많은 판(종목 50·60개)에서 15%씩 사면 현금을 넘으므로, 합계가 90%를 넘지 않게 나눕니다 */
        const picks = pickDiversified(codes);
        const share = Math.min(.15, .9 / Math.max(1, picks.length));
        return picks.map(code => ({ code, side: 'buy' as const, qty: Math.floor(ctx.cash * share / prices[code]) }));
      }
      const value = ctx.cash + codes.reduce((a, c) => a + (ctx.holdings[c]?.qty ?? 0) * prices[c], 0);
      const out: NpcOrder[] = [];
      for (const c of codes) {
        const v = (ctx.holdings[c]?.qty ?? 0) * prices[c];
        if (v > value * .25) out.push({ code: c, side: 'sell', qty: Math.floor((v - value * .2) / prices[c]) });
      }
      return out;
    }
  }
};
/** 업종마다 변동폭(maxMoveBp)이 가장 작은 종목 하나씩. 같으면 코드가 앞선 종목. */
export function pickDiversified(codes: StockCode[]): StockCode[] {
  const best = new Map<string, StockCode>();
  codes.forEach(c => {
    const g = stockOf(c).group, cur = best.get(g);
    if (!cur || stockOf(c).maxMoveBp < stockOf(cur).maxMoveBp) best.set(g, c);
  });
  return [...best.values()];
}
export const NPC_TYPES: NpcType[] = ['chaser', 'waiter', 'diversifier'];
