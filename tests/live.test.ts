/* 장중 시세 메시지(tick)를 화면 상태에 반영하는 계산을 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyBoard, applyTick, intradayBp, walletChange } from '../client/src/live';
import { GameRoom } from '../server/src/room';

const T0 = 1_000_000;
function trading() {
  const room = GameRoom.create({ code: '313131', mode: 'solo', now: T0, seed: 9 });
  const tok = room.join(null, T0).token;
  room.start(T0);
  room.tick(room.s.phaseEndsAt!);
  const t = room.s.live!.startedAt;
  room.placeOrder(tok, 'b', 'G01', 'buy', 100, t);
  return { room, tok, t };
}

test('시세 메시지가 오면 종목 가격·장중 시세·내 평가액이 서버 화면과 같아진다', () => {
  const { room, tok, t } = trading();
  let v = room.view(tok, 'player', t);
  for (let k = 1; k <= 30; k++) {
    room.tick(t + k * 1000);
    const prices = Object.fromEntries(room.stocks.map(s => [s.code, room.markPrice(s.code)]));
    v = applyTick(v, { t: 'tick', round: room.s.round, k, prices })!;
  }
  const server = room.view(tok, 'player', t + 30_000);
  assert.deepEqual(v.stocks.map(s => [s.code, s.price, s.ticks]), server.stocks.map(s => [s.code, s.price, s.ticks]));
  assert.equal(v.portfolio!.value, server.portfolio!.value);
  assert.deepEqual(v.portfolio!.holdings, server.portfolio!.holdings);
  const g = v.stocks.find(s => s.code === 'G01')!;
  assert.equal(intradayBp(g), Math.round((g.price - g.openPrice) * 10000 / g.openPrice));
});

test('놓친 칸은 직전 값으로 채우고, 다른 라운드·다른 단계의 메시지는 무시한다', () => {
  const { room, tok, t } = trading();
  const v = room.view(tok, 'player', t);
  const g = v.stocks[0];
  const jumped = applyTick(v, { t: 'tick', round: room.s.round, k: 3, prices: { [g.code]: g.price + 50 } })!;
  const tk = jumped.stocks[0].ticks!;
  assert.equal(tk.length, 4);
  assert.deepEqual(tk.slice(0, 3), [g.price, g.price, g.price]);
  assert.equal(tk[3], g.price + 50);
  assert.equal(applyTick(v, { t: 'tick', round: room.s.round + 1, k: 1, prices: { [g.code]: 1 } }), v);
  assert.equal(applyTick({ ...v, phase: 'recap' }, { t: 'tick', round: room.s.round, k: 1, prices: { [g.code]: 1 } })!.stocks[0].price, g.price);
  assert.equal(applyTick(null, { t: 'tick', round: 1, k: 1, prices: {} }), null);
});

test('내 평가액의 수익률은 원 금액과 같은 시점의 평가액으로 계산한다(직전 라운드 순위표 값이 아님)', () => {
  const { room, tok, t } = trading();
  let v = room.view(tok, 'player', t);
  for (let k = 1; k <= 30; k++) {
    room.tick(t + k * 1000);
    const prices = Object.fromEntries(room.stocks.map(s => [s.code, room.markPrice(s.code)]));
    v = applyTick(v, { t: 'tick', round: room.s.round, k, prices })!;
  }
  const me = v.leaderboard.find(l => l.playerId === v.you.id)!;
  const w = walletChange(v, me);
  /* 원 금액과 수익률이 같은 평가액에서 나와야 부호와 크기가 맞습니다 */
  assert.equal(w.value, v.portfolio!.value);
  assert.equal(w.diff, v.portfolio!.value - v.startCash);
  assert.ok(Math.abs(w.pct - (w.value / v.startCash - 1) * 100) < 1e-9);
  /* 장중에 가격이 움직이면 순위표의 수익률(직전 정산 기준)과 달라질 수 있습니다 */
  if (v.portfolio!.value !== me.value) assert.notEqual(w.pct, me.returnPct);
  /* 포트폴리오가 없으면(관전 등) 순위표 값을 씁니다 */
  const noPf = walletChange({ ...v, portfolio: null }, me);
  assert.equal(noPf.value, me.value);
  assert.equal(noPf.pct, me.returnPct);
});

test('장중 순위는 시세와 같은 시점의 평가액으로 매겨진다(서버 순위표와 같다)', () => {
  const { room, tok, t } = trading();
  let v = room.view(tok, 'player', t);
  for (let k = 1; k <= 30; k++) {
    room.tick(t + k * 1000);
    const prices = Object.fromEntries(room.stocks.map(s => [s.code, room.markPrice(s.code)]));
    v = applyTick(v, { t: 'tick', round: room.s.round, k, prices, board: room.tickBoard() })!;
  }
  const pick = (rows: typeof v.leaderboard) => rows.map(r => [r.playerId, r.value, r.rank, r.prevRank]);
  assert.deepEqual(pick(v.leaderboard), pick(room.leaderboard()));
  const me = v.leaderboard.find(l => l.playerId === v.you.id)!;
  assert.equal(me.value, v.portfolio!.value, '내 순위 줄의 평가액과 내 평가액 칸이 같은 시점');
});

test('순위 다시 매기기: 평가액 큰 순서, 같으면 같은 순위, 목록에 없는 사람은 원래 값', () => {
  const row = (playerId: string, label: string, value: number) => ({ playerId, label, kind: 'human' as const, npcType: null, npcRule: null, connected: true, value, returnPct: 0, rank: 1, prevRank: 2 });
  const rows = [row('a', '가', 100), row('b', '나', 200), row('c', '다', 300)];
  const out = applyBoard(rows, [['a', 500], ['b', 300]], 100);
  assert.deepEqual(out.map(r => [r.playerId, r.value, r.rank]), [['a', 500, 1], ['b', 300, 2], ['c', 300, 2]]);
  assert.equal(out[0].returnPct, 400);
  assert.ok(out.every(r => r.prevRank === 2), '직전 라운드 순위는 그대로');
});

test('정산 중 순위는 내 평가액과 같은 공개 전 가격으로 매긴다', () => {
  const { room, tok } = trading();
  room.tick(room.s.phaseEndsAt!);
  assert.equal(room.s.phase, 'settling');
  const v = room.view(tok, 'player', room.s.phaseEndsAt!);
  const me = v.leaderboard.find(l => l.playerId === v.you.id)!;
  assert.equal(me.value, v.portfolio!.value);
  assert.deepEqual(v.leaderboard.map(r => r.rank), [...v.leaderboard].map(r => 1 + v.leaderboard.filter(x => x.value > r.value).length));
});
