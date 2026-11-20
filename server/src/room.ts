/* 방 하나의 게임 상태 기계. 네트워크와 DB를 모르는 순수 로직이라 시계를 주입해 테스트합니다.
   RoomState는 평범한 JSON이라 그대로 DB에 저장하고 복구할 수 있습니다. */
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { cleanLabel, CONFIDENCES, gameConfig, LABEL_MAX, checkOrder, computeClose, viDirection, VI_SECONDS, dividendRound, exDividendPrice, chargeOf, taxOf, fundOf, GROUPS, intradayPath, LEGACY_CODES, lowerLimit, marketFill, quoteBook, REACT_BP, SHOCK_BP, START_CASH, stockOf, TICK_WON, upperLimit, WIGGLE_X, type QuoteBook, type StockDef } from '../../shared/rules';
import type { CardView, Contribution, CrowdView, PredictionTrendRow, PredictionView, DividendPaid, DividendView, EventImpact, FillInfo, StopOrder, GameMode, Holding, LeaderRow, NewsCard, NewsResult, NpcType, Order, OrderKind, PriceBreakdown, Role, RoomSettings, ScheduleItem, RoomStatus, RoomView, RoundNews, RoundResult, Side, StockCode, StockView, Phase } from '../../shared/types';
import { arcOfStage, cardById, stageById } from './content';
import { NPC_RULES, NPC_TYPES } from './npc';
import { buildPlan, mulberry, type ForcedOutcomes, type GamePlan } from './plan';
import { buildReport } from './report';

/** refPrice: 체결 순간의 장중 시세. kind: 시장가(바로 체결)·지정가(예약). k: 주문 시간 시작부터 지난 초 */
export interface Fill { round: number; code: StockCode; side: Side; qty: number; price: number; refPrice?: number; /** 수수료 + 거래세 */ fee: number; /** 그중 거래세(매도만) */ tax?: number; gross: number; realized: 'gain' | 'loss' | null; requestId: string; kind?: OrderKind; k?: number; trigger?: 'stop' | 'take' }
/** 이번 라운드 장중 시세. paths[code][k]가 k초의 가격입니다. done이면 종료가가 정해진 뒤입니다. */
export interface LiveState { round: number; startedAt: number; steps: number; k: number; breakAt: number | null; paths: Record<StockCode, number[]>; done: boolean;
  /** 변동성 완화장치(VI)로 거래를 멈춘 종목: 멈춘 시각(k)과 풀리는 시각(k). 예전 저장 데이터에는 없습니다 */
  halts?: Partial<Record<StockCode, { from: number; until: number; dir: 1 | -1 }>>; }
export interface Observation {
  round: number;
  paperGain: number; paperLoss: number; realizedGain: number; realizedLoss: number;
  buys: { code: StockCode; gross: number; followedHeadline: boolean; herd: boolean | null; beat: boolean | null }[];
}
export interface Prediction { stageId: string; choice: 'up' | 'down'; confidence: number; correct: boolean | null }
export interface Player {
  id: string; token: string; label: string; kind: 'human' | 'npc'; npcType: NpcType | null; joinedAt: number; connected: boolean;
  cash: number; holdings: Partial<Record<StockCode, Holding>>; orders: Partial<Record<StockCode, Order>>;
  /** 요청 ID별 응답. 같은 요청이 다시 와도 새 주문을 만들지 않습니다. */
  requests: Record<string, { ok: boolean; reason?: string; round?: number }>;
  fills: Fill[]; fees: number; valueHist: number[]; rankHist: number[]; results: RoundResult[];
  cards: Record<number, 'A' | 'B'>;
  /** 라운드별 결과 예측. correct는 정산 때 채웁니다. 예전 저장 데이터에는 없습니다 */
  predictions?: Record<number, Prediction>;
  observations: Observation[];
  /** 결과 화면에서 '다 봤어요'를 누른 마지막 라운드 */
  doneRound?: number;
  /** 받은 배당금. 예전 저장 데이터에는 없습니다 */
  dividends?: DividendPaid[];
  /** 손절·익절 자동 주문. 예전 저장 데이터에는 없습니다 */
  stops?: Partial<Record<StockCode, StopOrder>>;
}
export interface RoomState {
  code: string; mode: GameMode; seed: number; status: RoomStatus; hostId: string | null;
  createdAt: number; updatedAt: number; plan: GamePlan; excludedArcs: string[]; round: number; phase: Phase | null;
  phaseEndsAt: number | null; phaseSeconds: number; newsStartedAt: number; secondRevealed: boolean;
  players: Player[]; spectators: string[];
  prices: Record<StockCode, number>; history: Record<StockCode, PriceBreakdown[]>;
  settled: number[]; nextRoomCode: string | null;
  settings?: RoomSettings;
  /** 배당락을 적용한 라운드(중복 방지). 예전 저장 데이터에는 없습니다 */
  exDividendRound?: number | null;
  /** 장중 시세. 예전 저장 데이터에는 없습니다 */
  live?: LiveState | null;
  /** 운영자 열쇠. 있으면 운영자가 진행하는 방(학술제)입니다. 운영자 기기에만 있고 화면(view)으로는 절대 나가지 않습니다 */
  operatorToken?: string | null;
}
export type OrderResult = { ok: boolean; reason?: string; duplicate?: boolean; fill?: FillInfo | null };
/** 한 라운드에 참가자 한 명이 보낼 수 있는 주문·취소 요청 수. 넘으면 거절해 저장 상태가 무한히 커지지 않게 합니다. */
export const MAX_REQUESTS_PER_ROUND = 200;

const ANIMALS = ['사슴', '수달', '고래', '너구리', '판다', '여우', '참새', '두루미', '해달', '토끼', '다람쥐', '거북'];
const token = () => randomBytes(18).toString('base64url');
const npcId = (t: NpcType) => `npc-${t}`;
/** 이번 판에 나오는 종목. 예전에 저장된 방(stockCodes 없음)은 처음 6종목으로 봅니다. */
/** 방에 기억해 두는 관전자 열쇠 수 상한 */
const MAX_SPECTATOR_TOKENS = 500;
export const gameCodes = (plan: GamePlan): StockCode[] => plan.stockCodes ?? LEGACY_CODES;
const initialPrices = (codes: StockCode[]) => Object.fromEntries(codes.map(c => [c, stockOf(c).start])) as Record<StockCode, number>;

function newPlayer(kind: 'human' | 'npc', label: string, now: number, npcType: NpcType | null = null, id?: string): Player {
  return { id: id ?? token().slice(0, 10), token: kind === 'human' ? token() : '', label, kind, npcType, joinedAt: now, connected: kind === 'human', cash: START_CASH, holdings: {}, orders: {}, requests: {}, fills: [], fees: 0, valueHist: [START_CASH], rankHist: [], results: [], cards: {}, predictions: {}, observations: [] };
}

export class GameRoom {
  s: RoomState;
  /** 마지막 tick 이후 체결이 생긴 참가자. 서버가 이 사람들에게만 화면을 다시 보냅니다. */
  touched = new Set<string>();
  constructor(state: RoomState) { this.s = state; }

