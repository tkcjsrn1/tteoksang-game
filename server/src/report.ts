/* 판이 끝난 뒤 개인에게만 보내는 리포트. 지표는 해당 판에서 관찰한 행동만 설명합니다. */
import { MIN_PREDICTIONS, START_CASH, stockOf } from '../../shared/rules';
import type { FinalReport, Metric } from '../../shared/types';
import { cardById } from './content';
import type { GameRoom, Player } from './room';

export const NOT_ENOUGH = '이번 게임에서는 판단할 기록이 부족했어요';
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const missing = (m: Omit<Metric, 'available' | 'value' | 'text'>): Metric => ({ ...m, available: false, value: NOT_ENOUGH, text: NOT_ENOUGH });

export function buildMetrics(p: Player): Metric[] {
  const obs = p.observations;
  const rg = obs.reduce((a, o) => a + o.realizedGain, 0), rl = obs.reduce((a, o) => a + o.realizedLoss, 0);
  const pg = obs.reduce((a, o) => a + o.paperGain, 0), pl = obs.reduce((a, o) => a + o.paperLoss, 0);
  const buys = obs.flatMap(o => o.buys);
  const out: Metric[] = [];

  const disp = { key: 'disposition', title: '처분 효과', formula: 'PGR − PLR. PGR = 실현이익 / (실현이익 + 평가이익), PLR = 실현손실 / (실현손실 + 평가손실)', minObservations: '이익 기회 2건 이상, 손실 기회 2건 이상' };
  if (rg + pg >= 2 && rl + pl >= 2) {
    const pgr = rg / (rg + pg), plr = rl / (rl + pl), d = pgr - plr;
    out.push({ ...disp, available: true, value: `이익 실현 ${pct(pgr)} · 손실 실현 ${pct(plr)}`,
      text: d > .1 ? '이번 판에서는 오른 종목을 판 비율이 내린 종목을 판 비율보다 높았어요.' : d < -.1 ? '이번 판에서는 내린 종목을 정리한 비율이 더 높았어요.' : '이번 판에서는 이익과 손실을 비슷한 비율로 정리했어요.' });
  } else out.push(missing(disp));

  const herdBuys = buys.filter(b => b.herd !== null);
  const herd = { key: 'herding', title: '군집 행동', formula: '다른 참가자가 가장 많이 산 종목을 함께 산 매수 / 전체 매수. 무작위 기준은 약 17%', minObservations: '매수 5건 이상' };
  if (herdBuys.length >= 5) {
    const r = herdBuys.filter(b => b.herd).length / herdBuys.length;
    out.push({ ...herd, available: true, value: pct(r), text: r > .35 ? '이번 판에서는 다른 참가자가 몰린 종목을 함께 산 경우가 많았어요.' : '이번 판에서는 다른 참가자와 다른 종목을 고른 경우가 많았어요.' });
  } else out.push(missing(herd));

  const over = { key: 'overreaction', title: '과잉 반응', formula: '호재처럼 보인 헤드라인 종목의 매수 금액 / 전체 매수 금액. 함께 실제로 기대를 넘은 비율을 표시', minObservations: '매수 5건 이상' };
  if (buys.length >= 5) {
    const total = buys.reduce((a, b) => a + b.gross, 0);
    const followed = buys.filter(b => b.followedHeadline);
    const r = followed.reduce((a, b) => a + b.gross, 0) / (total || 1);
    const hit = followed.length ? followed.filter(b => b.beat).length / followed.length : 0;
    out.push({ ...over, available: true, value: `헤드라인 추종 ${pct(r)} · 적중 ${followed.length ? pct(hit) : '—'}`, text: r > .5 ? `이번 판에서는 매수 금액의 절반 이상을 좋아 보이는 헤드라인에 넣었어요. 그중 기대를 넘은 결과는 ${followed.length ? pct(hit) : '없음'}이었어요.` : '이번 판에서는 헤드라인과 다른 근거로 산 금액이 더 많았어요.' });
  } else out.push(missing(over));

  /* 결과 예측과 과신: 결과 공개 전에 고른 확신도의 평균과 실제 정답률을 나란히 봅니다 */
  const preds = Object.values(p.predictions ?? {}).filter(x => x.correct !== null);
  const conf = { key: 'overconfidence', title: '예측과 과신', formula: '평균 확신도 − 실제 정답률. 확신도는 결과 공개 전에 고른 50·70·90%', minObservations: `예측 ${MIN_PREDICTIONS}건 이상` };
  if (preds.length >= MIN_PREDICTIONS) {
    const c = preds.reduce((a, x) => a + x.confidence, 0) / preds.length / 100;
    const hits = preds.filter(x => x.correct).length, h = hits / preds.length;
    out.push({ ...conf, available: true, value: `정답 ${hits}/${preds.length} (${pct(h)}) · 평균 확신도 ${pct(c)}`,
      text: c - h > .1 ? '이번 판에서는 실제로 맞힌 것보다 더 자신 있게 예측했어요.' : c - h < -.1 ? '이번 판에서는 실제로 맞힌 것보다 조심스럽게 예측했어요.' : '이번 판에서는 확신한 만큼 맞혔어요.' });
  } else out.push(missing(conf));

  return out;
}

export function buildReport(room: GameRoom, p: Player): FinalReport {
  const value = room.value(p);
  const majorTrades = p.fills.slice().sort((a, b) => b.gross - a.gross).slice(0, 3).map(f => ({ round: f.round, code: f.code, name: stockOf(f.code).name, side: f.side, qty: f.qty, price: f.price }));
  const judgments = Object.entries(p.cards).map(([r, choice]) => {
    const c = cardById.get(room.s.plan.rounds[Number(r) - 1].cardId!)!;
    return { title: c.title, choice: c.options.find(o => o.key === choice)!.label, concept: c.concept };
  });
  return { rank: room.rankOf(p), value, returnPct: (value / START_CASH - 1) * 100, fees: p.fees, majorTrades, metrics: buildMetrics(p), judgments };
}
