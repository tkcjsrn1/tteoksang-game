/* 가격과 주문 규칙. 정수만 사용합니다. 100bp = 1%p */
import type { EventImpact, GameMode, Holding, Order, PriceBreakdown, Side, StockCode } from './types';

export const DISCLAIMER = '게임용 가상 정보이며 투자 조언이 아닙니다';
export const START_CASH = 10_000_000;
export const MAX_RETURN_BP = 2000;
export const MARKET_MAX_BP = 50;
export const STOCK_MAX_BP = 150;
export const FEE_BP = 20;

/* 라운드 시간(초). 한 라운드 = 뉴스 + 주문 + 결과. 처음 하는 사람도 뉴스를 읽고 판단할 수 있게 한 라운드를 2분 넘게 둡니다(2026-11 결정). */
export const MODES: Record<GameMode, { rounds: number; news: number; trade: number; recap: number; maxPlayers: number; minToStart: number; arcs: number; cards: number; predictions: boolean; report: boolean; label: string }> = {
  friend:   { rounds: 5,  news: 20, trade: 90, recap: 20, maxPlayers: 8,  minToStart: 2, arcs: 2, cards: 2, predictions: false, report: false, label: '친구 대전' },
  solo:     { rounds: 5,  news: 20, trade: 90, recap: 20, maxPlayers: 1,  minToStart: 1, arcs: 2, cards: 2, predictions: false, report: false, label: '혼자 연습' },
  academic: { rounds: 10, news: 20, trade: 90, recap: 25, maxPlayers: 60, minToStart: 1, arcs: 4, cards: 5, predictions: true,  report: true,  label: '학술제 대전' }
};

/* 종목 24개 = 업종 6개 × 4종목. 각 업종의 첫 종목(대표 종목)이 뉴스의 주인공이고,
   같은 업종 종목은 대표 종목 뉴스에 linkBeta 비율만큼 함께 움직입니다(업종 동조화).
   한 판에는 대표 종목 6개 + 같은 업종 종목 4개, 모두 10개가 나옵니다(server/src/plan.ts pickStocks).
   모든 기업은 지어낸 가상 기업입니다. */
