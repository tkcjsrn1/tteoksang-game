/* 서버와 클라이언트가 함께 쓰는 공개 타입. 미래 결말과 시드는 여기에 없습니다. */
/** 종목 코드 G01~G30. 목록과 업종은 shared/rules.ts STOCKS */
export type StockCode = `G${number}`;
export type GameMode = 'friend' | 'solo' | 'academic';
export type Phase = 'news' | 'trade' | 'settling' | 'recap';
export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type Side = 'buy' | 'sell';
export type Role = 'player' | 'spectator' | 'operator' | 'display';
export type NpcType = 'chaser' | 'waiter' | 'diversifier';

export interface EventImpact { stageId: string; label: string; bp: number; reason: string }

/** 그래프 점 하나를 눌렀을 때 보여 주는 가격 변동 근거 */
export interface PriceBreakdown {
  round: number;
  basePrice: number;
  closePrice: number;
  changeBp: number;          // 실제 등락률(만분율)
  summary: string;           // 예: −4.6% · 기대에 못 미친 계약 규모
  events: EventImpact[];
  eventBp: number;
  marketBp: number;
  stockBp: number;
  rawBp: number;
  cappedBp: number;
  capped: boolean;           // ±2,000bp 제한 적용 여부
  roundedPrice: number;      // 10원 단위 반올림 결과
  roundingWon: number;       // 반올림으로 달라진 금액
  limit: 'upper' | 'lower' | null;
  upperLimit: number;
  lowerLimit: number;
  /** 봉 차트용 고가·저가. 장중 시세(1초 단위)와 종료가 중 가장 높은·낮은 값입니다. 예전 저장 데이터에는 없습니다. */
  high?: number;
  low?: number;
  /** 이 라운드 시작 때 배당락으로 이전가를 낮춘 금액(주당 배당금). 없으면 없음 */
  exDividend?: number;
  /** 장중 시세가 끝난 가격(결과 공개 직전). 여기서 종료가까지가 사건 결과 공개로 움직인 몫입니다. */
  preClose?: number;
  /** 이번 라운드에 체결된 수량(참가자 + NPC). 예전 저장 데이터에는 없습니다. */
  volume?: number;
  buyQty?: number;
  sellQty?: number;
}

export type OrderKind = 'market' | 'limit';
/** 걸어 둔 지정가 주문(예약). 시장가 주문은 바로 체결되므로 여기에 남지 않습니다. */
export interface Order {
  code: StockCode; side: Side; qty: number; kind?: OrderKind;
  /** 지정가. 시세가 이 가격에 닿으면 이 가격에 체결됩니다 */
  price: number; refPrice?: number; slipBp?: number;
  gross: number; fee: number; reserve: number; requestId: string; placedAt: number;
}
/** 체결 한 건 */
export interface FillInfo { code: StockCode; side: Side; qty: number; price: number; fee: number; kind: OrderKind; trigger?: 'stop' | 'take' }
/** 손절·익절 자동 주문. 시세가 stop 이하로 내려가거나 take 이상으로 오르면 가진 수량 전부를 시장가로 팝니다. */
export interface StopOrder { stop: number | null; take: number | null; setAt: number }
export interface Holding { qty: number; avgCost: number; sinceRound: number }

export interface NewsCard {
  stageId: string; arcTitle: string; headline: string; facts: string; expectation: string;
  remaining: string; clue: string; targets: StockCode[]; breaking: boolean;
}
export interface NewsResult {
  actual: string; gap: string; label: string; concept: string;
  impacts: { code: StockCode; bp: number; reason: string }[];
}
export interface RoundNews { round: number; cards: { card: NewsCard; result: NewsResult | null }[] }

