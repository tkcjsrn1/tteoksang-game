/* 장중 시세 메시지(tick)를 화면 상태에 반영하는 계산을 확인합니다. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyTick, intradayBp } from '../client/src/live';
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