export type StockGroup = 'power' | 'storage' | 'cold' | 'bio' | 'stage' | 'water';
export const GROUPS: Record<StockGroup, { label: string; leader: StockCode; color: string }> = {
  power:   { label: '분산 전력',    leader: 'G01', color: '#E08E0B' },
  storage: { label: '열에너지 저장', leader: 'G02', color: '#7B61FF' },
  cold:    { label: '저온 물류',    leader: 'G03', color: '#00A88F' },
  bio:     { label: '배양 소재',    leader: 'G04', color: '#1F9D5C' },
  stage:   { label: '체험형 공연',  leader: 'G05', color: '#E8557A' },
  water:   { label: '물 재이용',    leader: 'G06', color: '#3B8DD9' }
};
export interface StockDef { code: StockCode; name: string; sector: string; group: StockGroup; start: number; maxMoveBp: number; linkBeta: number; desc: string }
export const STOCKS: StockDef[] = [
  { code: 'G01', name: '누바칸 미세전력', sector: '분산 전력 장치', group: 'power', start: 12400, maxMoveBp: 90, linkBeta: 1, desc: '소형 발전 모듈 판매. 시험 결과, 납품 승인, 부품 수급에 민감합니다.' },
  { code: 'G02', name: '세모륨 열전지',   sector: '열에너지 저장', group: 'storage', start: 18600, maxMoveBp: 150, linkBeta: 1, desc: '신형 열전지 개발. 실증 성능과 양산 수율에 따라 기대가 크게 바뀝니다.' },
  { code: 'G03', name: '도르넴 저온운송', sector: '저온 물류', group: 'cold', start: 8700, maxMoveBp: 60, linkBeta: 1, desc: '정기 운송 계약이 주 매출원. 폭염에 수요가 늘고 전력비에 마진이 줍니다.' },
  { code: 'G04', name: '아보튠 배양소재', sector: '배양 소재', group: 'bio', start: 14800, maxMoveBp: 120, linkBeta: 1, desc: '배양 원료 납품. 품질 검사, 납품 규격, 시설 가동 여부에 민감합니다.' },
  { code: 'G05', name: '피노벡 소리극장', sector: '체험형 공연', group: 'stage', start: 6300, maxMoveBp: 100, linkBeta: 1, desc: '소규모 음향 공연장 운영. 예약률, 행사 일정, 공연 취소가 매출을 좌우합니다.' },
  { code: 'G06', name: '타르멜 물순환',   sector: '물 재이용 설비', group: 'water', start: 10200, maxMoveBp: 50, linkBeta: 1, desc: '설비 관리 계약 비중이 높습니다. 장기 계약과 가뭄 발주에 반응합니다.' },
  { code: 'G07', name: '라벤토 소형터빈', sector: '소형 풍력 발전기', group: 'power', start: 7200, maxMoveBp: 110, linkBeta: 0.5, desc: '건물 옥상용 소형 발전기를 만듭니다. 분산 전력 업종 소식에 함께 움직입니다.' },
  { code: 'G08', name: '키오닉 전력망',   sector: '전력 거래 소프트웨어', group: 'power', start: 15600, maxMoveBp: 80, linkBeta: 0.35, desc: '소형 발전 전력을 사고파는 중개 프로그램. 업종 소식에는 덜 민감합니다.' },
  { code: 'G09', name: '바르셀 발전부품', sector: '발전 모듈 부품', group: 'power', start: 4850, maxMoveBp: 120, linkBeta: 0.6, desc: '발전 모듈용 부품 공급사. 대형 고객 납품이 늘면 함께 웃습니다.' },
  { code: 'G10', name: '오르메 열교환',   sector: '열교환기 제조', group: 'storage', start: 9300, maxMoveBp: 90, linkBeta: 0.45, desc: '열을 옮기는 장치를 만듭니다. 열에너지 저장 시장이 커지면 수요가 늡니다.' },
  { code: 'G11', name: '피레온 단열소재', sector: '고온 단열재', group: 'storage', start: 6100, maxMoveBp: 130, linkBeta: 0.55, desc: '고온을 견디는 단열재 공급. 열전지 양산 소식에 민감합니다.' },
  { code: 'G12', name: '카보린 셀테크',   sector: '차세대 전지 연구', group: 'storage', start: 23400, maxMoveBp: 170, linkBeta: 0.6, desc: '아직 매출이 거의 없는 연구 기업. 기대만으로 움직여 변동이 큽니다.' },
  { code: 'G13', name: '하일로 냉동창고', sector: '냉동 창고 임대', group: 'cold', start: 11800, maxMoveBp: 60, linkBeta: 0.5, desc: '냉동 창고를 빌려줍니다. 물동량이 늘면 가동률이 오릅니다.' },
  { code: 'G14', name: '멘토라 택배',     sector: '일반 택배', group: 'cold', start: 5400, maxMoveBp: 70, linkBeta: 0.35, desc: '상온 택배가 주력. 저온 물류 소식에는 일부만 반응합니다.' },
  { code: 'G15', name: '시노바 냉장트럭', sector: '냉장 트럭 제조', group: 'cold', start: 13200, maxMoveBp: 100, linkBeta: 0.4, desc: '냉장 트럭을 만들어 팝니다. 운송사들이 차량을 늘리면 주문이 늡니다.' },
  { code: 'G16', name: '루펠 배양액',     sector: '세포 배양액', group: 'bio', start: 21500, maxMoveBp: 130, linkBeta: 0.5, desc: '세포를 키우는 배양액을 만듭니다. 배양 소재 업종과 고객이 겹칩니다.' },
  { code: 'G17', name: '노르딘 검사',     sector: '품질 검사 대행', group: 'bio', start: 8100, maxMoveBp: 90, linkBeta: 0.4, desc: '식품·소재 품질 검사를 대신 해 줍니다. 규제가 강해지면 일이 늡니다.' },
  { code: 'G18', name: '에테온 단백',     sector: '배양 단백질 식품', group: 'bio', start: 16700, maxMoveBp: 150, linkBeta: 0.55, desc: '배양 단백질로 식품을 만듭니다. 원료 소식과 소비자 반응에 크게 흔들립니다.' },
  { code: 'G19', name: '모비아 티켓',     sector: '공연 예매 플랫폼', group: 'stage', start: 9900, maxMoveBp: 110, linkBeta: 0.5, desc: '공연 예매 수수료로 법니다. 공연 흥행이 곧 거래액입니다.' },
  { code: 'G20', name: '큐라 음향대여',   sector: '공연 장비 대여', group: 'stage', start: 7600, maxMoveBp: 90, linkBeta: 0.4, desc: '음향·조명 장비를 빌려줍니다. 공연 횟수에 따라 매출이 움직입니다.' },
  { code: 'G21', name: '소나레 기획',     sector: '공연 기획사', group: 'stage', start: 12300, maxMoveBp: 140, linkBeta: 0.55, desc: '공연을 기획하고 출연진을 관리합니다. 흥행 여부에 실적이 크게 갈립니다.' },
  { code: 'G22', name: '아쿠론 필터',     sector: '정수 필터', group: 'water', start: 6800, maxMoveBp: 60, linkBeta: 0.5, desc: '정수 설비용 필터를 교체 판매합니다. 설비가 늘면 꾸준히 팔립니다.' },
  { code: 'G23', name: '테라젠 배관',     sector: '배관 시공', group: 'water', start: 4300, maxMoveBp: 70, linkBeta: 0.4, desc: '물 재이용 설비 배관 공사. 발주가 늘면 공사가 늡니다.' },
  { code: 'G24', name: '리베아 수처리',   sector: '하수 처리 운영', group: 'water', start: 14100, maxMoveBp: 50, linkBeta: 0.45, desc: '지자체 하수 처리장을 장기 계약으로 운영합니다. 대표적인 방어주입니다.' }
];
export const LEADERS: StockCode[] = Object.values(GROUPS).map(g => g.leader);
/** 예전 저장 데이터(종목 6개 시절)를 복구할 때 쓰는 기본 종목 */
export const LEGACY_CODES: StockCode[] = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06'];
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
export type OrderCheck =
  | { ok: true; price: number; slipBp: number; gross: number; fee: number; reserve: number }
  | { ok: false; reason: string };
