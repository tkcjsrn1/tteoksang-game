/* 방 하나의 게임 상태 기계. 네트워크와 DB를 모르는 순수 로직이라 시계를 주입해 테스트합니다.
   RoomState는 평범한 JSON이라 그대로 DB에 저장하고 복구할 수 있습니다. */
import { randomBytes, randomInt } from 'node:crypto';
import { checkOrder, computeClose, MODES, stagedWicks, START_CASH, stockOf, STOCKS } from '../../shared/rules';
import type { CardView, Contribution, EventImpact, GameMode, Holding, LeaderRow, NewsCard, NewsResult, NpcType, Order, PredictionView, PriceBreakdown, Role, RoomStatus, RoomView, RoundNews, RoundResult, Side, StockCode, StockView, Phase } from '../../shared/types';
import { arcOfStage, cardById, stageById } from './content';
import { NPC_RULES, NPC_TYPES } from './npc';
import { buildPlan, type ForcedOutcomes, type GamePlan } from './plan';
import { buildReport } from './report';

export interface Fill { round: number; code: StockCode; side: Side; qty: number; price: number; fee: number; gross: number; realized: 'gain' | 'loss' | null; requestId: string }
export interface Observation {
  round: number;
  paperGain: number; paperLoss: number; realizedGain: number; realizedLoss: number;
  buys: { code: StockCode; gross: number; followedHeadline: boolean; herd: boolean | null; beat: boolean | null }[];
}
export interface Player {
  id: string; token: string; label: string; kind: 'human' | 'npc'; npcType: NpcType | null; joinedAt: number; connected: boolean;
  cash: number; holdings: Partial<Record<StockCode, Holding>>; orders: Partial<Record<StockCode, Order>>;
  /** 요청 ID별 응답. 같은 요청이 다시 와도 새 주문을 만들지 않습니다. */
  requests: Record<string, { ok: boolean; reason?: string; round?: number }>;
  fills: Fill[]; fees: number; valueHist: number[]; rankHist: number[]; results: RoundResult[];
  cards: Record<number, 'A' | 'B'>; predictions: Record<number, { stageId: string; choice: 'A' | 'B'; confidence: number; correct: boolean | null }>;
  observations: Observation[];
}
export interface RoomState {
  code: string; mode: GameMode; seed: number; status: RoomStatus; hostId: string | null; operatorToken: string | null;
  createdAt: number; updatedAt: number; plan: GamePlan; excludedArcs: string[]; round: number; phase: Phase | null;
  phaseEndsAt: number | null; phaseSeconds: number; newsStartedAt: number; secondRevealed: boolean;
  players: Player[]; spectators: string[];
  prices: Record<StockCode, number>; history: Record<StockCode, PriceBreakdown[]>;
  settled: number[]; nextRoomCode: string | null;
}
export type OrderResult = { ok: boolean; reason?: string; duplicate?: boolean };
/** 한 라운드에 참가자 한 명이 보낼 수 있는 주문·취소 요청 수. 넘으면 거절해 저장 상태가 무한히 커지지 않게 합니다. */
export const MAX_REQUESTS_PER_ROUND = 200;

const ANIMALS = ['사슴', '수달', '고래', '너구리', '판다', '여우', '참새', '두루미', '해달', '토끼', '다람쥐', '거북'];
const token = () => randomBytes(18).toString('base64url');
const npcId = (t: NpcType) => `npc-${t}`;
const initialPrices = () => Object.fromEntries(STOCKS.map(s => [s.code, s.start])) as Record<StockCode, number>;

function newPlayer(kind: 'human' | 'npc', label: string, now: number, npcType: NpcType | null = null, id?: string): Player {
  return { id: id ?? token().slice(0, 10), token: kind === 'human' ? token() : '', label, kind, npcType, joinedAt: now, connected: kind === 'human', cash: START_CASH, holdings: {}, orders: {}, requests: {}, fills: [], fees: 0, valueHist: [START_CASH], rankHist: [], results: [], cards: {}, predictions: {}, observations: [] };
}

