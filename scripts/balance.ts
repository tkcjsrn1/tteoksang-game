/* 뉴스대로 사면 이기는 공식이 없는지, 단서를 읽으면 도움이 되는지 시나리오 데이터로 계산합니다.
   기준은 tests/balance.test.ts에 있습니다. */
import { contentBalance, npcBalance } from '../server/src/balance';

const c = contentBalance();
console.log(`호재처럼 보이는 뉴스 종목의 사건 기대 영향: ${c.headlineUp.toFixed(0)}bp (${c.headlineUpN}건)  ← 0 근처여야 함`);
console.log(`악재처럼 보이는 뉴스 종목의 사건 기대 영향: ${c.headlineDown.toFixed(0)}bp (${c.headlineDownN}건)`);
console.log(`단서 방향으로 샀을 때의 사건 기대 영향: ${c.clue.toFixed(0)}bp (${c.clueN}건)  ← 충분히 커야 함`);
const N = 500;
for (const n of npcBalance(N)) console.log(`${n.label}: 평균 ${n.mean.toFixed(1)}%, 중앙값 ${n.median.toFixed(1)}%, NPC 중 1위 ${n.firsts}/${N}`);
