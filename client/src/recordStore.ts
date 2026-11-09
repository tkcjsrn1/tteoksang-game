/* 개인 기록. 끝난 판의 순위·수익률을 이 기기에만 저장합니다(서버에 보내지 않음).
   저장 형식 계산은 React 없이 순수 함수로 두어 tests/records.test.ts에서 검사합니다. */
import type { GameMode } from '../../shared/types';

export interface GameRecord {
  code: string; mode: GameMode; at: number;
  rank: number; players: number; returnPct: number; fees: number;
  /** 사람 참가자 중 1등이었는지(NPC 제외) */
  bestHuman: boolean;
}
export const MAX_RECORDS = 50;
export const RECORDS_KEY = 'records';

/** 같은 방은 한 번만 기록하고, 최근 50판만 남깁니다. 최신이 앞입니다. */
export function addRecord(list: GameRecord[], rec: GameRecord): GameRecord[] {
  if (list.some(r => r.code === rec.code && r.at > rec.at - 6 * 60 * 60 * 1000)) return list;
  return [rec, ...list].slice(0, MAX_RECORDS);
}

export interface RecordSummary { games: number; avgReturn: number; bestReturn: number; worstReturn: number; firsts: number; humanFirsts: number; totalFees: number }
export function summarize(list: GameRecord[]): RecordSummary | null {
  if (!list.length) return null;
  const rets = list.map(r => r.returnPct);
  return {
    games: list.length,
    avgReturn: rets.reduce((a, b) => a + b, 0) / list.length,
    bestReturn: Math.max(...rets),
    worstReturn: Math.min(...rets),
    firsts: list.filter(r => r.rank === 1).length,
    humanFirsts: list.filter(r => r.bestHuman).length,
    totalFees: list.reduce((a, r) => a + r.fees, 0)
  };
}
/** 저장된 문자열을 안전하게 읽습니다. 깨졌으면 빈 목록입니다. */
export function parseRecords(raw: string | null): GameRecord[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter(r => r && typeof r.code === 'string' && Number.isFinite(r.returnPct) && Number.isFinite(r.rank)).slice(0, MAX_RECORDS) : [];
  } catch { return []; }
}