export class GameRoom {
  s: RoomState;
  constructor(state: RoomState) { this.s = state; }

  static create(opts: { code: string; mode: GameMode; now: number; seed?: number; excludedArcs?: string[]; forced?: ForcedOutcomes; forcedArcs?: string[] }): GameRoom {
    const seed = opts.seed ?? randomInt(2 ** 31);
    const excluded = opts.excludedArcs ?? [];
    const plan = buildPlan(seed, opts.mode, excluded, opts.forced, opts.forcedArcs);
    const npcs = NPC_TYPES.map(t => newPlayer('npc', `NPC ${NPC_RULES[t].label}`, opts.now, t, npcId(t)));
    return new GameRoom({
      code: opts.code, mode: opts.mode, seed, status: 'lobby', hostId: null, operatorToken: opts.mode === 'academic' ? token() : null,
      createdAt: opts.now, updatedAt: opts.now, plan, excludedArcs: excluded, round: 0, phase: null, phaseEndsAt: null, phaseSeconds: 0, newsStartedAt: 0, secondRevealed: false,
      players: npcs, spectators: [], prices: initialPrices(), history: Object.fromEntries(STOCKS.map(s => [s.code, []])) as unknown as Record<StockCode, PriceBreakdown[]>,
      settled: [], nextRoomCode: null
    });
  }

  get humans() { return this.s.players.filter(p => p.kind === 'human'); }
  get config() { return MODES[this.s.mode]; }
  player(tokenValue: string | null | undefined) { return tokenValue ? this.s.players.find(p => p.token === tokenValue) ?? null : null; }