  static create(opts: { code: string; mode: GameMode; now: number; seed?: number; excludedArcs?: string[]; forced?: ForcedOutcomes; forcedArcs?: string[]; settings?: RoomSettings; operated?: boolean }): GameRoom {
    const seed = opts.seed ?? randomInt(2 ** 31);
    const excluded = opts.excludedArcs ?? [];
    const plan = buildPlan(seed, opts.mode, excluded, opts.forced, opts.forcedArcs, opts.settings);
    const npcs = NPC_TYPES.map(t => newPlayer('npc', `NPC ${NPC_RULES[t].label}`, opts.now, t, npcId(t)));
    return new GameRoom({
      code: opts.code, mode: opts.mode, seed, status: 'lobby', hostId: null,
      createdAt: opts.now, updatedAt: opts.now, plan, excludedArcs: excluded, round: 0, phase: null, phaseEndsAt: null, phaseSeconds: 0, newsStartedAt: 0, secondRevealed: false,
      players: npcs, spectators: [], prices: initialPrices(gameCodes(plan)), history: Object.fromEntries(gameCodes(plan).map(c => [c, []])) as unknown as Record<StockCode, PriceBreakdown[]>,
      settled: [], nextRoomCode: null, live: null, settings: opts.settings,
      operatorToken: opts.operated ? token() : null
    });
  }

  /** 이번 판 종목 정의(업종 순서). */
  get stocks(): StockDef[] { return gameCodes(this.s.plan).map(stockOf); }
  get humans() { return this.s.players.filter(p => p.kind === 'human'); }
  /** 지금 접속 중인 참가자 수. 대기실 인원 표시와 시작 조건에 씁니다. */
  get online() { return this.humans.filter(p => p.connected).length; }
  get config() { return gameConfig(this.s.mode, this.s.settings); }
  /** 운영자의 '다음 단계': 뉴스·장·결과 단계의 남은 시간을 0으로 만들어, 다음 타이머(0.1초)에서 시간이 다 된 것과 같은 경로로 넘깁니다 */
  skipPhase(now: number): boolean {
    const s = this.s;
    if (s.status !== 'playing' || s.phaseEndsAt === null || (s.phase !== 'news' && s.phase !== 'trade' && s.phase !== 'recap')) return false;
    if (s.phaseEndsAt > now) s.phaseEndsAt = now;
    return true;
  }
  /** 라운드별 예측 정답 수(사람만). 결과가 정해진 라운드만 셉니다 */
  private predictionTrend(): PredictionTrendRow[] {
    const rows: PredictionTrendRow[] = [];
    for (let r = 1; r <= this.s.round; r++) {
      const picks = this.humans.map(p => p.predictions?.[r]).filter(x => x && x.correct !== null);
      rows.push({ round: r, total: picks.length, correct: picks.filter(x => x!.correct).length });
    }
    return rows;
  }
  /** 운영자가 진행하는 방인가 */
  get operated() { return !!this.s.operatorToken; }
  /** 운영자 열쇠가 맞는가. 길이가 다르거나 비어 있으면 거짓 */
  isOperator(key: string | null | undefined) {
    const real = this.s.operatorToken;
    if (!real || typeof key !== 'string' || key.length !== real.length) return false;
    return timingSafeEqual(Buffer.from(key), Buffer.from(real));
  }
  /** 시작에 필요한 사람 수. 운영자 방은 운영자가 판단하므로 1명이면 됩니다(리허설용) */
  get minToStart() { return this.operated ? 1 : this.config.minToStart; }
  player(tokenValue: string | null | undefined) { return tokenValue ? this.s.players.find(p => p.token === tokenValue) ?? null : null; }

