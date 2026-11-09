/* 밸런스 지표. "뉴스 헤드라인대로 사면 이기는 공식"이 없고, 단서를 읽으면 유리한지 숫자로 확인합니다.
   scripts/balance.ts(사람이 보는 보고서)와 tests/balance.test.ts(기준 검사)가 함께 씁니다. */
import { ARCS, type Outcome } from './content';
import { GameRoom } from './room';

/** 결말 가중치로 평균 낸 종목 영향(bp) */
export const expectedBp = (outcomes: Outcome[], code: string) => {
  const total = outcomes.reduce((a, x) => a + x.weight, 0);
  return outcomes.reduce((a, x) => a + x.weight / total * (x.impacts.find(i => i.code === code)?.bp ?? 0), 0);
};

export interface ContentBalance { headlineUp: number; headlineUpN: number; headlineDown: number; headlineDownN: number; clue: number; clueN: number }
export function contentBalance(): ContentBalance {
  let up = 0, upN = 0, down = 0, downN = 0, clue = 0, clueN = 0;
  for (const a of ARCS) for (const s of a.stages) {
    for (const [code, dir] of Object.entries(s.signal)) {
      const e = expectedBp(s.outcomes, code);
      if (dir === 1) { up += e; upN++; } else { down += e; downN++; }
    }
    clue += expectedBp(s.outcomes, s.targets[0]) * s.clueDir; clueN++;
  }
  return { headlineUp: up / upN, headlineUpN: upN, headlineDown: down / downN, headlineDownN: downN, clue: clue / clueN, clueN };
}

export interface NpcBalance { label: string; mean: number; median: number; firsts: number }
/** 친구 대전을 seeds판 돌려 NPC 3종의 성적을 냅니다. 시드가 같으면 결과도 같습니다. */
export function npcBalance(seeds = 500): NpcBalance[] {
  const sum: Record<string, number[]> = {}, wins: Record<string, number> = {};
  for (let seed = 1; seed <= seeds; seed++) {
    const room = GameRoom.create({ code: '000000', mode: 'friend', now: 0, seed });
    room.join(null, 0); room.join(null, 0);
    room.start(0);
    while (room.s.status === 'playing') {
      const t = room.s.phaseEndsAt!;
      if (room.tick(t) === 'settled') room.beginRecap(t);
    }
    const lb = room.leaderboard().filter(x => x.kind === 'npc');
    lb.forEach(x => (sum[x.label] ??= []).push(x.returnPct));
    wins[lb[0].label] = (wins[lb[0].label] ?? 0) + 1;
  }
  return Object.entries(sum).map(([label, v]) => {
    v.sort((a, b) => a - b);
    return { label, mean: v.reduce((a, b) => a + b, 0) / v.length, median: v[v.length >> 1], firsts: wins[label] ?? 0 };
  });
}
