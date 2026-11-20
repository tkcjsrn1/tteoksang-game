import { GameRoom } from '../server/src/room';
import { stageById } from '../server/src/content';
import { viDirection } from '../shared/rules';
const T0 = 3_000_000;
const cases = [['지금 main과 같음(대형 속보 끔)·기본 5라운드', { bigBreaking: 'off' }, 'solo'], ['지금 main과 같음·빠른 판', { bigBreaking: 'off', pace: 'demo' }, 'solo'], ['대형 속보·기본 5라운드', {}, 'solo'], ['대형 속보·빠른 판', { pace: 'demo' }, 'solo'], ['대형 속보·8라운드', { rounds: 8 }, 'solo'], ['학술제 반드시 1번', { bigBreaking: 'always' }, 'friend'], ['학술제 반드시+빠른 판', { bigBreaking: 'always', pace: 'demo' }, 'friend']] as const;
for (const [label, settings, mode] of cases) {
  let games = 0, viGames = 0, viTarget = 0, viOther = 0, shockGames = 0, roundsSeen = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const room = GameRoom.create({ code: '424242', mode: mode as never, now: T0, seed, settings: settings as never });
    room.join(null, T0); if (mode === 'friend') room.join(null, T0 + 1); room.start(T0); games++;
    if (room.s.plan.rounds.some(r => r.stages.some(s => s.shock))) shockGames++;
    let any = false, guard = 0; const seen = new Set<number>(); let now = T0;
    while (room.s.status !== 'finished' && guard++ < 400) {
      const l = room.s.live;
      if (room.s.phase === 'trade' && l && !seen.has(l.round)) {
        seen.add(l.round); roundsSeen++;
        const sh = room.currentRound.stages.find(s => s.breaking && s.shock);
        const target = sh ? stageById.get(sh.stageId)!.targets[0] : null;
        for (const [code, path] of Object.entries(l.paths) as [string, number[]][]) {
          if (path.some(p => viDirection(path[0], p) !== 0)) { any = true; if (code === target) viTarget++; else viOther++; }
        }
      }
      now = room.s.phaseEndsAt ?? now;
      if (room.tick(now) === 'settled') room.beginRecap(now);
    }
    if (any) viGames++;
  }
  console.log(`${label}: 대형 속보 판 ${(shockGames / games * 100).toFixed(0)}% · VI 판 ${(viGames / games * 100).toFixed(0)}% · 대상 VI ${viTarget} · 그 밖 VI ${viOther} · 본 라운드 ${roundsSeen}`);
}