  /** 재접속 토큰이 맞으면 복구, 시작 전이면 참가, 시작 후 처음 온 사람은 관전자입니다. */
  join(tokenValue: string | null | undefined, now: number): { token: string; role: Role; label: string | null } {
    const existing = this.player(tokenValue);
    if (existing) { existing.connected = true; this.fixHost(); return { token: existing.token, role: 'player', label: existing.label }; }
    if (tokenValue && this.s.spectators.includes(tokenValue)) return { token: tokenValue, role: 'spectator', label: null };
    /* 대기실이 꽉 찼으면 접속이 끊긴 자리(탭을 닫은 사람)를 먼저 비웁니다. 80명 방에서 새로고침만으로 자리가 다 차는 것을 막습니다. */
    if (this.s.status === 'lobby' && this.humans.length >= this.config.maxPlayers) {
      const gone = this.humans.filter(p => !p.connected).sort((x, y) => x.joinedAt - y.joinedAt)[0];
      if (gone) this.s.players = this.s.players.filter(x => x !== gone);
    }
    if (this.s.status !== 'lobby' || this.humans.length >= this.config.maxPlayers) {
      const t = token(); this.s.spectators.push(t);
      /* 관전자 열쇠는 다시 들어올 때 알아보는 용도라, 너무 많아지면 오래된 것부터 버립니다(방 상태가 끝없이 커지지 않게) */
      if (this.s.spectators.length > MAX_SPECTATOR_TOKENS) this.s.spectators.splice(0, this.s.spectators.length - MAX_SPECTATOR_TOKENS);
      return { token: t, role: 'spectator', label: null };
    }
    const p = newPlayer('human', this.uniqueLabel(), now);
    this.s.players.push(p);
    this.fixHost();
    this.touch(now);
    return { token: p.token, role: 'player', label: p.label };
  }
  /** 참가자가 이름을 바꿉니다. 대기실에서만, 방 안에서 겹치지 않게. */
  rename(tokenValue: string, raw: string, now: number): { ok: boolean; reason?: string; label?: string } {
    const p = this.player(tokenValue);
    if (!p || p.kind !== 'human') return { ok: false, reason: '참가자만 이름을 바꿀 수 있습니다' };
    if (this.s.status !== 'lobby') return { ok: false, reason: '게임이 시작된 뒤에는 바꿀 수 없습니다' };
    const label = cleanLabel(raw);
    if (!label) return { ok: false, reason: `이름은 1~${LABEL_MAX}자로 적어 주세요` };
    if (label === p.label) return { ok: true, label };
    if (this.s.players.some(x => x !== p && x.label === label)) return { ok: false, reason: '이미 쓰고 있는 이름입니다' };
    p.label = label;
    this.touch(now);
    return { ok: true, label };
  }
  private uniqueLabel() {
    for (;;) {
      const label = `${ANIMALS[randomInt(ANIMALS.length)]} ${randomInt(10, 100)}`;
      if (!this.s.players.some(p => p.label === label)) return label;
    }
  }
  /** 대기실에서 방장이 나가면 가장 먼저 들어온 접속 중 참가자에게 넘깁니다. 시작한 판은 방장과 상관없이 진행합니다. */
  /** 서버를 다시 켜서 불러온 방: 아직 아무도 연결되어 있지 않으므로 모두 끊김으로 두고 방장을 다시 정합니다. */
  resetConnections() {
    this.s.players.forEach(p => { if (p.kind === 'human') p.connected = false; });
    this.fixHost();
  }
  private fixHost() {
    /* 운영자 방에는 참가자 방장이 없습니다. 시작·재대전은 운영자만 합니다. */
    if (this.operated) { this.s.hostId = null; return; }
    const host = this.humans.find(p => p.id === this.s.hostId);
    if (host?.connected) return;
    if (this.s.status !== 'lobby' && host) return;
    const next = this.humans.filter(p => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    this.s.hostId = next ? next.id : null;
  }
  disconnect(tokenValue: string, now: number) {
    const p = this.player(tokenValue);
    if (!p) return;
    p.connected = false;
    this.fixHost();
    /* 결과 화면에서 기다리던 사람이 나가면, 남은 사람이 모두 '다 봤어요'를 눌렀는지 다시 봅니다 */
    this.finishRecapIfAllDone(now);
    this.touch(now);
  }
  /** 결과 화면 '다 봤어요'. 운영자 방은 운영자가 진행하므로 받지 않습니다 */
  markDone(tokenValue: string | null, now: number): boolean {
    const p = this.player(tokenValue);
    if (!p || p.kind !== 'human' || this.operated || this.s.status !== 'playing' || this.s.phase !== 'recap') return false;
    p.doneRound = this.s.round;
    this.finishRecapIfAllDone(now);
    this.touch(now);
    return true;
  }
  /** 접속 중인 사람이 모두 '다 봤어요'를 눌렀으면 결과 단계를 바로 끝냅니다(시간이 다 된 것과 같은 경로) */
  private finishRecapIfAllDone(now: number) {
    if (this.operated || this.s.status !== 'playing' || this.s.phase !== 'recap') return;
    const on = this.humans.filter(h => h.connected);
    if (on.length && on.every(h => h.doneRound === this.s.round)) this.skipPhase(now);
  }
  private recapDoneView(p: Player | null) {
    if (this.operated || this.s.status !== 'playing' || this.s.phase !== 'recap') return null;
    const on = this.humans.filter(h => h.connected);
    return { done: on.filter(h => h.doneRound === this.s.round).length, total: on.length, me: !!p && p.doneRound === this.s.round };
  }
  /** 시작 전에 직접 나가면 자리를 비웁니다. 시작 후에는 접속만 끊기고 주문은 그대로 체결됩니다. */
  leave(tokenValue: string, now: number) {
    const p = this.player(tokenValue);
    if (!p) return;
    if (this.s.status === 'lobby') this.s.players = this.s.players.filter(x => x !== p);
    else p.connected = false;
    this.fixHost();
    this.touch(now);
  }
  private touch(now: number) { this.s.updatedAt = now; }

  /** operatorKey: 운영자 연결이면 운영자 열쇠. 운영자 방에서는 운영자만, 그 밖의 방에서는 방장만 시작합니다. */
  canStart(tokenValue: string | null | undefined, operatorKey?: string | null) {
    if (this.s.status !== 'lobby') return false;
    if (this.online < this.minToStart) return false;
    if (this.operated) return this.isOperator(operatorKey);
    return this.player(tokenValue)?.id === this.s.hostId;
  }
  start(now: number) {
    this.s.status = 'playing';
    this.s.round = 0;
    this.recordRanks();
    this.beginRound(1, now);
  }
  private setPhase(phase: Phase, seconds: number, now: number) {
    this.s.phase = phase; this.s.phaseSeconds = seconds; this.s.phaseEndsAt = now + seconds * 1000; this.touch(now);
  }
  private beginRound(r: number, now: number) {
    this.s.round = r;
    /* 중복 확인용 요청 기록은 직전 라운드까지만 남깁니다. 클라이언트 재전송은 6초 안에 끝나므로 충분합니다. */
    this.s.players.forEach(p => {
      for (const [id, v] of Object.entries(p.requests)) if ((v.round ?? 0) < r - 1) delete p.requests[id];
    });
    this.s.secondRevealed = false;
    this.s.newsStartedAt = now;
    if (r === dividendRound(this.config.rounds) + 1) this.payDividends(r);
    this.setPhase('news', this.config.news, now);
  }
  /** 배당 종목(이번 판에서 주당 배당금이 있는 종목) */
  private dividendItems() { return this.stocks.filter(st => fundOf(st.code).dps > 0).map(st => ({ code: st.code, name: st.name, dps: fundOf(st.code).dps })); }
  /** 기준일 다음 라운드 시작: 기준일 장 마감 때 가진 사람에게 배당금을 넣고, 시가를 배당금만큼 낮춥니다(배당락).
      입금과 가격 하락이 같은 순간이라 평가액은 그대로입니다. */
  private payDividends(r: number) {
    if (this.s.exDividendRound === r) return;
    this.s.exDividendRound = r;
    for (const it of this.dividendItems()) {
      for (const p of this.s.players) {
        const qty = p.holdings[it.code]?.qty ?? 0;
        if (!qty) continue;
        const amount = qty * it.dps;
        p.cash += amount;
        (p.dividends ??= []).push({ round: r, code: it.code, qty, dps: it.dps, amount });
      }
      const before = this.s.prices[it.code];
      this.s.prices[it.code] = exDividendPrice(before, it.dps);
      /* 걸어 둔 손절가·익절가도 같은 만큼 낮춥니다. 그대로 두면 배당락만으로 장 시작과 함께 손절이 걸립니다. */
      const drop = before - this.s.prices[it.code];
      for (const p of this.s.players) {
        const st = p.stops?.[it.code];
        if (!st) continue;
        const shift = (v: number | null) => v === null || v - drop < TICK_WON ? null : v - drop;
        st.stop = shift(st.stop); st.take = shift(st.take);
        if (st.stop === null && st.take === null) delete p.stops![it.code];
      }
    }
  }
  private dividendView(): DividendView | null {
    const items = this.dividendItems();
    if (!items.length || this.s.status === 'lobby') return null;
    const rd = dividendRound(this.config.rounds), r = this.s.round;
    const status = r < rd - 1 ? 'before' : r === rd - 1 ? 'upcoming' : r === rd ? 'record' : r === rd + 1 ? 'ex' : 'done';
    return { recordRound: rd, status, items };
  }
  /** 시간이 된 전환을 수행합니다. 'settled'를 돌려주면 저장 후 beginRecap을 불러야 합니다. */
  /** 'tick'이면 장중 시세 한 칸이 지났습니다(가벼운 시세 메시지만 보내면 됨). */
  tick(now: number): 'none' | 'tick' | 'changed' | 'settled' | 'finished' {
    const s = this.s;
    if (s.status !== 'playing' || s.phaseEndsAt === null || s.phase === 'settling') return 'none';
    let out: 'none' | 'tick' | 'changed' = 'none';
    if (s.phase === 'trade' && s.live && s.live.round === s.round && !s.live.done) {
      const k = Math.min(s.live.steps, Math.floor((now - s.live.startedAt) / 1000));
      while (s.live.k < k) {
        s.live.k++;
        out = out === 'none' ? 'tick' : out;
        if (this.checkVi()) out = 'changed';
        this.matchLimits(now);
        this.checkStops(now);
        /* 장중 속보: 주문 시간 중간에 두 번째 뉴스가 뜨고, 같은 순간 시세가 헤드라인 방향으로 튑니다. */
        if (s.live.breakAt !== null && s.live.k >= s.live.breakAt && !s.secondRevealed) {
          s.secondRevealed = true;
          this.runChaserOnBreaking(now);
          out = 'changed';
        }
      }
    }
    if (now < s.phaseEndsAt) return out;
    if (s.phase === 'news') {
      this.setPhase('trade', this.config.trade, now);
      this.startTrade(now);
      this.checkStops(now);   // 밤사이(결과 공개로) 이미 손절가·익절가를 넘었으면 장 시작하자마자 팝니다
      this.runNpcs(now);
      return 'changed';
    }
    if (s.phase === 'trade') {
      this.settle(this.s.round, now);
      s.phase = 'settling'; s.phaseEndsAt = null;
      return 'settled';
    }
    if (s.round >= this.config.rounds) { s.status = 'finished'; s.phase = null; s.phaseEndsAt = null; this.touch(now); return 'finished'; }
    this.beginRound(s.round + 1, now);
    return 'changed';
  }
  beginRecap(now: number) { if (this.s.phase === 'settling') this.setPhase('recap', this.config.recap, now); }
  get currentRound() { return this.s.plan.rounds[this.s.round - 1]; }

  private visibleStages() {
    const r = this.currentRound;
    if (!r) return [];
    return r.stages.filter(st => !st.breaking || this.s.secondRevealed);
  }
  /** 주문 시간을 시작하며 종목별 장중 경로를 만듭니다. 사건 결과는 넣지 않습니다(shared/rules.ts intradayPath). */
  private startTrade(now: number) {
    const r = this.currentRound, steps = Math.max(1, Math.round(this.config.trade));
    const breaking = r.stages.find(st => st.breaking);
    const breakAt = breaking ? Math.max(1, Math.floor(steps / 2)) : null;
    const signal = breaking ? stageById.get(breaking.stageId)!.signal : {};
    const paths = {} as Record<StockCode, number[]>;
    this.stocks.forEach(st => {
      const lead = GROUPS[st.group].leader;
      const dir = signal[st.code] ?? 0, leadDir = st.code !== lead ? signal[lead] ?? 0 : 0;
      const reactBp = breaking?.shock ? SHOCK_BP : REACT_BP;
      const react = dir ? dir * reactBp : leadDir ? Math.round(leadDir * reactBp * st.linkBeta) : 0;
      const rnd = mulberry(this.s.seed ^ Math.imul(this.s.round, 0x9E3779B1) ^ Math.imul(Number(st.code.slice(1)), 0x85EBCA6B));
      paths[st.code] = intradayPath(rnd, this.s.prices[st.code], r.marketBp + (r.stockBp[st.code] ?? 0) + react, steps, st.maxMoveBp * WIGGLE_X,
        breakAt !== null && react ? { at: breakAt, bp: react } : undefined);
    });
    this.s.live = { round: this.s.round, startedAt: now, steps, k: 0, breakAt, paths, done: false, halts: {} };
  }
  /* ---------- 변동성 완화장치(VI) ---------- */
  /** 이 종목이 지금 VI로 멈춰 있는지. 멈춰 있으면 풀릴 때까지 남은 초, 아니면 0 */
  haltLeft(code: StockCode): number {
    const l = this.s.live;
    if (!l || l.done || l.round !== this.s.round || this.s.phase !== 'trade') return 0;
    const h = l.halts?.[code];
    return h && l.k < h.until ? h.until - l.k : 0;
  }
  /** 시가 대비 ±10%를 넘긴 종목의 거래를 잠깐 멈춥니다. 한 라운드에 종목마다 한 번만 걸립니다. */
  private checkVi(): boolean {
    const l = this.s.live;
    if (!l || l.done) return false;
    if (!l.halts) l.halts = {};
    let changed = false;
    for (const st of this.stocks) {
      if (l.halts[st.code]) continue;                 // 이번 라운드에 이미 걸렸던 종목은 넘어갑니다
      const path = l.paths[st.code];
      if (!path) continue;
      const dir = viDirection(path[0], path[Math.min(l.k, l.steps)]);
      if (!dir) continue;
      l.halts[st.code] = { from: l.k, until: Math.min(l.steps, l.k + VI_SECONDS), dir };
      /* 멈춰 있는 동안 걸어 둔 예약은 취소합니다(실제로도 단일가로 넘어가며 호가가 정리됩니다). */
      for (const p of this.s.players) if (p.orders[st.code]) { delete p.orders[st.code]; this.touched.add(p.id); }
      changed = true;
    }
    return changed;
  }

  /** 지금 가격. 주문 시간에는 장중 시세, 그 밖에는 직전 종료가 */
  markPrice(code: StockCode): number {
    const l = this.s.live;
    if (l && !l.done && l.round === this.s.round && l.paths[code]) return l.paths[code][Math.min(l.k, l.steps)];
    return this.s.prices[code];
  }
  /** 지금 호가창(모두에게 같은 값). 주문 시간 밖에서는 기준가 기준 */
  book(code: StockCode): QuoteBook {
    const l = this.s.live;
    const k = l && !l.done && l.round === this.s.round ? Math.min(l.k, l.steps) : 0;
    return quoteBook(code, this.markPrice(code), this.s.prices[code], this.s.round, k);
  }
  /** 최우선 매수 호가(시장가로 팔 때 받는 첫 가격). 없으면 null */
  bestBid(code: StockCode): number | null { const p = this.markPrice(code) - TICK_WON; return p >= lowerLimit(this.s.prices[code]) && p >= TICK_WON ? p : null; }
  private livePrices(): Record<StockCode, number> {
    return Object.fromEntries(this.stocks.map(st => [st.code, this.markPrice(st.code)])) as Record<StockCode, number>;
  }
  private npcContext() {
    const lastChangeBp: Partial<Record<StockCode, number>> = {};
    this.stocks.forEach(st => { const h = this.s.history[st.code]; if (h.length) lastChangeBp[st.code] = h[h.length - 1].changeBp; });
    return { lastChangeBp, prices: this.livePrices() };
  }
  private runNpcs(now: number) {
    const r = this.currentRound;
    const signals: Partial<Record<StockCode, 1 | -1>> = {};
    this.visibleStages().forEach(st => Object.assign(signals, stageById.get(st.stageId)!.signal));
    const { lastChangeBp, prices } = this.npcContext();
    void r;
    this.s.players.filter(p => p.kind === 'npc').forEach(p => {
      NPC_RULES[p.npcType!].decide({ round: this.s.round, signals, prices, lastChangeBp, ctx: p }).forEach((o, i) => {
        if (o.qty >= 1) this.applyOrder(p, `npc-${this.s.round}-${i}`, o.code, o.side, o.qty, now);
      });
    });
  }
  /** 장중 속보가 뜨면 속보 추격형 NPC만 그 헤드라인에 반응합니다. */
  private runChaserOnBreaking(now: number) {
    const st = this.currentRound.stages.find(x => x.breaking);
    if (!st) return;
    const signals = { ...stageById.get(st.stageId)!.signal };
    const { lastChangeBp, prices } = this.npcContext();
    this.s.players.filter(p => p.npcType === 'chaser').forEach(p => {
      NPC_RULES.chaser.decide({ round: this.s.round, signals, prices, lastChangeBp, ctx: p }).forEach((o, i) => {
        if (o.qty >= 1) this.applyOrder(p, `npc-${this.s.round}-b${i}`, o.code, o.side, o.qty, now);
      });
    });
  }

  /** 서버가 받은 시점으로 마감을 판단합니다. 마감 시각과 같거나 늦으면 거절합니다.
      kind 'market'(기본)은 지금 시세로 바로 체결, 'limit'은 limit 가격에 예약합니다. */
  placeOrder(tokenValue: string, requestId: string, code: StockCode, side: Side, qty: number, now: number, kind: OrderKind = 'market', limit?: number): OrderResult {
    const p = this.player(tokenValue);
    if (!p) return { ok: false, reason: '참가자만 주문할 수 있습니다' };
    if (!requestId) return { ok: false, reason: '요청 ID가 없습니다' };
    const seen = p.requests[requestId];
    if (seen) return { ok: seen.ok, reason: seen.reason, duplicate: true };
    if (this.tooManyRequests(p)) return { ok: false, reason: '이번 라운드 요청이 너무 많습니다' };
    if (!stockOf(code) || !gameCodes(this.s.plan).includes(code)) return { ok: false, reason: '없는 종목입니다' };
    if (side !== 'buy' && side !== 'sell') return { ok: false, reason: '잘못된 주문입니다' };
    if (kind !== 'market' && kind !== 'limit') return { ok: false, reason: '잘못된 주문입니다' };
    if (kind === 'limit' && this.config.level === 'easy') return { ok: false, reason: '쉬움 난이도에서는 시장가로만 주문할 수 있습니다' };
    const halt = this.haltLeft(code);
    if (halt) return { ok: false, reason: `변동성 완화장치(VI)로 거래가 멈췄습니다. ${halt}초 뒤에 다시 주문할 수 있어요` };
    const res = this.applyOrder(p, requestId, code, side, qty, now, kind, limit);
    p.requests[requestId] = { ok: res.ok, reason: res.reason, round: this.s.round };
    return res;
  }
  private tooManyRequests(p: Player) {
    return Object.values(p.requests).filter(v => v.round === this.s.round).length >= MAX_REQUESTS_PER_ROUND;
  }
  private tradeOpen(now: number) { return this.s.status === 'playing' && this.s.phase === 'trade' && this.s.phaseEndsAt !== null && now < this.s.phaseEndsAt; }
  private applyOrder(p: Player, requestId: string, code: StockCode, side: Side, qty: number, now: number, kind: OrderKind = 'market', limit?: number): OrderResult {
    if (!this.tradeOpen(now)) return { ok: false, reason: '이번 라운드 주문 마감' };
    const ref = this.markPrice(code);
    if (kind === 'limit') {
      const open = this.s.prices[code];
      if (!Number.isSafeInteger(limit) || limit! % 10 !== 0) return { ok: false, reason: '지정가는 10원 단위로 입력해 주세요' };
      if (limit! < lowerLimit(open) || limit! > upperLimit(open)) return { ok: false, reason: `지정가는 ${lowerLimit(open).toLocaleString('ko-KR')}~${upperLimit(open).toLocaleString('ko-KR')}원(가격 제한폭) 안이어야 합니다` };
      const chk = checkOrder(p, code, side, qty, ref, { limit });
      if (!chk.ok) return { ok: false, reason: chk.reason };
      delete p.orders[code];
      /* 지금 호가가 이미 지정가보다 유리하면 바로 체결합니다(지정가보다 불리하게는 체결하지 않음). */
      const bid = this.bestBid(code);
      if (side === 'buy' ? ref <= limit! : bid !== null && bid >= limit!) {
        const mk = marketFill(this.book(code), side, qty)?.price ?? limit!;
        const price = side === 'buy' ? Math.min(mk, limit!) : Math.max(mk, limit!);
        return { ok: true, fill: this.executeFill(p, code, side, qty, price, ref, requestId, 'limit', now) };
      }
      p.orders[code] = { code, side, qty, kind: 'limit', price: limit!, refPrice: ref, slipBp: 0, gross: chk.gross, fee: chk.fee, reserve: chk.reserve, requestId, placedAt: now };
      this.touch(now);
      return { ok: true, fill: null };
    }
    const chk = checkOrder(p, code, side, qty, ref, { replace: false, book: this.book(code) });
    if (!chk.ok) return { ok: false, reason: chk.reason };
    return { ok: true, fill: this.executeFill(p, code, side, qty, chk.price, ref, requestId, 'market', now) };
  }
  /** 체결: 현금·보유 수량을 바로 바꾸고 체결 기록을 남깁니다. */
  private executeFill(p: Player, code: StockCode, side: Side, qty: number, price: number, ref: number, requestId: string, kind: OrderKind, now: number, trigger?: 'stop' | 'take'): FillInfo {
    const gross = price * qty, fee = chargeOf(side, gross), tax = side === 'sell' ? taxOf(gross) : 0;
    let realized: Fill['realized'] = null;
    if (side === 'buy') {
      p.cash -= gross + fee;
      const h = p.holdings[code] ?? (p.holdings[code] = { qty: 0, avgCost: 0, sinceRound: this.s.round });
      /* 평균 단가에 매수 수수료를 넣습니다. 넣지 않으면 사자마자 평가손익이 0으로 보여
         "자주 사고팔면 비용이 쌓인다"는 이 게임의 교훈과 화면이 어긋납니다. */
      h.avgCost = Math.round((h.avgCost * h.qty + gross + fee) / (h.qty + qty));
      h.qty += qty;
    } else {
      const h = p.holdings[code]!;
      realized = price > h.avgCost ? 'gain' : 'loss';
      p.cash += gross - fee;
      h.qty -= qty;
      if (h.qty === 0) { delete p.holdings[code]; if (p.stops) delete p.stops[code]; }
    }
    p.fees += fee;
    p.fills.push({ round: this.s.round, code, side, qty, price, refPrice: ref, fee, ...(tax ? { tax } : {}), gross, realized, requestId, kind, k: this.s.live?.k ?? 0, ...(trigger ? { trigger } : {}) });
    this.touched.add(p.id);
    this.touch(now);
    return { code, side, qty, price, fee, ...(tax ? { tax } : {}), kind, ...(trigger ? { trigger } : {}) };
  }
  /** 손절·익절 설정. stop은 지금 시세보다 낮게, take는 높게, 10원 단위. 둘 다 null이면 지웁니다. 장중이 아니어도 설정할 수 있습니다. */
  setStop(tokenValue: string, requestId: string, code: StockCode, stop: number | null, take: number | null, now: number): OrderResult {
    const p = this.player(tokenValue);
    if (!p) return { ok: false, reason: '참가자만 설정할 수 있습니다' };
    const seen = p.requests[requestId];
    if (seen) return { ok: seen.ok, reason: seen.reason, duplicate: true };
    if (this.tooManyRequests(p)) return { ok: false, reason: '이번 라운드 요청이 너무 많습니다' };
    let res: OrderResult = { ok: true };
    const price = this.markPrice(code);
    const valid = (v: number | null) => v === null || (Number.isSafeInteger(v) && v > 0 && v % 10 === 0);
    if (this.s.status !== 'playing') res = { ok: false, reason: '게임 중에만 설정할 수 있습니다' };
    else if (this.config.level === 'easy') res = { ok: false, reason: '쉬움 난이도에서는 손절·익절을 쓰지 않습니다' };
    else if (!stockOf(code) || !gameCodes(this.s.plan).includes(code)) res = { ok: false, reason: '없는 종목입니다' };
    else if (!(p.holdings[code]?.qty)) res = { ok: false, reason: '가진 종목에만 걸 수 있습니다' };
    else if (!valid(stop) || !valid(take)) res = { ok: false, reason: '가격은 10원 단위로 입력해 주세요' };
    else if (stop !== null && stop >= price) res = { ok: false, reason: '손절가는 지금 시세보다 낮아야 합니다' };
    else if (take !== null && take <= price) res = { ok: false, reason: '익절가는 지금 시세보다 높아야 합니다' };
    else {
      p.stops ??= {};
      if (stop === null && take === null) delete p.stops[code];
      else p.stops[code] = { stop, take, setAt: now };
      this.touch(now);
    }
    p.requests[requestId] = { ok: res.ok, reason: res.reason, round: this.s.round };
    return res;
  }
  /** 손절가·익절가에 닿은 종목은 가진 수량(매도 예약에 묶인 수량 제외) 전부를 그 순간 호가창으로 시장가 매도합니다. */
  private checkStops(now: number) {
    if (this.s.phase !== 'trade') return;
    for (const p of this.s.players) for (const [code, st] of Object.entries(p.stops ?? {}) as [StockCode, StopOrder][]) {
      if (this.haltLeft(code)) continue;   // VI로 멈춘 동안에는 손절·익절도 걸리지 않습니다
      const price = this.markPrice(code);
      const trigger = st.stop !== null && price <= st.stop ? 'stop' : st.take !== null && price >= st.take ? 'take' : null;
      if (!trigger) continue;
      delete p.stops![code];
      const locked = p.orders[code]?.side === 'sell' ? p.orders[code]!.qty : 0;
      const qty = (p.holdings[code]?.qty ?? 0) - locked;
      if (qty < 1) continue;
      const fill = marketFill(this.book(code), 'sell', qty);
      if (!fill) continue;   // 하한가라 사려는 주문이 없으면 팔지 못합니다(실제 시장과 같음)
      this.executeFill(p, code, 'sell', qty, fill.price, price, `${trigger}-${this.s.round}-${this.s.live?.k ?? 0}`, 'market', now, trigger);
    }
  }
  /** 걸어 둔 지정가 주문 중 시세가 닿은 것을 지정가에 체결합니다. */
  private matchLimits(now: number) {
    for (const p of this.s.players) for (const o of Object.values(p.orders)) {
      if (!o || o.kind !== 'limit' || this.haltLeft(o.code)) continue;
      const price = this.markPrice(o.code);
      /* 매수 예약은 매도 호가(=시세)가, 매도 예약은 매수 호가(=시세 − 10원)가 지정가에 닿으면 체결 */
      const bid = this.bestBid(o.code);
      if (o.side === 'buy' ? price > o.price : bid === null || bid < o.price) continue;
      delete p.orders[o.code];
      if (o.side === 'sell' && (p.holdings[o.code]?.qty ?? 0) < o.qty) continue;   // 그사이 팔아 버린 수량은 체결하지 않음
      if (o.side === 'buy' && p.cash < o.reserve) continue;
      this.executeFill(p, o.code, o.side, o.qty, o.price, price, o.requestId, 'limit', now);
    }
  }
  cancelOrder(tokenValue: string, requestId: string, code: StockCode, now: number): OrderResult {
    const p = this.player(tokenValue);
    if (!p) return { ok: false, reason: '참가자만 취소할 수 있습니다' };
    const seen = p.requests[requestId];
    if (seen) return { ok: seen.ok, reason: seen.reason, duplicate: true };
    if (this.tooManyRequests(p)) return { ok: false, reason: '이번 라운드 요청이 너무 많습니다' };
    let res: OrderResult;
    if (!this.tradeOpen(now)) res = { ok: false, reason: '이번 라운드 주문 마감' };
    else if (!p.orders[code]) res = { ok: false, reason: '취소할 주문이 없습니다' };
    else { delete p.orders[code]; res = { ok: true }; }
    p.requests[requestId] = { ...res, round: this.s.round };
    return res;
  }
  answerCard(tokenValue: string, choice: 'A' | 'B', now: number) {
    const p = this.player(tokenValue);
    if (!p || !this.currentRound?.cardId || !this.tradeOpen(now) || (choice !== 'A' && choice !== 'B')) return false;
    if (p.cards[this.s.round]) return false; /* 고른 즉시 결과를 보여 주므로 다시 고를 수 없습니다 */
    p.cards[this.s.round] = choice;
    return true;
  }

  /** 결과 예측은 뉴스 시간과 주문 시간에 고르고 바꿀 수 있습니다. 결과가 공개되기 전(정산 전)에 닫힙니다. */
  private predictOpen(now: number) {
    return this.s.status === 'playing' && (this.s.phase === 'news' || this.s.phase === 'trade') && this.s.phaseEndsAt !== null && now < this.s.phaseEndsAt && !!this.currentRound?.stages[0];
  }
  predict(tokenValue: string, choice: 'up' | 'down', confidence: number, now: number) {
    const p = this.player(tokenValue);
    if (!p || !this.predictOpen(now) || (choice !== 'up' && choice !== 'down') || !(CONFIDENCES as readonly number[]).includes(confidence)) return false;
    (p.predictions ??= {})[this.s.round] = { stageId: this.currentRound!.stages[0].stageId, choice, confidence, correct: null };
    return true;
  }
  private predictionView(p: Player | null, now: number): PredictionView | null {
    const first = this.currentRound?.stages[0];
    if (!p || p.kind !== 'human' || this.s.status !== 'playing' || !first || !this.s.phase) return null;
    const pr = p.predictions?.[this.s.round];
    return {
      stageId: first.stageId, headline: stageById.get(first.stageId)!.headline,
      choice: pr?.choice ?? null, confidence: pr?.confidence ?? null, open: this.predictOpen(now),
      /* 결과 공개 전에는 맞았는지 알려 주지 않습니다(결말 힌트가 되므로) */
      correct: this.s.phase === 'recap' ? pr?.correct ?? null : null
    };
  }
  private crowdView(): CrowdView | null {
    const first = this.currentRound?.stages[0];
    if (this.s.status !== 'playing' || this.s.phase !== 'recap' || !first) return null;
    const picks = this.humans.map(p => p.predictions?.[this.s.round]).filter(x => x && x.stageId === first.stageId);
    if (!picks.length) return null;
    const beat = stageById.get(first.stageId)!.outcomes.find(o => o.id === first.outcomeId)!.beat;
    return { up: picks.filter(x => x!.choice === 'up').length, down: picks.filter(x => x!.choice === 'down').length, beat };
  }

  /** 평가액: 현금 + 보유 수량 × 지금 가격(주문 시간에는 장중 시세) */
  value(p: Player) { return p.cash + this.stocks.reduce((a, st) => a + (p.holdings[st.code]?.qty ?? 0) * this.markPrice(st.code), 0); }
  rankOf(p: Player) { const v = this.value(p); return 1 + this.s.players.filter(x => this.value(x) > v).length; }
  private recordRanks() { this.s.players.forEach(p => p.rankHist.push(this.rankOf(p))); }

  /** 라운드를 마감합니다. 라운드당 한 번만 실행되고, 재시도해도 settled에 있으면 아무 일도 하지 않습니다.
      체결은 주문 시간 동안 이미 끝났으므로 여기서는 남은 예약 취소, 종료가 계산, 라운드 결과 기록만 합니다. */
  settle(round: number, _now: number) {
    if (this.s.settled.includes(round)) return false;
    const plan = this.s.plan.rounds[round - 1];
    const live = this.s.live && this.s.live.round === round ? this.s.live : null;
    /* 장중 시세 마지막 값 기준으로 남은 예약을 한 번 더 맞춰 보고, 나머지는 자동 취소합니다. */
    if (live) { live.k = live.steps; this.matchLimits(_now); }
    this.s.players.forEach(p => { p.orders = {}; });
    const preClose = Object.fromEntries(this.stocks.map(st => [st.code, this.markPrice(st.code)])) as Record<StockCode, number>;
    const roundFills = new Map(this.s.players.map(p => [p.id, p.fills.filter(f => f.round === round)]));
    const headline: Partial<Record<StockCode, 1 | -1>> = {};
    const beatOf: Partial<Record<StockCode, boolean>> = {};
    plan.stages.forEach(st => {
      const stage = stageById.get(st.stageId)!, out = stage.outcomes.find(o => o.id === st.outcomeId)!;
      Object.assign(headline, stage.signal);
      stage.targets.forEach(c => { beatOf[c] = out.beat; });
    });
    /* 결과 예측 채점: 이번 라운드 첫 뉴스의 결과가 기대를 넘었는지 */
    const firstStage = plan.stages[0];
    const firstBeat = firstStage && stageById.get(firstStage.stageId)!.outcomes.find(o => o.id === firstStage.outcomeId)!.beat;
    this.s.players.forEach(p => {
      const pr = p.predictions?.[round];
      if (pr && firstStage && pr.stageId === firstStage.stageId) pr.correct = (pr.choice === 'up') === firstBeat;
    });
    /* 군집 행동은 사람끼리만 셉니다. 혼자 연습의 NPC를 따라 산 것은 군집 행동이 아닙니다. */
    const humanBuyers = this.humans.length > 1;
    const buyers: Partial<Record<StockCode, number>> = {};
    this.humans.forEach(h => new Set((roundFills.get(h.id) ?? []).filter(f => f.side === 'buy').map(f => f.code)).forEach(c => { buyers[c] = (buyers[c] ?? 0) + 1; }));

    /* 1. 행동 관찰(과신·처분 효과 지표 재료) */
    this.s.players.forEach(p => {
      const fs = roundFills.get(p.id)!;
      const obs: Observation = { round, paperGain: 0, paperLoss: 0, realizedGain: 0, realizedLoss: 0, buys: [] };
      const sold = new Set(fs.filter(f => f.side === 'sell').map(f => f.code));
      fs.forEach(f => { if (f.realized === 'gain') obs.realizedGain++; else if (f.realized === 'loss') obs.realizedLoss++; });
      /* 팔 수 있었지만 계속 들고 있는 종목은 평가이익·평가손실로 셉니다(Odean의 PGR/PLR). 매도한 라운드만 셉니다. */
      if (sold.size) this.stocks.forEach(st => {
        const h = p.holdings[st.code];
        if (!h || sold.has(st.code)) return;
        if (preClose[st.code] > h.avgCost) obs.paperGain++; else obs.paperLoss++;
      });
      const bought = new Map<StockCode, number>();
      fs.filter(f => f.side === 'buy').forEach(f => bought.set(f.code, (bought.get(f.code) ?? 0) + f.gross));
      const maxOthers = (code: StockCode) => Math.max(0, ...this.stocks.map(st => (buyers[st.code] ?? 0) - (st.code === code ? 1 : 0)));
      bought.forEach((gross, code) => {
        const others = (buyers[code] ?? 0) - 1;
        obs.buys.push({ code, gross, followedHeadline: headline[code] === 1, herd: humanBuyers ? others > 0 && others === maxOthers(code) : null, beat: beatOf[code] ?? null });
      });
      p.observations.push(obs);
    });

    /* 2. 종료가: 사건 결과 + 시장 + 종목 변동(장중 시세에서 이미 움직인 몫 포함). 고가·저가는 장중 시세와 종료가에서 */
    const bases = { ...this.s.prices };
    this.stocks.forEach(st => {
      const events: EventImpact[] = [];
      plan.stages.forEach(ps => {
        const out = stageById.get(ps.stageId)!.outcomes.find(o => o.id === ps.outcomeId)!;
        out.impacts.filter(i => i.code === st.code).forEach(i => events.push({ stageId: ps.stageId, label: out.label, bp: i.bp, reason: i.reason }));
        /* 업종 동조화: 같은 업종 대장주에 사건이 나면 함께 움직입니다(linkBeta배). */
        const leader = GROUPS[st.group].leader;
        if (leader !== st.code) out.impacts.filter(i => i.code === leader).forEach(i => {
          const bp = Math.round(i.bp * st.linkBeta);
          if (bp) events.push({ stageId: ps.stageId, label: `업종 동반 · ${out.label}`, bp, reason: `같은 업종(${GROUPS[st.group].label}) ${stockOf(leader).name} 소식에 함께 움직였습니다` });
        });
      });
      const c = computeClose(round, bases[st.code], events, plan.marketBp, plan.stockBp[st.code] ?? 0);
      const path = live?.paths[st.code] ?? [bases[st.code]];
      let buyQty = 0, sellQty = 0;
      roundFills.forEach(fs => fs.forEach(f => { if (f.code === st.code) { if (f.side === 'buy') buyQty += f.qty; else sellQty += f.qty; } }));
      const ex = this.s.exDividendRound === round && fundOf(st.code).dps > 0 ? fundOf(st.code).dps : undefined;
      const b: PriceBreakdown = { ...c, high: Math.max(c.closePrice, ...path), low: Math.min(c.closePrice, ...path), preClose: preClose[st.code], volume: buyQty + sellQty, buyQty, sellQty, ...(ex ? { exDividend: ex } : {}) };
      this.s.history[st.code].push(b);
      this.s.prices[st.code] = b.closePrice;
    });
    if (live) live.done = true;
    this.s.secondRevealed = true;

    /* 3. 라운드 결과 */
    const rankBefore = new Map(this.s.players.map(p => [p.id, p.rankHist[p.rankHist.length - 1] ?? 1]));
    this.s.settled.push(round);
    this.recordRanks();
    this.s.players.forEach(p => {
      const valueBefore = p.valueHist[p.valueHist.length - 1] ?? START_CASH;
      const valueAfter = this.value(p);
      p.valueHist.push(valueAfter);
      const fills = roundFills.get(p.id)!;
      /* 종목별 이번 라운드 손익 = 끝 수량 × 종료가 − 처음 수량 × 시가 − 산 금액 + 판 금액. 합계 − 수수료 = 평가액 변화 */
      const contributions: Contribution[] = [];
      this.stocks.forEach(st => {
        const fs = fills.filter(f => f.code === st.code);
        const qtyEnd = p.holdings[st.code]?.qty ?? 0;
        if (!qtyEnd && !fs.length) return;
        const net = fs.reduce((a, f) => a + (f.side === 'buy' ? f.qty : -f.qty), 0);
        const cashFlow = fs.reduce((a, f) => a + (f.side === 'buy' ? -f.gross : f.gross), 0);
        const won = qtyEnd * this.s.prices[st.code] - (qtyEnd - net) * bases[st.code] + cashFlow;
        contributions.push({ code: st.code, name: st.name, qty: qtyEnd, won });
      });
      contributions.sort((a, b) => Math.abs(b.won) - Math.abs(a.won));
      p.results.push({
        round, rankBefore: rankBefore.get(p.id)!, rankAfter: this.rankOf(p), valueBefore, valueAfter, delta: valueAfter - valueBefore,
        fees: fills.reduce((a, f) => a + f.fee, 0),
        /* 슬리피지 = 체결가와 최우선 호가의 차이. 팔 때 최우선 매수 호가는 시세보다 한 칸(10원) 낮습니다.
           예전에는 시세 기준이라 파는 쪽에 스프레드(주당 10원)가 섞여, 주문 전 미리보기(최우선 호가 기준)와 숫자가 달랐습니다. */
        slippage: fills.filter(f => f.kind !== 'limit').reduce((a, f) => {
          const ref = f.refPrice ?? f.price, best = f.side === 'sell' ? ref - TICK_WON : ref;
          return a + Math.abs(f.price - best) * f.qty;
        }, 0),
        contributions, best: contributions[0] ?? null,
        fills: fills.map(f => ({ code: f.code, side: f.side, qty: f.qty, price: f.price, fee: f.fee }))
      });
    });
    return true;
  }

  /** 장중 시세 메시지에 실을 [참가자 id, 지금 평가액]. 순위는 받는 쪽에서 leaderboard()와 같은 규칙으로 다시 매깁니다 */
  tickBoard(): [string, number][] { return this.s.players.map(p => [p.id, this.value(p)]); }

  /** 순위표. priceOf를 주면 그 가격으로 평가합니다(정산 중에는 공개 전 가격) */
  leaderboard(priceOf?: (code: StockCode) => number): LeaderRow[] {
    const valueOf = (p: Player) => priceOf ? p.cash + this.stocks.reduce((a, st) => a + (p.holdings[st.code]?.qty ?? 0) * priceOf(st.code), 0) : this.value(p);
    const sorted = this.s.players.map(p => ({ p, value: valueOf(p) }))
      .sort((a, b) => b.value - a.value || a.p.label.localeCompare(b.p.label));
    let rank = 0;
    return sorted.map(({ p, value }, i) => {
      if (i === 0 || value !== sorted[i - 1].value) rank = i + 1;
      return {
        playerId: p.id, label: p.label, kind: p.kind, npcType: p.npcType ? NPC_RULES[p.npcType].label : null,
        npcRule: p.npcType ? NPC_RULES[p.npcType].rule : null, connected: p.connected,
        value, returnPct: (value / START_CASH - 1) * 100, rank,
        prevRank: p.rankHist[p.rankHist.length - 2] ?? rank
      };
    });
  }

  /** 결과 공개 뒤 다음 라운드의 발표 회사를 안내합니다.
      다음 회사가 현재 결말에 따라 달라질 수 있으므로 정산이 끝나기 전에는 숨깁니다. */
  private scheduleView(): ScheduleItem[] {
    const next = this.s.plan.rounds[this.s.round];      // 다음 라운드(0-base)
    if (this.s.status !== 'playing' || this.s.phase !== 'recap' || !next) return [];
    /* 이미 공개된 사건의 제목만 보여 줍니다. 처음 나오는 사건은 제목이 곧 내용이라 숨깁니다. */
    const shown = new Set<string>();
    for (let r = 1; r <= this.s.round; r++)
      for (const ps of this.s.plan.rounds[r - 1].stages) { const id = arcOfStage.get(ps.stageId)?.id; if (id) shown.add(id); }
    const out: ScheduleItem[] = [];
    for (const ps of next.stages) {
      const stage = stageById.get(ps.stageId);
      const code = stage?.targets[0];
      if (!stage || !code || out.some(x => x.code === code)) continue;
      const arc = arcOfStage.get(stage.id);
      out.push({ round: next.round, code, name: stockOf(code).name, arcTitle: arc && shown.has(arc.id) ? arc.title : '' });
    }
    return out;
  }
  private newsView(): RoundNews[] {
    const out: RoundNews[] = [];
    for (let r = 1; r <= this.s.round; r++) {
      const plan = this.s.plan.rounds[r - 1], open = this.s.settled.includes(r);
      const stages = r === this.s.round ? this.visibleStages() : plan.stages;
      out.push({ round: r, cards: stages.map(ps => {
        const stage = stageById.get(ps.stageId)!;
        const card: NewsCard = { stageId: stage.id, arcTitle: arcOfStage.get(stage.id)!.title, headline: stage.headline, facts: stage.facts, expectation: stage.expectation, remaining: stage.remaining, clue: stage.clue, targets: stage.targets, breaking: ps.breaking, ...(ps.shock ? { shock: true } : {}) };
        let result: NewsResult | null = null;
        if (open && (r < this.s.round || this.s.phase === 'recap' || this.s.status === 'finished')) {
          const o = stage.outcomes.find(x => x.id === ps.outcomeId)!;
          result = { actual: o.actual, gap: o.gap, label: o.label, concept: stage.concept, impacts: o.impacts };
        }
        return { card, result };
      }) });
    }
    return out;
  }
  /** 결과 공개 시점 전에는 이번 라운드 가격을 숨깁니다. 'settling' 동안 새 종료가는 나가지 않습니다. */
  private stocksView(): StockView[] {
    const hideLast = this.s.phase === 'settling';
    const l = this.s.live && this.s.live.round === this.s.round ? this.s.live : null;
    return this.stocks.map(st => {
      const all = this.s.history[st.code];
      const history = hideLast ? all.slice(0, -1) : all;
      const last = history[history.length - 1];
      const closed = last ? last.closePrice : st.start;
      const path = l?.paths[st.code];
      /* 주문 시간: 지금까지의 장중 시세. 정산 중: 장중 시세 끝(종료가는 아직 비공개). 결과 시간: 라운드 전체 시세 */
      let price = closed, ticks: number[] | undefined, open = closed;
      if (path && this.s.phase === 'trade' && !l!.done) { ticks = path.slice(0, Math.min(l!.k, l!.steps) + 1); price = ticks[ticks.length - 1]; open = path[0]; }
      else if (path && hideLast) { ticks = path.slice(); price = path[path.length - 1]; open = path[0]; }
      else if (path && this.s.phase === 'recap') { ticks = path.slice(); open = path[0]; }
      const halt = this.haltLeft(st.code);
      return { code: st.code, name: st.name, sector: st.sector, desc: st.desc, price, openPrice: open, startPrice: st.start, lastChangeBp: last ? last.changeBp : null, history, ticks, ...(halt ? { haltLeft: halt } : {}) };
    });
  }
  private cardView(p: Player | null): CardView | null {
    const id = this.currentRound?.cardId;
    if (!id || !(this.s.phase === 'trade' || this.s.phase === 'recap') || !p) return null;
    const c = cardById.get(id)!, answered = p.cards[this.s.round] ?? null;
    return { id, title: c.title, body: c.body, concept: c.concept, options: c.options.map(o => ({ key: o.key, label: o.label })), answered,
      feedback: answered ? c.options.find(o => o.key === answered)!.feedback : null };
  }
  view(tokenValue: string | null, role: Role, now: number): RoomView {
    const p = role === 'player' ? this.player(tokenValue) : null, cfg = this.config;
    const inSettling = this.s.phase === 'settling';
    const live = this.s.live;
    const breakingAt = this.s.secondRevealed && live?.round === this.s.round ? live.breakAt ?? undefined : undefined;
    const stocks = this.stocksView();
    const priceOf = (c: StockCode) => stocks.find(x => x.code === c)!.price;
    const reserved = p ? Object.values(p.orders).reduce((a, o) => a + (o?.reserve ?? 0), 0) : 0;
    const value = p ? p.cash + this.stocks.reduce((a, st) => a + (p.holdings[st.code]?.qty ?? 0) * priceOf(st.code), 0) : 0;
    return {
      code: this.s.code, mode: this.s.mode, status: this.s.status, phase: this.s.phase, round: this.s.round, totalRounds: cfg.rounds,
      phaseEndsAt: this.s.phaseEndsAt, phaseSeconds: this.s.phaseSeconds, serverNow: now, tradeSeconds: cfg.trade, level: cfg.level,
      you: { id: p?.id ?? null, label: p?.label ?? null, role, isHost: !!p && p.id === this.s.hostId },
      humanCount: this.s.status === 'lobby' ? this.online : this.humans.length, maxPlayers: cfg.maxPlayers, minToStart: this.minToStart, startCash: START_CASH, operated: this.operated,
      /* 정산 중에는 순위도 공개 전 값(장 마감 직전 시세)을 씁니다. 내 평가액과 같은 가격이라 둘이 어긋나지 않습니다.
         예전에는 직전 라운드 끝 평가액을 써서, 정산 중에 내 평가액(장 마감 직전)과 순위가 서로 다른 시점이었습니다. */
      leaderboard: inSettling ? this.leaderboard(priceOf) : this.leaderboard(),
      stocks, news: this.newsView(), schedule: this.scheduleView(), breakingAt, card: this.cardView(p), prediction: this.predictionView(p, now), crowd: this.crowdView(),
      predictionTrend: this.s.status === 'finished' ? this.predictionTrend() : undefined, pace: this.s.settings?.pace,
      recapDone: this.recapDoneView(p),
      portfolio: p ? {
        cash: p.cash, reserved, available: p.cash - reserved, value, returnPct: (value / START_CASH - 1) * 100, fees: p.fees,
        holdings: this.stocks.filter(st => p.holdings[st.code]).map(st => { const h = p.holdings[st.code]!; const price = priceOf(st.code); const so = p.stops?.[st.code]; return { code: st.code, name: st.name, qty: h.qty, avgCost: h.avgCost, price, pnl: h.qty * (price - h.avgCost), stop: so?.stop ?? null, take: so?.take ?? null }; }),
        orders: Object.values(p.orders) as Order[],
        fillLog: p.fills.map(f => ({ round: f.round, code: f.code, side: f.side, qty: f.qty, price: f.price, fee: f.fee, ...(f.tax ? { tax: f.tax } : {}), tick: f.k, kind: f.kind ?? 'market', ...(f.trigger ? { trigger: f.trigger } : {}) })),
        dividendLog: p.dividends ?? []
      } : null,
      lastResult: p && !inSettling ? p.results[p.results.length - 1] ?? null : null,
      dividend: this.dividendView(),
      report: p && this.s.status === 'finished' ? buildReport(this, p) : null,
      arcIds: this.s.status === 'finished' ? this.s.plan.arcIds : undefined,
      nextRoomCode: this.s.nextRoomCode
    };
  }
}
