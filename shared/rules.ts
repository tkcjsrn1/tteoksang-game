/* 가격과 주문 규칙. 정수만 사용합니다. 100bp = 1%p */
import type { EventImpact, GameMode, Holding, Order, PriceBreakdown, Side, StockCode } from './types';

export const DISCLAIMER = '게임용 가상 정보이며 투자 조언이 아니다';
export const START_CASH = 10_000_000;
export const MAX_RETURN_BP = 2000;
export const MARKET_MAX_BP = 50;
export const STOCK_MAX_BP = 150;
export const FEE_BP = 20;

export const MODES: Record<GameMode, { rounds: number; news: number; trade: number; recap: number; maxPlayers: number; minToStart: number; arcs: number; cards: number; predictions: boolean; report: boolean; label: string }> = {
  friend:   { rounds: 5,  news: 12, trade: 36, recap: 12, maxPlayers: 8,  minToStart: 2, arcs: 2, cards: 2, predictions: false, report: false, label: '친구 대전' },
  solo:     { rounds: 5,  news: 12, trade: 36, recap: 12, maxPlayers: 1,  minToStart: 1, arcs: 2, cards: 2, predictions: false, report: false, label: '혼자 연습' },
  academic: { rounds: 10, news: 15, trade: 55, recap: 20, maxPlayers: 60, minToStart: 1, arcs: 4, cards: 5, predictions: true,  report: true,  label: '학술제 대전' }
};

export const STOCKS: { code: StockCode; name: string; sector: string; start: number; maxMoveBp: number; desc: string }[] = [
  { code: 'G01', name: '누바칸 미세전력', sector: '분산 전력 장치', start: 12400, maxMoveBp: 90,  desc: '소형 발전 모듈 판매. 시험 결과, 납품 승인, 부품 수급에 민감합니다.' },
  { code: 'G02', name: '세모륨 열전지',   sector: '열에너지 저장', start: 18600, maxMoveBp: 150, desc: '신형 열전지 개발. 실증 성능과 양산 수율에 따라 기대가 크게 바뀝니다.' },
  { code: 'G03', name: '도르넴 저온운송', sector: '저온 물류',     start: 8700,  maxMoveBp: 60,  desc: '정기 운송 계약이 주 매출원. 폭염에 수요가 늘고 전력비에 마진이 줍니다.' },
  { code: 'G04', name: '아보튠 배양소재', sector: '배양 소재',     start: 14800, maxMoveBp: 120, desc: '배양 원료 납품. 품질 검사, 납품 규격, 시설 가동 여부에 민감합니다.' },
  { code: 'G05', name: '피노벡 소리극장', sector: '체험형 공연',   start: 6300,  maxMoveBp: 100, desc: '소규모 음향 공연장 운영. 예약률, 행사 일정, 공연 취소가 매출을 좌우합니다.' },
  { code: 'G06', name: '타르멜 물순환',   sector: '물 재이용 설비', start: 10200, maxMoveBp: 50,  desc: '설비 관리 계약 비중이 높습니다. 장기 계약과 가뭄 발주에 반응합니다.' }
];
export const stockOf = (code: StockCode) => STOCKS.find(s => s.code === code)!;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const feeOf = (gross: number) => Math.ceil(gross * FEE_BP / 10000);
export const upperLimit = (P: number) => Math.floor(P * 12000 / 100000) * 10;
export const lowerLimit = (P: number) => Math.max(100, Math.ceil(P * 8000 / 100000) * 10);

export function formatPct(bp: number, digits = 1): string {
  const v = Math.abs(bp) / 100;
  return `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${v.toFixed(digits)}%`;
}

/** 원시 수익률 = 사건 합계 + 시장 + 종목. 제한 → 10원 반올림 → 상·하한가 순으로 적용합니다. */
export function computeClose(round: number, P: number, events: EventImpact[], marketBp: number, stockBp: number): PriceBreakdown {
  const eventBp = events.reduce((a, e) => a + e.bp, 0);
  const rawBp = eventBp + marketBp + stockBp;
  const cappedBp = clamp(rawBp, -MAX_RETURN_BP, MAX_RETURN_BP);
  const roundedPrice = Math.floor((P * (10000 + cappedBp) + 50000) / 100000) * 10;
  const hi = upperLimit(P), lo = lowerLimit(P);
  const closePrice = clamp(roundedPrice, lo, hi);
  const limit: PriceBreakdown['limit'] = roundedPrice > hi || (closePrice === hi && cappedBp >= MAX_RETURN_BP) ? 'upper'
    : roundedPrice < lo || (closePrice === lo && cappedBp <= -MAX_RETURN_BP) ? 'lower' : null;
  const changeBp = Math.round((closePrice - P) * 10000 / P);
  const main = events.slice().sort((a, b) => Math.abs(b.bp) - Math.abs(a.bp))[0];
  return {
    round, basePrice: P, closePrice, changeBp,
    summary: `${formatPct(changeBp)} · ${main ? main.label : '시장·종목 변동'}`,
    events, eventBp, marketBp, stockBp, rawBp, cappedBp, capped: cappedBp !== rawBp,
    roundedPrice, roundingWon: roundedPrice - Math.round(P * (10000 + cappedBp) / 10000),
    limit, upperLimit: hi, lowerLimit: lo
  };
}

export interface OrderContext { cash: number; holdings: Partial<Record<StockCode, Holding>>; orders: Partial<Record<StockCode, Order>> }
export type OrderCheck = { ok: true; gross: number; fee: number; reserve: number } | { ok: false; reason: string };

/** 같은 종목의 기존 주문은 돌려받았다고 보고 검증합니다. 실패해도 기존 주문은 그대로입니다. */
export function checkOrder(ctx: OrderContext, code: StockCode, side: Side, qty: number, price: number): OrderCheck {
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: '수량은 1주 이상 정수여야 합니다' };
  const gross = price * qty, fee = feeOf(gross);
  if (side === 'buy') {
    const others = Object.values(ctx.orders).reduce((a, o) => a + (o && o.code !== code ? o.reserve : 0), 0);
    const reserve = gross + fee;
    if (others + reserve > ctx.cash) return { ok: false, reason: '주문 가능 현금이 부족합니다' };
    return { ok: true, gross, fee, reserve };
  }
  const held = ctx.holdings[code]?.qty ?? 0;
  if (qty > held) return { ok: false, reason: '라운드 시작 보유 수량을 넘었습니다' };
  return { ok: true, gross, fee, reserve: 0 };
}
export function maxBuyQty(ctx: OrderContext, code: StockCode, price: number): number {
  const others = Object.values(ctx.orders).reduce((a, o) => a + (o && o.code !== code ? o.reserve : 0), 0);
  const av = ctx.cash - others;
  let q = Math.max(0, Math.floor(av / price));
  while (q > 0 && q * price + feeOf(q * price) > av) q--;
  return q;
}