export interface StockView {
  code: StockCode; name: string; sector: string; desc: string;
  /** 지금 가격. 주문 시간에는 장중 시세 */
  price: number; lastChangeBp: number | null; history: PriceBreakdown[]; startPrice: number;
  /** 이번 라운드 시가(직전 종료가) */
  openPrice: number;
  /** 이번 라운드 장중 시세(1초 간격). 주문 시간에는 지금까지, 결과 시간에는 라운드 전체. 그 밖에는 없음 */
  ticks?: number[];
}
export interface CardView {
  id: string; title: string; body: string; concept: string;
  options: { key: 'A' | 'B'; label: string }[];
  answered: 'A' | 'B' | null; feedback: string | null;
}
export interface PredictionView {
  stageId: string; question: string;
  choice: 'A' | 'B' | null; confidence: number | null; correct: boolean | null;
}
export interface LeaderRow {
  playerId: string; label: string; kind: 'human' | 'npc'; npcType: string | null; connected: boolean;
  /** NPC의 주문 규칙 설명. 사람은 null */
  npcRule: string | null;
  value: number; returnPct: number; rank: number;
}
export interface Contribution { code: StockCode; name: string; qty: number; won: number }
export interface RoundResult {
  round: number; rankBefore: number; rankAfter: number; valueBefore: number; valueAfter: number;
  delta: number; fees: number;
  /** 슬리피지로 손해 본 금액(기준가와 체결가 차이 × 수량). 예전 기록에는 없습니다 */
  slippage?: number;
  contributions: Contribution[]; best: Contribution | null;
  fills: { code: StockCode; side: Side; qty: number; price: number; fee: number }[];
}
export interface Metric {
  key: string; title: string; available: boolean; value: string; text: string; formula: string; minObservations: string;
}
export interface FinalReport {
  rank: number; value: number; returnPct: number; fees: number;
  majorTrades: { round: number; code: StockCode; name: string; side: Side; qty: number; price: number }[];
  metrics: Metric[] | null;
  judgments: { title: string; choice: string; concept: string }[];
}
export interface Portfolio {
  cash: number; reserved: number; available: number; value: number; returnPct: number; fees: number;
  holdings: { code: StockCode; name: string; qty: number; avgCost: number; price: number; pnl: number; stop?: number | null; take?: number | null }[];
  orders: Order[];
  fillLog: { round: number; code: StockCode; side: Side; qty: number; price: number; fee: number; kind?: OrderKind; trigger?: 'stop' | 'take' }[];
  /** 받은 배당금 */
  dividendLog?: DividendPaid[];
}
export interface DividendPaid { round: number; code: StockCode; qty: number; dps: number; amount: number }
/** 이번 판 배당 일정. upcoming: 다음 라운드가 기준일, record: 이번 라운드가 기준일, ex: 이번 라운드 시작 때 배당락·입금, done: 끝 */
export interface DividendView { recordRound: number; status: 'before' | 'upcoming' | 'record' | 'ex' | 'done'; items: { code: StockCode; name: string; dps: number }[] }
export interface RoomView {
  code: string; mode: GameMode; status: RoomStatus; phase: Phase | null;
  round: number; totalRounds: number;
  phaseEndsAt: number | null; phaseSeconds: number; serverNow: number;
  you: { id: string | null; label: string | null; role: Role; isHost: boolean };
  humanCount: number; maxPlayers: number; minToStart: number; startCash: number;
  leaderboard: LeaderRow[];
  stocks: StockView[];
  news: RoundNews[];
  card: CardView | null;
  prediction: PredictionView | null;
  portfolio: Portfolio | null;
  lastResult: RoundResult | null;
  dividend?: DividendView | null;
  report: FinalReport | null;
  nextRoomCode: string | null;
  operatorToken?: string;
}

export type ClientMsg =
  | { t: 'hello'; code: string; token?: string | null; operatorToken?: string | null; display?: boolean }
  | { t: 'start' }
  | { t: 'order'; requestId: string; code: StockCode; side: Side; qty: number; kind?: OrderKind; limit?: number }
  | { t: 'cancel'; requestId: string; code: StockCode }
  | { t: 'stop'; requestId: string; code: StockCode; stop: number | null; take: number | null }
  | { t: 'card'; choice: 'A' | 'B' }
  | { t: 'predict'; choice: 'A' | 'B'; confidence: number }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'welcome'; token: string | null; role: Role; label: string | null; code: string }
  | { t: 'view'; view: RoomView }
  | { t: 'ack'; requestId: string; ok: boolean; reason?: string; fill?: FillInfo | null }
  /** 장중 시세 한 칸(1초). k는 주문 시간 시작부터 지난 초 */
  | { t: 'tick'; round: number; k: number; prices: Partial<Record<StockCode, number>> }
  | { t: 'error'; reason: string }
  | { t: 'pong' };
