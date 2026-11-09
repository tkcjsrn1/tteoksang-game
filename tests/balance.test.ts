/* 게임의 핵심 메시지 "뉴스대로 사면 이기는 게임이 아니다"를 숫자로 지킵니다.
   사건을 추가하거나 영향값을 바꿔 이 테스트가 깨지면, 기준을 낮추지 말고 콘텐츠를 고치세요. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBalance, npcBalance } from '../server/src/balance';

test('호재처럼 보이는 헤드라인을 따라 사면 평균적으로 이득이 거의 없다', () => {
  const c = contentBalance();
  assert.ok(Math.abs(c.headlineUp) <= 60, `헤드라인 추종 기대 영향 ${c.headlineUp.toFixed(0)}bp`);
});
test('주문 전 단서를 읽으면 평균적으로 유리하다', () => {
  const c = contentBalance();
  assert.ok(c.clue >= 120, `단서 추종 기대 영향 ${c.clue.toFixed(0)}bp`);
  assert.ok(c.clue - c.headlineUp >= 100, '단서와 헤드라인의 차이가 작음');
});
test('NPC 속보 추격형의 평균 수익률은 분산형보다 낮다', () => {
  const r = npcBalance(200);
  const chaser = r.find(x => x.label.includes('속보'))!, div = r.find(x => x.label.includes('분산'))!;
  assert.ok(chaser.mean < div.mean, `속보 추격형 ${chaser.mean.toFixed(2)}% / 분산형 ${div.mean.toFixed(2)}%`);
});
