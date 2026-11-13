/* 손절·익절 자동 주문: 설정 검증, 장중 발동, 결과 공개로 건너뛴(갭) 경우 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import type { StockCode } from '../shared/types';

const T0 = 1_000_000;
function trading(seed = 7, opts: Partial<Parameters<typeof GameRoom.create>[0]> = {}) {
  /* 손절·익절은 실전 난이도 기능입니다 */
  const room = GameRoom.create({ code: '424242', mode: 'friend', now: T0, seed, settings: { level: 'pro' }, ...opts });
  const a = room.join(null, T0).token; room.join(null, T0 + 1);
  room.start(T0);
  while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
  return { room, a, t: room.s.live!.startedAt };
}

test('설정 검증: 가진 종목만, 손절가는 시세보다 낮게, 익절가는 높게, 10원 단위, 둘 다 비우면 해제', () => {
  const { room, a, t } = trading();
  const px = room.markPrice('G01');
  assert.equal(room.setStop(a, 's0', 'G01', px - 100, null, t).ok, false, '가진 종목만');
  room.placeOrder(a, 'b', 'G01', 'buy', 10, t);
  assert.equal(room.setStop(a, 's1', 'G01', px + 10, null, t).ok, false);
  assert.equal(room.setStop(a, 's2', 'G01', null, px, t).ok, false);
  assert.equal(room.setStop(a, 's3', 'G01', px - 105, null, t).ok, false, '10원 단위');
  assert.equal(room.setStop(a, 's4', 'G01', px - 100, px + 200, t).ok, true);
  const v = room.view(a, 'player', t).portfolio!.holdings.find(h => h.code === 'G01')!;
  assert.equal(v.stop, px - 100);
  assert.equal(v.take, px + 200);
  assert.equal(room.setStop(a, 's5', 'G01', null, null, t).ok, true);
  assert.equal(room.player(a)!.stops!.G01, undefined);
  /* 다 팔면 설정도 지워집니다 */
  room.setStop(a, 's6', 'G01', px - 100, null, t);
  room.placeOrder(a, 'x', 'G01', 'sell', 10, t);
  assert.equal(room.player(a)!.stops!.G01, undefined);
});

test('장중에 손절가·익절가에 닿으면 가진 수량 전부를 그 순간 시장가로 판다', () => {
  let stopHit = 0, takeHit = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const [slot, kind] of [[0, 'stop'], [1, 'take']] as [number, 'stop' | 'take'][]) {
      const { room, a, t } = trading(seed);
      const live = room.s.live!;
      /* 이번 판 종목은 시드마다 달라지므로 자리로 고릅니다 */
      const code: StockCode = room.s.plan.stockCodes![slot];
      const path = live.paths[code];
      const open = path[0];
      const k = path.findIndex((p, i) => i > 0 && (kind === 'stop' ? p <= open - 30 : p >= open + 30));
      if (k < 0) continue;
      room.placeOrder(a, `b-${code}`, code, 'buy', 20, t);
      const level = kind === 'stop' ? open - 30 : open + 30;
      assert.equal(room.setStop(a, `s-${code}`, code, kind === 'stop' ? level : null, kind === 'take' ? level : null, t).ok, true);
      room.tick(t + (k - 1) * 1000);
      assert.equal(room.player(a)!.holdings[code]?.qty, 20, `${seed} ${code}: 닿기 전에는 그대로`);
      room.tick(t + k * 1000);
      const p = room.player(a)!;
      assert.equal(p.holdings[code], undefined, `${seed} ${code}: 닿으면 전부 매도`);
      const f = p.fills.find(x => x.code === code && x.side === 'sell')!;
      assert.equal(f.trigger, kind);
      assert.equal(f.refPrice, path[k]);
      if (kind === 'stop') stopHit++; else takeHit++;
    }
  }
  assert.ok(stopHit >= 5 && takeHit >= 5, `${stopHit} ${takeHit}`);
});

test('결과 공개로 손절가 아래로 떨어지면(갭) 다음 장 시작하자마자 그 가격에 판다', () => {
  let gaps = 0;
  for (let seed = 1; seed <= 30 && gaps < 3; seed++) {
    const { room, a, t } = trading(seed, { forcedArcs: ['nuvakan', 'rate'], forced: { 'nu-1': 'fail' } });
    const plan = room.s.plan.rounds[0];
    if (!plan.stages.some(st => st.stageId === 'nu-1')) continue;
    const end = room.s.phaseEndsAt!;
    room.placeOrder(a, 'b', 'G01', 'buy', 30, t);
    /* 장중 시세가 닿지 않는 가장 높은 손절가 */
    const low = Math.min(...room.s.live!.paths.G01);
    room.setStop(a, 's', 'G01', low - 10, null, t);
    room.tick(end);
    room.beginRecap(end);
    const close = room.s.prices.G01;
    if (close >= low - 10) continue;
    assert.equal(room.player(a)!.holdings.G01!.qty, 30, '결과 공개 때는 장이 닫혀 있어 팔리지 않음');
    while (room.s.phase !== 'trade') room.tick(room.s.phaseEndsAt!);
    const f = room.player(a)!.fills.find(x => x.side === 'sell' && x.code === 'G01')!;
    assert.equal(f.trigger, 'stop');
    assert.ok(f.price < low - 10, '손절가보다 싸게 팔림(갭)');
    assert.equal(f.k, 0);
    gaps++;
  }
  assert.ok(gaps >= 1, '갭 사례가 하나도 없음');
});