/** limit: 지정가(이 가격에 체결, 슬리피지 없음). replace: 같은 종목에 걸어 둔 예약을 대신하는 주문이면 true(그 예약금·수량은 돌려받았다고 봄). */
export interface OrderOpts { limit?: number; replace?: boolean }

/* ---------- 슬리피지(게임 규칙) ----------
   큰 주문일수록 내 주문만 조금 불리한 가격에 체결됩니다. 다른 사람의 가격·종료가에는 영향을 주지 않습니다
   (1~2명이 하는 판에서 가격을 움직여 이득을 보는 길을 막기 위해서입니다).
   기준가 × 수량이 200만 원을 넘으면 100만 원마다 5bp, 최대 40bp. 매수는 올림, 매도는 내림(원 단위). */
export const SLIP_FREE_WON = 2_000_000;
export const SLIP_STEP_WON = 1_000_000;
export const SLIP_BP_PER_STEP = 5;
export const SLIP_MAX_BP = 40;
export function slippageBp(refGross: number): number {
  if (!(refGross > SLIP_FREE_WON)) return 0;
  return Math.min(SLIP_MAX_BP, Math.ceil((refGross - SLIP_FREE_WON) / SLIP_STEP_WON) * SLIP_BP_PER_STEP);
}
/** 기준가 ref로 qty주를 주문했을 때 체결 예정가. 슬리피지 0이면 기준가 그대로입니다. */
export function fillPrice(ref: number, side: Side, qty: number): { price: number; slipBp: number } {
  const slipBp = slippageBp(ref * qty);
  if (!slipBp) return { price: ref, slipBp };
  const price = side === 'buy' ? Math.ceil(ref * (10000 + slipBp) / 10000) : Math.floor(ref * (10000 - slipBp) / 10000);
  return { price, slipBp };
}
const reservedExcept = (ctx: OrderContext, code: StockCode | null) => Object.values(ctx.orders).reduce((a, o) => a + (o && o.code !== code ? o.reserve : 0), 0);

/** 주문 검증. ref는 지금 가격(장중 시세)입니다.
    - 시장가: 지금 가격에 슬리피지를 붙여 바로 체결합니다. 걸어 둔 예약의 예약금·수량은 쓸 수 없습니다.
    - 지정가(opts.limit): 그 가격에 체결될 때를 기준으로 예약금을 잡습니다. 같은 종목 예약은 새 예약으로 바뀝니다. */
