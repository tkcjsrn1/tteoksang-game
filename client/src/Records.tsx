/* 내 기록 화면(#/records). 판별 순위·수익률과 열어 본 용어 수를 보여 줍니다. */
import { useState } from 'react';
import { MODES } from '../../shared/rules';
import { TERMS } from '../../shared/glossary';
import { navigate } from './App';
import { useGlossary } from './glossary/GlossaryContext';
import { store } from './net';
import { parseRecords, RECORDS_KEY, summarize } from './recordStore';
import { dir, Disclaimer, pct, won } from './ui';

export function Records() {
  const [list, setList] = useState(() => parseRecords(store.get(RECORDS_KEY)));
  const { seen } = useGlossary();
  const sum = summarize(list);
  const clear = () => { store.del(RECORDS_KEY); setList([]); };
  const W = 320, H = 90, pts = list.slice().reverse().map(r => r.returnPct);
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
  const x = (i: number) => pts.length < 2 ? W / 2 : 8 + i * (W - 16) / (pts.length - 1);
  const y = (v: number) => 8 + (hi - v) / span * (H - 16);
  return (
    <main className="lesson">
      <button className="link back" onClick={() => navigate('/')}>← 처음으로</button>
      <p className="course">이 기기에만 저장됩니다</p>
      <h1 className="h1">내 기록</h1>
      {sum ? <>
        <dl className="kv">
          <dt>끝낸 판</dt><dd className="num">{sum.games}판</dd>
          <dt>평균 수익률</dt><dd className={`num ${dir(sum.avgReturn)}`}>{pct(sum.avgReturn)}</dd>
          <dt>최고 · 최저</dt><dd className="num"><span className={dir(sum.bestReturn)}>{pct(sum.bestReturn)}</span> · <span className={dir(sum.worstReturn)}>{pct(sum.worstReturn)}</span></dd>
          <dt>전체 1위 · 사람 중 1위</dt><dd className="num">{sum.firsts}판 · {sum.humanFirsts}판</dd>
          <dt>지금까지 낸 수수료</dt><dd className="num">{won(sum.totalFees)}</dd>
          <dt>열어 본 용어</dt><dd className="num">{seen.size}/{TERMS.length}개</dd>
        </dl>
        {pts.length > 1 && <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="판별 수익률 흐름">
          <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth=".8" />
          <polyline fill="none" stroke="var(--led)" strokeWidth="2" points={pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
          {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={v >= 0 ? 'var(--up)' : 'var(--down)'} />)}
        </svg>}
        <p className="hint">수익률이 들쭉날쭉하다면 한 종목에 몰았는지, 헤드라인만 보고 샀는지 최종 화면의 주요 거래를 다시 보세요.</p>
        <h2 className="h">최근 판</h2>
        <ul className="list">{list.map(r => (
          <li key={`${r.code}-${r.at}`}><span>{new Date(r.at).toLocaleDateString('ko-KR')} · {MODES[r.mode]?.label ?? r.mode}<small>{r.players}명 중 {r.rank}위 · 수수료 {won(r.fees)}</small></span>
            <span className={`num ${dir(r.returnPct)}`}>{pct(r.returnPct)}</span></li>
        ))}</ul>
        <button className="link" onClick={clear}>기록 지우기</button>
      </> : <>
        <p className="lede">아직 끝낸 판이 없습니다. 혼자 연습으로 한 판 해 보세요.</p>
        <p className="hint">열어 본 용어 {seen.size}/{TERMS.length}개</p>
      </>}
      <Disclaimer />
    </main>
  );
}
