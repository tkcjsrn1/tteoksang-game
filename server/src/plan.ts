/* 시드로 게임 전체 시나리오를 미리 확정합니다. 같은 시드와 설정이면 같은 결말과 변동이 나옵니다. */
import { gameConfig, GROUPS, MARKET_MAX_BP, stockOf, STOCKS, STOCKS_PER_GAME } from '../../shared/rules';
import type { GameMode, RoomSettings, StockCode } from '../../shared/types';
import { ARCS, CARDS, type Arc, type Outcome, type Stage } from './content';

export function mulberry(seed: number) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export interface PlannedStage { stageId: string; outcomeId: string; breaking: boolean }
export interface RoundPlan { round: number; stages: PlannedStage[]; marketBp: number; stockBp: Record<StockCode, number>; cardId: string | null }
export interface GamePlan { arcIds: string[]; rounds: RoundPlan[]; /** 이번 판에 나오는 종목. 예전 저장 데이터에는 없습니다 */ stockCodes?: StockCode[] }
/* 한 판에 나오는 종목 수 기본값은 shared/rules.ts STOCKS_PER_GAME */
export { STOCKS_PER_GAME };

/** 이번 판 사건이 다루거나 결과로 움직이는 종목은 반드시 넣고, 그 업종의 같은 업종 종목을 한 개씩 먼저 고른 뒤
    나머지를 무작위로 채웁니다. 업종 동조화를 화면에서 바로 볼 수 있게 하려는 순서입니다.
    (모든 업종에 사건이 생긴 뒤로, 대장주 전부가 아니라 이번 판 사건의 종목만 넣습니다.) */
export function pickStocks(arcs: Arc[], rnd: () => number, count = STOCKS_PER_GAME): StockCode[] {
  const must = [...new Set(arcs.flatMap(a => a.stages.flatMap(st =>
    [...st.targets, ...st.outcomes.flatMap(o => o.impacts.map(i => i.code))])))];
  const peerCount = Math.max(0, count - must.length);
  const peers = STOCKS.filter(s => !must.includes(s.code));
  /* 뉴스 카드에 크게 나오는 종목(targets[0])의 업종을 먼저, 함께 영향받는 종목의 업종을 다음으로 채웁니다. */
  const groupsOf = (codes: StockCode[]) => [...new Set(codes.map(c => stockOf(c).group))];
  const primary = groupsOf(arcs.flatMap(a => a.stages.map(st => st.targets[0])));
  const secondary = groupsOf(arcs.flatMap(a => a.stages.flatMap(st => st.targets))).filter(g => !primary.includes(g));
  const picked: StockCode[] = [];
  for (const g of [...shuffled(primary, rnd), ...shuffled(secondary, rnd)]) {
    const pool = shuffled(peers.filter(p => p.group === g && !picked.includes(p.code)), rnd);
    if (pool[0] && picked.length < peerCount) picked.push(pool[0].code);
  }
  /* 남은 자리는 전체 종목에서 무작위로 채웁니다. 뉴스가 없는 업종도 섞여 나옵니다(실제 시장처럼). */
  for (const p of shuffled(peers, rnd)) if (picked.length < peerCount && !picked.includes(p.code)) picked.push(p.code);
  const order = (c: StockCode) => Object.keys(GROUPS).indexOf(stockOf(c).group) * 100 + Number(c.slice(1));
  return [...must, ...picked].sort((a, b) => order(a) - order(b));
}
/** 테스트에서 특정 결말을 강제할 때 씁니다. { 'nu-3a': 'short' } 처럼 단계별로 지정합니다. */
export type ForcedOutcomes = Record<string, string>;

function pickOutcome(stage: Stage, rnd: () => number, forced?: ForcedOutcomes): Outcome {
  const want = forced?.[stage.id];
  if (want) { const f = stage.outcomes.find(o => o.id === want); if (f) return f; }
  const total = stage.outcomes.reduce((a, o) => a + o.weight, 0);
  let x = rnd() * total;
  for (const o of stage.outcomes) { x -= o.weight; if (x < 0) return o; }
  return stage.outcomes[stage.outcomes.length - 1];
}
function resolveArc(arc: Arc, rnd: () => number, forced?: ForcedOutcomes) {
  const out: { stage: Stage; outcome: Outcome }[] = [];
  let prev: string | null = null;
  for (let step = 1; step <= 3; step++) {
    const candidates: Stage[] = arc.stages.filter(s => s.step === step && (!s.requires || (prev !== null && s.requires.includes(prev))));
    if (!candidates.length) continue;
    const stage: Stage = candidates[Math.floor(rnd() * candidates.length)];
    const outcome: Outcome = pickOutcome(stage, rnd, forced);
    out.push({ stage, outcome });
    prev = outcome.id;
  }
  return out;
}
function shuffled<T>(a: T[], rnd: () => number): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

export function buildPlan(seed: number, mode: GameMode, excludedArcs: string[] = [], forced?: ForcedOutcomes, forcedArcs?: string[], settings?: RoomSettings): GamePlan {
  const rnd = mulberry(seed), cfg = gameConfig(mode, settings);
  const arcCount = Math.max(cfg.arcs, Math.ceil(cfg.rounds / 3));
  const fresh = shuffled(ARCS.filter(a => !excludedArcs.includes(a.id)), rnd);
  const old = shuffled(ARCS.filter(a => excludedArcs.includes(a.id)), rnd);
  const chosen = forcedArcs ? forcedArcs.map(id => ARCS.find(a => a.id === id)!) : [...fresh, ...old].slice(0, arcCount);
  const resolved = chosen.map(a => resolveArc(a, rnd, forced));
  const stockCodes = pickStocks(chosen, rnd, settings?.stocks);
  /* 사건들을 번갈아 배치합니다. 뉴스가 라운드보다 많으면 앞 라운드에 두 건씩 넣습니다. */
  const queue: { stage: Stage; outcome: Outcome }[] = [];
  for (let i = 0; i < 3; i++) resolved.forEach(r => { if (r[i]) queue.push(r[i]); });
  const extra = Math.max(0, queue.length - cfg.rounds);
  const cardRounds = shuffled(Array.from({ length: cfg.rounds - 1 }, (_, i) => i + 2), rnd).slice(0, cfg.cards);
  const cards = shuffled(CARDS, rnd);
  const rounds: RoundPlan[] = [];
  let qi = 0;
  for (let r = 1; r <= cfg.rounds; r++) {
    const take = r <= extra ? 2 : 1;
    const stages: PlannedStage[] = [];
    for (let k = 0; k < take && qi < queue.length; k++, qi++) stages.push({ stageId: queue[qi].stage.id, outcomeId: queue[qi].outcome.id, breaking: k === 1 });
    const marketBp = Math.floor(rnd() * (MARKET_MAX_BP * 2 + 1)) - MARKET_MAX_BP;
    const stockBp = {} as Record<StockCode, number>;
    stockCodes.forEach(c => { const s = stockOf(c); stockBp[c] = Math.floor(rnd() * (s.maxMoveBp * 2 + 1)) - s.maxMoveBp; });
    const ci = cardRounds.indexOf(r);
    rounds.push({ round: r, stages, marketBp, stockBp, cardId: ci >= 0 ? cards[ci % cards.length].id : null });
  }
  return { arcIds: chosen.map(a => a.id), rounds, stockCodes };
}
