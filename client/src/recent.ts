/* 최근에 본 사건을 기기에 적어 둡니다. 다음 판을 만들 때 서버로 보내면 서버가 그 사건들을
   뒤로 미뤄, 같은 이야기가 연달아 나오지 않습니다. 사건이 모자라면 서버가 알아서 다시 씁니다. */
export const RECENT_ARCS = 12;

/** 저장해 둔 값을 읽습니다. 깨졌거나 없으면 빈 목록입니다. */
export function parseRecentArcs(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))].slice(0, RECENT_ARCS);
  } catch { return []; }
}

/** 이번 판 사건을 앞쪽에 더합니다. 같은 id는 한 번만 남고, 오래된 것부터 밀려납니다. */
export function mergeRecentArcs(prev: string[], ids: string[]): string[] {
  const add = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return [...new Set([...add, ...prev])].slice(0, RECENT_ARCS);
}
