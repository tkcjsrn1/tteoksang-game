/* 뉴스대로 사면 이기는 공식이 없는지, 단서를 읽으면 도움이 되는지 시나리오 데이터로 계산합니다. */
import { ARCS } from '../server/src/content';
import { GameRoom } from '../server/src/room';

const ev = (o: { weight: number; impacts: { code: string; bp: number }[] }[], code: string) => {
  const total = o.reduce((a, x) => a + x.weight, 0);
  return o.reduce((a, x) => a + x.weight / total * (x.impacts.find(i => i.code === code)?.bp ?? 0), 0);
};
let hdUp = 0, hdN = 0, hdDown = 0, hdDownN = 0, clue = 0, clueN = 0;
for (const a of ARCS) for (const s of a.stages) {
  for (const [code, dir] of Object.entries(s.signal)) {
    const e = ev(s.outcomes, code);
    if (dir === 1) { hdUp += e; hdN++; } else { hdDown += e; hdDownN++; }
  }
  const main = s.targets[0];
  clue += ev(s.outcomes, main) * s.clueDir; clueN++;
}
console.log(`호재처럼 보이는 뉴스 종목의 사건 기대 영향: ${(hdUp / hdN).toFixed(0)}bp (${hdN}건)`);
console.log(`악재처럼 보이는 뉴스 종목의 사건 기대 영향: ${(hdDown / hdDownN).toFixed(0)}bp (${hdDownN}건)`);
console.log(`단서 방향으로 샀을 때의 사건 기대 영향: ${(clue / clueN).toFixed(0)}bp (${clueN}건)`);

/* NPC 3종의 실제 성적 */
const N = 500, sum: Record<string, number[]> = {}, wins: Record<string, number> = {};
for (let seed = 1; seed <= N; seed++) {
  const room = GameRoom.create({ code: '000000', mode: 'friend', now: 0, seed });
  room.join(null, 0); room.join(null, 0);
  room.start(0);
  while (room.s.status === 'playing') {
    const t = room.s.phaseEndsAt!;
    const r = room.tick(t);
    if (r === 'settled') room.beginRecap(t);
  }
  const lb = room.leaderboard().filter(x => x.kind === 'npc');
  lb.forEach(x => (sum[x.label] ??= []).push(x.returnPct));
  wins[lb[0].label] = (wins[lb[0].label] ?? 0) + 1;
}
for (const [k, v] of Object.entries(sum)) {
  v.sort((a, b) => a - b);
  console.log(`${k}: 평균 ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}%, 중앙값 ${v[v.length >> 1].toFixed(1)}%, NPC 중 1위 ${wins[k] ?? 0}/${N}`);
}
