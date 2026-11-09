/* 서버와 클라이언트가 함께 쓰는 공개 타입. 미래 결말과 시드는 여기에 없습니다. */
export type StockCode = 'G01' | 'G02' | 'G03' | 'G04' | 'G05' | 'G06';
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
  /** 봉 차트용 고가·저가. 라운드 안 가격 움직임은 계산하지 않으므로 '연출'입니다(stagedWicks). 예전 저장 데이터에는 없습니다. */
  high?: number;
  low?: number;
}

export interface Order {
  code: StockCode; side: Side; qty: number; price: number;
  gross: number; fee: number; reserve: number; requestId: string; placedAt: number;
}
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
  price: number; lastChangeBp: number | null; history: PriceBreakdown[]; startPrice: number;
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
  delta: number; fees: number; contributions: Contribution[]; best: Contribution | null;
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
  holdings: { code: StockCode; name: string; qty: number; avgCost: number; price: number; pnl: number }[];
  orders: Order[];
  fillLog: { round: number; code: StockCode; side: Side; qty: number; price: number; fee: number }[];
}
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
  report: FinalReport | null;
  nextRoomCode: string | null;
  operatorToken?: string;
}

export type ClientMsg =
  | { t: 'hello'; code: string; token?: string | null; operatorToken?: string | null; display?: boolean }
  | { t: 'start' }
  | { t: 'order'; requestId: string; code: StockCode; side: Side; qty: number }
  | { t: 'cancel'; requestId: string; code: StockCode }
  | { t: 'card'; choice: 'A' | 'B' }
  | { t: 'predict'; choice: 'A' | 'B'; confidence: number }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'welcome'; token: string | null; role: Role; label: string | null; code: string }
  | { t: 'view'; view: RoomView }
  | { t: 'ack'; requestId: string; ok: boolean; reason?: string }
  | { t: 'error'; reason: string }
  | { t: 'pong' };