  /** 재접속 토큰이 맞으면 복구, 시작 전이면 참가, 시작 후 처음 온 사람은 관전자입니다. */
  join(tokenValue: string | null | undefined, now: number): { token: string; role: Role; label: string | null } {
    const existing = this.player(tokenValue);
    if (existing) { existing.connected = true; this.fixHost(); return { token: existing.token, role: 'player', label: existing.label }; }
    if (tokenValue && this.s.spectators.includes(tokenValue)) return { token: tokenValue, role: 'spectator', label: null };
    if (this.s.status !== 'lobby' || this.humans.length >= this.config.maxPlayers) {
      const t = token(); this.s.spectators.push(t);
      return { token: t, role: 'spectator', label: null };
    }
    const p = newPlayer('human', this.uniqueLabel(), now);
    this.s.players.push(p);
    this.fixHost();
    this.touch(now);
    return { token: p.token, role: 'player', label: p.label };
  }
  private uniqueLabel() {
    for (;;) {
      const label = `${ANIMALS[randomInt(ANIMALS.length)]} ${randomInt(10, 100)}`;
      if (!this.s.players.some(p => p.label === label)) return label;
    }
  }
  /** 대기실에서 방장이 나가면 가장 먼저 들어온 접속 중 참가자에게 넘깁니다. 시작한 판은 방장과 상관없이 진행합니다. */
  private fixHost() {
    if (this.s.mode === 'academic') return;
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
    this.touch(now);
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

  canStart(tokenValue: string | null | undefined, operator?: string | null) {
    if (this.s.status !== 'lobby') return false;
    if (this.humans.length < this.config.minToStart) return false;
    if (this.s.mode === 'academic') return !!operator && operator === this.s.operatorToken;
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
    this.setPhase('news', this.config.news, now);
  }
  /** 시간이 된 전환을 수행합니다. 'settled'를 돌려주면 저장 후 beginRecap을 불러야 합니다. */
  tick(now: number): 'none' | 'changed' | 'settled' | 'finished' {
    const s = this.s;
    if (s.status !== 'playing' || s.phaseEndsAt === null || s.phase === 'settling') return 'none';
    if (s.phase === 'news' && !s.secondRevealed && now >= s.newsStartedAt + this.config.news * 500 && this.currentRound.stages.length > 1) {
      s.secondRevealed = true;
      if (now < s.phaseEndsAt) return 'changed';
    }
    if (now < s.phaseEndsAt) return 'none';
    if (s.phase === 'news') {
      this.setPhase('trade', this.config.trade, now);
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
    return r.stages.filter(st => !st.breaking || this.s.secondRevealed || this.s.phase !== 'news');
  }
  private runNpcs(now: number) {
    const r = this.currentRound;
    const signals: Partial<Record<StockCode, 1 | -1>> = {};
    r.stages.forEach(st => Object.assign(signals, stageById.get(st.stageId)!.signal));
    const lastChangeBp: Partial<Record<StockCode, number>> = {};
    STOCKS.forEach(st => { const h = this.s.history[st.code]; if (h.length) lastChangeBp[st.code] = h[h.length - 1].changeBp; });
    this.s.players.filter(p => p.kind === 'npc').forEach(p => {
      NPC_RULES[p.npcType!].decide({ round: this.s.round, signals, prices: this.s.prices, lastChangeBp, ctx: p }).forEach((o, i) => {
        if (o.qty >= 1) this.applyOrder(p, `npc-${this.s.round}-${i}`, o.code, o.side, o.qty, now);
      });
    });
  }

  /** 서버가 받은 시점으로 마감을 판단합니다. 마감 시각과 같거나 늦으면 거절합니다. */
  placeOrder(tokenValue: string, requestId: string, code: StockCode, side: Side, qty: number, now: number): OrderResult {
    const p = this.player(tokenValue);
    if (!p) return { ok: false, reason: '참가자만 주문할 수 있습니다' };
    if (!requestId) return { ok: false, reason: '요청 ID가 없습니다' };
    const seen = p.requests[requestId];
    if (seen) return { ok: seen.ok, reason: seen.reason, duplicate: true };
    if (this.tooManyRequests(p)) return { ok: false, reason: '이번 라운드 요청이 너무 많습니다' };
    if (!stockOf(code)) return { ok: false, reason: '없는 종목입니다' };
    if (side !== 'buy' && side !== 'sell') return { ok: false, reason: '잘못된 주문입니다' };
    const res = this.applyOrder(p, requestId, code, side, qty, now);
    p.requests[requestId] = { ...res, round: this.s.round };
    return res;
  }
  private tooManyRequests(p: Player) {
    return Object.values(p.requests).filter(v => v.round === this.s.round).length >= MAX_REQUESTS_PER_ROUND;
  }
  private tradeOpen(now: number) { return this.s.status === 'playing' && this.s.phase === 'trade' && this.s.phaseEndsAt !== null && now < this.s.phaseEndsAt; }
  private applyOrder(p: Player, requestId: string, code: StockCode, side: Side, qty: number, now: number): OrderResult {
    if (!this.tradeOpen(now)) return { ok: false, reason: '이번 라운드 주문 마감' };
    const price = this.s.prices[code];
    const chk = checkOrder(p, code, side, qty, price);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    p.orders[code] = { code, side, qty, price, gross: chk.gross, fee: chk.fee, reserve: chk.reserve, requestId, placedAt: now };
    this.touch(now);
    return { ok: true };
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
    p.cards[this.s.round] = choice;
    return true;
  }
  /** 학술제 모드에서 결말 공개 전 예측과 확신도를 받습니다. 과신 지표의 재료입니다. */
  predict(tokenValue: string, choice: 'A' | 'B', confidence: number, now: number) {
    const p = this.player(tokenValue);
    const stage = this.currentRound?.stages[0];
    if (!p || !stage || !this.config.predictions || !this.tradeOpen(now)) return false;
    if ((choice !== 'A' && choice !== 'B') || ![50, 70, 90].includes(confidence)) return false;
    p.predictions[this.s.round] = { stageId: stage.stageId, choice, confidence, correct: null };
    return true;
  }

  value(p: Player) { return p.cash + STOCKS.reduce((a, st) => a + (p.holdings[st.code]?.qty ?? 0) * this.s.prices[st.code], 0); }
  rankOf(p: Player) { const v = this.value(p); return 1 + this.s.players.filter(x => this.value(x) > v).length; }
  private recordRanks() { this.s.players.forEach(p => p.rankHist.push(this.rankOf(p))); }

  /** 라운드당 한 번만 체결합니다. 재시도해도 settled에 있으면 아무 일도 하지 않습니다. */
  settle(round: number, _now: number) {
    if (this.s.settled.includes(round)) return false;
    const plan = this.s.plan.rounds[round - 1];
    const before = new Map(this.s.players.map(p => [p.id, { value: this.value(p), rank: this.rankOf(p) }]));
    const buyCounts: Partial<Record<StockCode, number>> = {};
    this.s.players.forEach(p => Object.values(p.orders).forEach(o => { if (o?.side === 'buy') buyCounts[o.code] = (buyCounts[o.code] ?? 0) + 1; }));
    const headline: Partial<Record<StockCode, 1 | -1>> = {};
    const beatOf: Partial<Record<StockCode, boolean>> = {};
    plan.stages.forEach(st => {
      const stage = stageById.get(st.stageId)!, out = stage.outcomes.find(o => o.id === st.outcomeId)!;
      Object.assign(headline, stage.signal);
      stage.targets.forEach(c => { beatOf[c] = out.beat; });
    });
    const humanBuyers = this.s.players.length > 1;

    /* 1. 기준가로 전량 체결 */
    const fillsByPlayer = new Map<string, Fill[]>();
    this.s.players.forEach(p => {
      const fills: Fill[] = [];
      const obs: Observation = { round, paperGain: 0, paperLoss: 0, realizedGain: 0, realizedLoss: 0, buys: [] };
      const sold = new Set<StockCode>();
      Object.values(p.orders).filter(o => o!.side === 'sell').forEach(o => {
        const order = o!, h = p.holdings[order.code]!;
        const gain = order.price > h.avgCost;
        if (gain) obs.realizedGain++; else obs.realizedLoss++;
        p.cash += order.gross - order.fee; p.fees += order.fee;
        h.qty -= order.qty;
        sold.add(order.code);
        fills.push({ round, code: order.code, side: 'sell', qty: order.qty, price: order.price, fee: order.fee, gross: order.gross, realized: gain ? 'gain' : 'loss', requestId: order.requestId });
        if (h.qty === 0) delete p.holdings[order.code];
      });
      /* 팔 수 있었지만 계속 들고 있는 종목은 평가이익·평가손실로 셉니다(Odean의 PGR/PLR). 매도한 라운드만 셉니다. */
      if (sold.size) STOCKS.forEach(st => {
        const h = p.holdings[st.code];
        if (!h || sold.has(st.code)) return;
        if (this.s.prices[st.code] > h.avgCost) obs.paperGain++; else obs.paperLoss++;
      });
      Object.values(p.orders).filter(o => o!.side === 'buy').forEach(o => {
        const order = o!;
        p.cash -= order.reserve; p.fees += order.fee;
        const h = p.holdings[order.code] ?? (p.holdings[order.code] = { qty: 0, avgCost: 0, sinceRound: round });
        h.avgCost = Math.round((h.avgCost * h.qty + order.gross) / (h.qty + order.qty));
        h.qty += order.qty;
        const others = (buyCounts[order.code] ?? 0) - 1;
        const maxOthers = Math.max(0, ...STOCKS.map(st => (buyCounts[st.code] ?? 0) - (st.code === order.code ? 1 : 0)));
        obs.buys.push({ code: order.code, gross: order.gross, followedHeadline: headline[order.code] === 1, herd: humanBuyers ? others > 0 && others === maxOthers : null, beat: beatOf[order.code] ?? null });
        fills.push({ round, code: order.code, side: 'buy', qty: order.qty, price: order.price, fee: order.fee, gross: order.gross, realized: null, requestId: order.requestId });
      });
      p.orders = {};
      p.fills.push(...fills);
      p.observations.push(obs);
      fillsByPlayer.set(p.id, fills);
    });

    /* 2. 종료가 계산 */
    const bases = { ...this.s.prices };
    STOCKS.forEach(st => {
      const events: EventImpact[] = [];
      plan.stages.forEach(ps => {
        const out = stageById.get(ps.stageId)!.outcomes.find(o => o.id === ps.outcomeId)!;
        out.impacts.filter(i => i.code === st.code).forEach(i => events.push({ stageId: ps.stageId, label: out.label, bp: i.bp, reason: i.reason }));
      });
      const c = computeClose(round, bases[st.code], events, plan.marketBp, plan.stockBp[st.code]);
      const b = { ...c, ...stagedWicks(st.code, c) };
      this.s.history[st.code].push(b);
      this.s.prices[st.code] = b.closePrice;
    });

    /* 3. 예측 채점과 라운드 결과 */
    const first = plan.stages[0] && stageById.get(plan.stages[0].stageId)!.outcomes.find(o => o.id === plan.stages[0].outcomeId)!;
    this.s.players.forEach(p => {
      const pr = p.predictions[round];
      if (pr && first) pr.correct = (pr.choice === 'A') === first.beat;
    });
    this.s.settled.push(round);
    this.recordRanks();
    this.s.players.forEach(p => {
      const valueAfter = this.value(p);
      p.valueHist.push(valueAfter);
      const prev = before.get(p.id)!, fills = fillsByPlayer.get(p.id)!;
      const contributions: Contribution[] = [];
      STOCKS.forEach(st => {
        const qty = p.holdings[st.code]?.qty ?? 0;
        if (qty) contributions.push({ code: st.code, name: st.name, qty, won: qty * (this.s.prices[st.code] - bases[st.code]) });
      });
      contributions.sort((a, b) => Math.abs(b.won) - Math.abs(a.won));
      p.results.push({
        round, rankBefore: prev.rank, rankAfter: this.rankOf(p), valueBefore: prev.value, valueAfter, delta: valueAfter - prev.value,
        fees: fills.reduce((a, f) => a + f.fee, 0), contributions, best: contributions[0] ?? null,
        fills: fills.map(f => ({ code: f.code, side: f.side, qty: f.qty, price: f.price, fee: f.fee }))
      });
    });
    return true;
  }

  leaderboard(): LeaderRow[] {
    return this.s.players.map(p => ({
      playerId: p.id, label: p.label, kind: p.kind, npcType: p.npcType ? NPC_RULES[p.npcType].label : null, npcRule: p.npcType ? NPC_RULES[p.npcType].rule : null, connected: p.connected,
      value: this.value(p), returnPct: (this.value(p) / START_CASH - 1) * 100, rank: this.rankOf(p)
    })).sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  }

  private newsView(): RoundNews[] {
    const out: RoundNews[] = [];
    for (let r = 1; r <= this.s.round; r++) {
      const plan = this.s.plan.rounds[r - 1], open = this.s.settled.includes(r);
      const stages = r === this.s.round ? this.visibleStages() : plan.stages;
      out.push({ round: r, cards: stages.map(ps => {
        const stage = stageById.get(ps.stageId)!;
        const card: NewsCard = { stageId: stage.id, arcTitle: arcOfStage.get(stage.id)!.title, headline: stage.headline, facts: stage.facts, expectation: stage.expectation, remaining: stage.remaining, clue: stage.clue, targets: stage.targets, breaking: ps.breaking };
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
    return STOCKS.map(st => {
      const all = this.s.history[st.code];
      const history = hideLast ? all.slice(0, -1) : all;
      const last = history[history.length - 1];
      return { code: st.code, name: st.name, sector: st.sector, desc: st.desc, price: last ? last.closePrice : st.start, startPrice: st.start, lastChangeBp: last ? last.changeBp : null, history };
    });
  }
  private cardView(p: Player | null): CardView | null {
    const id = this.currentRound?.cardId;
    if (!id || !(this.s.phase === 'trade' || this.s.phase === 'recap') || !p) return null;
    const c = cardById.get(id)!, answered = p.cards[this.s.round] ?? null;
    return { id, title: c.title, body: c.body, concept: c.concept, options: c.options.map(o => ({ key: o.key, label: o.label })), answered,
      feedback: this.s.phase === 'recap' && answered ? c.options.find(o => o.key === answered)!.feedback : null };
  }
  private predictionView(p: Player | null): PredictionView | null {
    if (!p || !this.config.predictions || !this.currentRound?.stages[0] || !(this.s.phase === 'trade' || this.s.phase === 'recap')) return null;
    const pr = p.predictions[this.s.round];
    const stage = stageById.get(this.currentRound.stages[0].stageId)!;
    return { stageId: stage.id, question: `“${stage.headline}”의 결과가 시장 기대보다 좋을까요?`, choice: pr?.choice ?? null, confidence: pr?.confidence ?? null, correct: this.s.phase === 'recap' ? pr?.correct ?? null : null };
  }
  view(tokenValue: string | null, role: Role, now: number): RoomView {
    const p = role === 'player' ? this.player(tokenValue) : null, cfg = this.config;
    const inSettling = this.s.phase === 'settling';
    const stocks = this.stocksView();
    const priceOf = (c: StockCode) => stocks.find(x => x.code === c)!.price;
    const reserved = p ? Object.values(p.orders).reduce((a, o) => a + (o?.reserve ?? 0), 0) : 0;
    const value = p ? p.cash + STOCKS.reduce((a, st) => a + (p.holdings[st.code]?.qty ?? 0) * priceOf(st.code), 0) : 0;
    return {
      code: this.s.code, mode: this.s.mode, status: this.s.status, phase: this.s.phase, round: this.s.round, totalRounds: cfg.rounds,
      phaseEndsAt: this.s.phaseEndsAt, phaseSeconds: this.s.phaseSeconds, serverNow: now,
      you: { id: p?.id ?? null, label: p?.label ?? null, role, isHost: !!p && p.id === this.s.hostId },
      humanCount: this.humans.length, maxPlayers: cfg.maxPlayers, minToStart: cfg.minToStart, startCash: START_CASH,
      /* 정산 중에는 순위도 공개 전 값을 씁니다. */
      leaderboard: inSettling ? this.prevLeaderboard() : this.leaderboard(),
      stocks, news: this.newsView(), card: this.cardView(p), prediction: this.predictionView(p),
      portfolio: p ? {
        cash: p.cash, reserved, available: p.cash - reserved, value, returnPct: (value / START_CASH - 1) * 100, fees: p.fees,
        holdings: STOCKS.filter(st => p.holdings[st.code]).map(st => { const h = p.holdings[st.code]!; const price = priceOf(st.code); return { code: st.code, name: st.name, qty: h.qty, avgCost: h.avgCost, price, pnl: h.qty * (price - h.avgCost) }; }),
        orders: Object.values(p.orders) as Order[],
        fillLog: p.fills.map(f => ({ round: f.round, code: f.code, side: f.side, qty: f.qty, price: f.price, fee: f.fee }))
      } : null,
      lastResult: p && !inSettling ? p.results[p.results.length - 1] ?? null : null,
      report: p && this.s.status === 'finished' ? buildReport(this, p) : null,
      nextRoomCode: this.s.nextRoomCode
    };
  }
  private prevLeaderboard(): LeaderRow[] {
    return this.s.players.map(p => {
      const v = p.valueHist[p.valueHist.length - 2] ?? START_CASH;
      return { playerId: p.id, label: p.label, kind: p.kind, npcType: p.npcType ? NPC_RULES[p.npcType].label : null, npcRule: p.npcType ? NPC_RULES[p.npcType].rule : null, connected: p.connected, value: v, returnPct: (v / START_CASH - 1) * 100, rank: p.rankHist[p.rankHist.length - 2] ?? 1 };
    }).sort((a, b) => a.rank - b.rank);
  }
}
