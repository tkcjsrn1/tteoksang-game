/* 대형 속보: 후보 뉴스가 장중 속보로 나오면 대상 종목이 한 번에 크게 움직여 VI가 걸린다 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameRoom } from '../server/src/room';
import { buildPlan, hasShock } from '../server/src/plan';
import { SHOCK_STAGES, stageById } from '../server/src/content';
import { cleanSettings, SHOCK_BP, VI_BP, viDirection, stockOf } from '../shared/rules';
import { persistedSettings } from '../client/src/homeSettings';

const T0 = 3_000_000;
/** 대형 속보가 있는 첫 시드 */
function shockSeed(settings = {}) {
  for (let seed = 1; seed < 500; seed++) if (hasShock(buildPlan(seed, 'solo', [], undefined, undefined, settings))) return seed;
  throw new Error('대형 속보 시드를 못 찾음');
}
function toShockTrade(seed: number, settings = {}) {
  const room = GameRoom.create({ code: '424242', mode: 'solo', now: T0, seed, settings });
  const a = room.join(null, T0).token; room.start(T0);
  let now = T0;
  for (let i = 0; i < 200; i++) {
    if (room.s.phase === 'trade' && room.currentRound.stages.some(s => s.shock)) return { room, a, now };
    now = room.s.phaseEndsAt ?? now;
    if (room.tick(now) === 'settled') room.beginRecap(now);
  }
  throw new Error('대형 속보 라운드에 닿지 못함');
}

test('대형 속보: 후보 목록은 실제로 있는 뉴스이고, 판마다 최대 한 번, 속보 자리에만 붙는다', () => {
  for (const id of SHOCK_STAGES) assert.ok(stageById.has(id), `${id}: 없는 뉴스`);
  for (let seed = 1; seed <= 300; seed++) {
    const plan = buildPlan(seed, 'solo');
    const shocks = plan.rounds.flatMap(r => r.stages.filter(s => s.shock));
    assert.ok(shocks.length <= 1, `시드 ${seed}: 대형 속보가 두 번`);
    for (const s of shocks) assert.ok(s.breaking && SHOCK_STAGES.has(s.stageId), `시드 ${seed}: 속보가 아니거나 후보가 아님`);
  }
});

test("대형 속보: 'off'면 생기지 않고, 그 밖의 시나리오(뉴스·결말·시장 변동)는 그대로다", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const on = buildPlan(seed, 'solo'), off = buildPlan(seed, 'solo', [], undefined, undefined, { bigBreaking: 'off' });
    assert.equal(hasShock(off), false);
    const strip = (p: typeof on) => JSON.stringify(p.rounds.map(r => ({ ...r, stages: r.stages.map(({ shock: _s, ...x }) => x) })));
    assert.equal(strip(on), strip(off), `시드 ${seed}: 대형 속보 표시 말고도 바뀐 것이 있음`);
  }
});

test('대형 속보: 학술제(운영자) 방도 시드를 바꾸지 않고 다른 방과 같은 시나리오를 쓴다', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const fest = GameRoom.create({ code: '424242', mode: 'friend', now: T0, seed, operated: true });
    assert.equal(fest.s.seed, seed);
    assert.equal(hasShock(fest.s.plan), hasShock(buildPlan(seed, 'friend')), `시드 ${seed}`);
  }
});

test('대형 속보: 대상 종목은 속보 순간 VI 기준을 넘고, 같은 업종은 덜 움직여 VI 아래에 머문다', () => {
  const { room } = toShockTrade(shockSeed());
  const live = room.s.live!, at = live.breakAt!;
  const st = room.currentRound.stages.find(s => s.shock)!;
  const stage = stageById.get(st.stageId)!;
  const target = stage.targets[0], dir = stage.signal[target]!;
  const p = live.paths[target];
  assert.equal(viDirection(p[0], p[at]), dir, '속보 순간 대상 종목이 VI 기준을 넘지 않음');
  assert.ok(Math.abs(p[at] - p[at - 1]) * 10000 / p[0] > SHOCK_BP * 0.8, '한 번에 크게 움직이지 않음');
  const g = stockOf(target).group;
  for (const [code, path] of Object.entries(live.paths)) {
    if (code === target || stockOf(code as never).group !== g) continue;
    const jump = Math.abs(path[at] - path[at - 1]) * 10000 / path[0];
    assert.ok(jump < VI_BP, `${code}: 같은 업종 종목이 VI만큼 튐`);
  }
});

test('대형 속보: VI가 실제로 걸리고, 속보가 공개되기 전에는 대형 속보라는 표시가 화면에 나가지 않는다', () => {
  const { room, a } = toShockTrade(shockSeed());
  const live = room.s.live!, at = live.breakAt!;
  const target = stageById.get(room.currentRound.stages.find(s => s.shock)!.stageId)!.targets[0];
  const before = room.view(a, 'player', live.startedAt + (at - 1) * 1000);
  assert.ok(before.news.flatMap(r => r.cards).every(c => !c.card.shock && !c.card.breaking), '공개 전 속보가 보임');
  room.tick(live.startedAt + at * 1000);
  const after = room.view(a, 'player', live.startedAt + at * 1000);
  assert.ok(after.news.flatMap(r => r.cards).some(c => c.card.shock), '공개 뒤에도 대형 속보 표시 없음');
  assert.ok(room.haltLeft(target) > 0, '대상 종목에 VI가 걸리지 않음');
});

test('대형 속보 설정: 서버 규칙은 off만 받고, 홈 화면 기기 저장에는 남기지 않는다', () => {
  assert.equal(cleanSettings(JSON.stringify({ bigBreaking: 'always' })).bigBreaking, undefined);
  assert.equal(cleanSettings(JSON.stringify({ bigBreaking: 'off' })).bigBreaking, 'off');
  assert.equal(cleanSettings(JSON.stringify({ bigBreaking: 'yes' })).bigBreaking, undefined);
  assert.equal(persistedSettings({ bigBreaking: 'off', rounds: 5 }).bigBreaking, undefined);
});