export function checkOrder(ctx: OrderContext, code: StockCode, side: Side, qty: number, ref: number, opts: OrderOpts = {}): OrderCheck {
  if (!Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: '수량은 1주 이상 정수여야 합니다' };
  const replace = opts.replace ?? opts.limit !== undefined;
  const same = ctx.orders[code];
  const lockedSell = !replace && same?.side === 'sell' ? same.qty : 0;
  if (side === 'sell' && qty > (ctx.holdings[code]?.qty ?? 0) - lockedSell) return { ok: false, reason: lockedSell ? '매도 예약에 묶인 수량을 빼면 보유 수량이 모자랍니다' : '보유 수량을 넘었습니다' };
  const unit = opts.limit ?? ref;
  if (side === 'buy' && unit * qty > ctx.cash) return { ok: false, reason: '주문 가능 현금이 부족합니다' };   // 큰 수 곱셈 전에 먼저 거릅니다
  const { price, slipBp } = opts.limit !== undefined ? { price: opts.limit, slipBp: 0 } : fillPrice(ref, side, qty);
  const gross = price * qty, fee = feeOf(gross);
  if (side === 'buy') {
    const reserve = gross + fee;
    if (reservedExcept(ctx, replace ? code : null) + reserve > ctx.cash) return { ok: false, reason: '주문 가능 현금이 부족합니다' };
    return { ok: true, price, slipBp, gross, fee, reserve };
  }
  return { ok: true, price, slipBp, gross, fee, reserve: 0 };
}
/** 슬리피지와 수수료까지 넣어 살 수 있는 최대 수량. 지정가면 그 가격 기준 */
export function maxBuyQty(ctx: OrderContext, code: StockCode, ref: number, opts: OrderOpts = {}): number {
  const replace = opts.replace ?? opts.limit !== undefined;
  const av = ctx.cash - reservedExcept(ctx, replace ? code : null);
  const unit = opts.limit ?? ref;
  let q = Math.max(0, Math.floor(av / unit));
  const cost = (n: number) => { const g = (opts.limit ?? fillPrice(ref, 'buy', n).price) * n; return g + feeOf(g); };
  while (q > 0 && cost(q) > av) q--;
  return q;
}

/* ---------- 장중 시세 ----------
   주문 시간 동안 1초마다 가격이 움직입니다. 움직임은 시장 분위기(marketBp)와 종목 변동(stockBp), 장중 속보 반응을 합친
   목표까지 가는 무작위 경로(브라운 다리)입니다. 사건의 최종 결과는 경로에 넣지 않고 마감 때 한 번에 반영하므로,
   장중 시세로 결말을 미리 알 수 없습니다. 같은 시드면 같은 경로가 나옵니다. */
/** 장중 속보가 뜰 때 헤드라인 방향으로 먼저 튀는 폭(대표 종목 기준, bp). 같은 업종 종목은 linkBeta배 */
export const REACT_BP = 120;
/** 장중 흔들림 크기: 종목 변동폭(maxMoveBp)의 이 배수가 한 라운드 표준편차 */
export const WIGGLE_X = 1.2;
/** 0~1 균등 난수 함수 */
export type Rnd = () => number;
const gauss = (rnd: Rnd) => (rnd() + rnd() + rnd() + rnd() - 2) * Math.sqrt(3);   // 평균 0, 표준편차 1 근사
/** base에서 출발해 steps초 뒤 endBp(만분율)에 닿는 경로. jump가 있으면 그 초에 bp만큼 튑니다(속보 반응, endBp에 포함).
    가격은 10원 단위, base의 상·하한가 안. 길이 steps+1, 첫 값은 base. */
export function intradayPath(rnd: Rnd, base: number, endBp: number, steps: number, wiggleBp: number, jump?: { at: number; bp: number }): number[] {
  const n = Math.max(1, Math.floor(steps));
  const w: number[] = [0];
  const sd = wiggleBp / Math.sqrt(n);
  for (let k = 1; k <= n; k++) w.push(w[k - 1] + gauss(rnd) * sd);
  const jb = jump && jump.at >= 1 && jump.at <= n ? jump.bp : 0;
  const hi = upperLimit(base), lo = lowerLimit(base);
  const out: number[] = [];
  for (let k = 0; k <= n; k++) {
    const bridge = w[k] - (k / n) * w[n];
    const x = Math.round(bridge + (k / n) * (endBp - jb) + (jb && k >= jump!.at ? jb : 0));
    const p = k === 0 ? base : Math.round(base * (10000 + x) / 100000) * 10;
    out.push(Math.min(hi, Math.max(lo, p)));
  }
  return out;
}
