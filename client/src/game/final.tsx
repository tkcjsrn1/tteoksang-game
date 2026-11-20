/* 판이 끝난 뒤 화면: 결과, 투자 행동 리포트, 매매일지, 이번 판에 나온 용어.
   Game.tsx에서 옮겼습니다(2026-11). 옮기기만 했고 동작은 그대로입니다. */
import { useEffect, useMemo, useState } from 'react';
import type { ClientMsg, PredictionTrendRow, RoomView, Side, StockCode } from '../../../shared/types';
import { roomLabel, stockOf } from '../../../shared/rules';
import { navigate } from '../App';
import { play, revealTone, useCountUp } from '../fx';
import { buildJournal, journalKey, parseNotes } from '../journal';
import { termById, termsIn } from '../../../shared/glossary';
import { TermLink, useGlossary } from '../glossary/GlossaryContext';
import { rememberArcs, store } from '../net';
import { addRecord, parseRecords, RECORDS_KEY } from '../recordStore';
import { BreakdownPanel, Confetti, dir, Disclaimer, pct, pctBp, PriceChart, signedWon, StockAvatar, won } from '../ui';
import { SectorBoard, Sheet } from './parts';

export function BehaviorReport({ metrics }: { metrics: NonNullable<RoomView['report']>['metrics'] }) {
  if (metrics.length === 0) return null;
  const shown = metrics.filter(m => m.available), missing = metrics.filter(m => !m.available);
  const names = missing.map(m => m.title).join(' · ');
  if (shown.length === 0) return (
    <section className="sec">
      <h2 className="h">내 투자 행동 리포트</h2>
      <p className="hint">이번 판은 거래가 적어서 계산할 것이 없었어요. 사고파는 횟수가 늘면 {names}을 숫자로 보여 드립니다.</p>
    </section>
  );
  return (
    <section className="sec">
      <h2 className="h">내 투자 행동 리포트</h2>
      <p className="hint">이번 판에서 관찰한 행동만 설명합니다.</p>
      <div className="metrics">{shown.map(m => (
        <div className="metric" key={m.key}>
          <h3>{m.title}</h3>
          <p className="metric-val">{m.value}</p>
          <p>{m.text}</p>
          <details><summary>계산 방법</summary><p className="hint">{m.formula} · 필요한 관찰 수: {m.minObservations}</p></details>
        </div>
      ))}</div>
      {missing.length > 0 && <p className="hint">{names}은 거래가 더 쌓이면 나와요.</p>}
    </section>
  );
}

/** 라운드별 예측 정답률(참가자 전체 합계). 판을 하며 단서 읽기가 나아졌는지 보는 자료입니다. 예측이 하나도 없으면 감춥니다 */
export function PredictionTrend({ rows, big = false }: { rows?: PredictionTrendRow[]; big?: boolean }) {
  if (!rows || !rows.some(r => r.total > 0)) return null;
  const rate = (r: PredictionTrendRow) => r.total ? Math.round(r.correct / r.total * 100) : null;
  return (
    <section className={big ? 'd-trend' : 'sec trend'} aria-label="라운드별 예측 정답률">
      <h2 className="h">라운드별 예측 정답률</h2>
      <ol className="trend-bars">{rows.map(r => {
        const p = rate(r);
        return <li key={r.round}>
          <span className="num">{r.round}R</span>
          <span className="trend-bar" aria-hidden="true"><i style={{ width: `${p ?? 0}%` }} /></span>
          <span className="num">{p === null ? '예측 없음' : `${p}% (${r.correct}/${r.total})`}</span>
        </li>;
      })}</ol>
      <p className="hint">뉴스를 읽고 결과가 시장 기대보다 좋을지 나쁠지 맞힌 비율이에요. 라운드마다 사건이 달라서 정답률이 오르내릴 수 있어요.</p>
    </section>
  );
}

export function Finished({ view, send }: { view: RoomView; send: (m: ClientMsg) => void }) {
  const rep = view.report;
  const [open, setOpen] = useState<StockCode | null>(null);
  const [point, setPoint] = useState<number | null>(null);
  const stock = open ? view.stocks.find(s => s.code === open)! : null;
  const pointData = stock?.history.find(h => h.round === point);
  const shownValue = useCountUp(rep?.value ?? 0, 1200, rep ? rep.value - Math.round(rep.value * 0.02) : 0);
  useEffect(() => { if (rep) play(rep.rank === 1 ? 'win' : revealTone(rep.returnPct)); }, [!!rep]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 끝난 판을 이 기기의 개인 기록에 한 번만 남깁니다. */
  useEffect(() => {
    if (!rep || view.you.role !== 'player') return;
    const humans = view.leaderboard.filter(l => l.kind === 'human');
    const rec = { code: view.code, mode: view.mode, at: Date.now(), rank: rep.rank, players: view.leaderboard.length, returnPct: rep.returnPct, fees: rep.fees,
      bestHuman: !humans.some(h => h.playerId !== view.you.id && h.value > rep.value) };
    store.set(RECORDS_KEY, JSON.stringify(addRecord(parseRecords(store.get(RECORDS_KEY)), rec)));
  }, [rep, view.code, view.mode, view.you.id, view.you.role, view.leaderboard]);
  /* 이번 판 사건을 적어 두어 다음 판에 같은 이야기가 또 나오지 않게 합니다. */
  useEffect(() => { if (view.arcIds) rememberArcs(view.arcIds); }, [view.arcIds]);
  /* 내 평가액. 순위표에 "나와 얼마 차이"를 붙이는 데 씁니다 */
  const myValue = view.leaderboard.find(l => l.playerId === view.you.id)?.value ?? null;
  return (
    <main className="final">
      <section className="sec final-head">
        <p className="course">{roomLabel(view.mode, view.operated)} · {view.totalRounds}라운드 끝</p>
        {rep?.rank === 1 && <Confetti />}
        {rep ? <>
          <div className={`trophy${rep.rank === 1 ? ' shine' : ''}`} aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={rep.rank === 1 ? 'var(--gold)' : 'var(--faint)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg></div>
          <h1 className="rank-big pop">{view.leaderboard.length}명 중 {rep.rank}위</h1>
          <p className="num" aria-label={`${won(rep.value)} ${pct(rep.returnPct)}`}>{won(shownValue)} <b className={dir(rep.returnPct)}>{pct(rep.returnPct)}</b></p>
        </> : <h1 className="rank-big">결과 발표</h1>}
      </section>
      <section className="sec tight">
        <ol className="rank-list">{view.leaderboard.map(l => {
          const me = l.playerId === view.you.id;
          /* 내 평가액과의 차이. "3위"보다 "2위와 38만 원 차이"가 와닿습니다 */
          const gap = myValue === null || me ? null : l.value - myValue;
          return <li key={l.playerId} className={me ? 'me' : ''}>
            <span className={`r${l.rank === 1 ? ' first' : ''}`}>{l.rank}</span>
            <span className="who"><b>{me ? `나 · ${l.label}` : l.label}</b>{l.npcRule
              ? <small>{l.npcRule}</small>
              : gap !== null && <small className="gap">나와 {signedWon(gap)}</small>}</span>
            <span className={`ret ${dir(l.returnPct)}`}>{pct(l.returnPct)}</span>
          </li>;
        })}</ol>
      </section>
      {rep && <TradeJournal view={view} fees={rep.fees} fallback={rep.majorTrades} />}
      {rep && rep.judgments.length > 0 && <section className="sec"><h2 className="h">내 판단 기록</h2><ul className="list">{rep.judgments.map((j, i) => <li key={i}><span>{j.title}<small>{j.choice} · {j.concept}</small></span></li>)}</ul></section>}
      {rep && <BehaviorReport metrics={rep.metrics} />}
      <PredictionTrend rows={view.predictionTrend} />
      <GameTerms view={view} />
      <section className="sec tight">
        <div className="list-head"><span>종목 그래프 다시 보기</span><span>처음 대비</span></div>
        <SectorBoard stocks={view.stocks} defaultOpen={new Set(view.stocks.map(s => stockOf(s.code).group))} pinned={[]} summary={b => { const r = b.stocks.reduce((a, s) => a + (s.price / s.startPrice - 1) * 100, 0) / b.stocks.length; return <small className={dir(r)}>평균 {pct(r)}</small>; }}
          renderRow={s => <button key={s.code} className="row" onClick={() => { setOpen(s.code); setPoint(s.history[s.history.length - 1]?.round ?? null); }}><StockAvatar code={s.code} name={s.name} /><span className="row-main"><b>{s.name}</b><small>{s.sector}</small></span><span className="row-price"><b className="num">{s.price.toLocaleString('ko-KR')}원</b><small className={dir(s.price - s.startPrice)}>{pct((s.price / s.startPrice - 1) * 100)}</small></span></button>} />
      </section>
      {stock && <Sheet title={stock.name} onClose={() => setOpen(null)}><PriceChart stock={stock} totalRounds={view.totalRounds} selected={point} onSelect={setPoint} />{pointData && <BreakdownPanel b={pointData} />}</Sheet>}
      <div className="final-actions">
        <button className="ghost" onClick={() => navigate('/records')}>내 기록</button>
        {view.nextRoomCode
          ? <button className="cta" onClick={() => navigate(`/room/${view.nextRoomCode}`)}>다음 판 대기실로</button>
          : view.operated
            ? <p className="hint full" style={{ textAlign: 'center' }}>운영자가 다음 판을 열면 여기에 입장 버튼이 나타납니다.</p>
            : <button className="cta" onClick={() => send({ t: 'rematch' })}>{view.mode === 'solo' ? '한 판 더' : '같은 멤버로 한 판 더'}</button>}
        <button className="link full" onClick={() => navigate('/')}>처음으로</button>
      </div>
      <Disclaimer />
    </main>
  );
}

/** 매매일지: 내 체결마다 그 라운드 뉴스, 종가 기준 결과, 내 메모를 나란히 보여 줍니다. 메모는 이 기기에만 저장합니다. */
export function TradeJournal({ view, fees, fallback }: { view: RoomView; fees: number; fallback: { round: number; name: string; side: Side; qty: number; price: number }[] }) {
  const entries = useMemo(() => buildJournal(view), [view]);
  const [notes, setNotes] = useState(() => parseNotes(store.get(journalKey(view.code))));
  const [editing, setEditing] = useState<string | null>(null);
  const save = (key: string, text: string) => {
    const next = { ...notes, [key]: text.slice(0, 200) };
    if (!text.trim()) delete next[key];
    setNotes(next); store.set(journalKey(view.code), JSON.stringify(next));
  };
  const good = entries.filter(e => e.verdict === 'good').length, bad = entries.filter(e => e.verdict === 'bad').length;
  const label = (k: string, t: 'stop' | 'take' | null) => t === 'stop' ? '손절' : t === 'take' ? '익절' : k === 'limit' ? '지정가' : '시장가';
  if (!view.portfolio) return (
    <section className="sec">
      <h2 className="h">주요 거래 <small className="hint">· 낸 수수료 {won(fees)}</small></h2>
      {fallback.length ? <ul className="list">{fallback.map((t, i) => <li key={i}><span>{t.round}라운드 {t.name}<small>{t.side === 'buy' ? '매수' : '매도'} {t.qty.toLocaleString('ko-KR')}주 · {won(t.price)}</small></span></li>)}</ul> : <p className="hint">이번 판에는 거래가 없었습니다.</p>}
    </section>
  );
  return (
    <section className="sec journal">
      <h2 className="h"><TermLink id="trading-journal">매매일지</TermLink> <small className="hint">· 거래 {entries.length}건 · 수수료·세금 {won(fees)}</small></h2>
      {entries.length === 0 ? <p className="hint">이번 판에는 거래가 없었습니다.</p> : <>
        <p className="hint">체결가를 그 라운드 종가와 비교했어요. 유리 {good}건 · 불리 {bad}건. 다음 판을 위해 이유를 한 줄 남겨 보세요.</p>
        <ol className="journal-list">{entries.map(e => (
          <li key={e.key} className="journal-item">
            <div className="journal-top">
              <span className={`side-tag ${e.side}`}>{e.side === 'buy' ? '매수' : '매도'}</span>
              <b>{e.round}R · {e.name}</b>
              <small className="hint">{label(e.kind, e.trigger)} · {e.qty.toLocaleString('ko-KR')}주 · {won(e.price)}</small>
            </div>
            {e.headline && <p className="journal-news">라운드 관련 뉴스 · {e.headline}</p>}
            {e.close !== null && e.afterBp !== null && <p className="journal-after">
              그 라운드 종가 {won(e.close)} → <b className={e.verdict === 'good' ? 'up' : e.verdict === 'bad' ? 'down' : 'flat'}>{e.verdict === 'good' ? '유리' : e.verdict === 'bad' ? '불리' : '비슷'} {pctBp(e.afterBp)}</b>
            </p>}
            {editing === e.key
              ? <textarea className="journal-note" aria-label={`${e.round}라운드 ${e.name} 메모`} maxLength={200} rows={2} autoFocus defaultValue={notes[e.key] ?? ''}
                  placeholder="왜 샀는지·팔았는지, 다음엔 어떻게 할지" onBlur={ev => { save(e.key, ev.target.value); setEditing(null); }} />
              : <button className="link journal-memo" onClick={() => setEditing(e.key)}>{notes[e.key] ? `메모: ${notes[e.key]}` : '+ 메모 남기기'}</button>}
          </li>
        ))}</ol>
        <p className="hint">종가 비교는 그 라운드 하나만 본 결과입니다. 길게 보면 달라질 수 있어요.</p>
      </>}
    </section>
  );
}

/** 이번 판 뉴스·돌발 카드에 나온 용어를 모아 복습하게 합니다. 열어 본 용어는 ✓로 표시합니다. */
export function GameTerms({ view }: { view: RoomView }) {
  const { open, seen } = useGlossary();
  /* 모든 뉴스 카드에 '시장의 기대치' 칸이 있으므로 항상 맨 앞에 넣습니다. */
  const ids = useMemo(() => termsIn([
    '시장의 기대치',
    ...view.news.flatMap(r => r.cards.flatMap(c => [c.card.headline, c.card.facts, c.card.expectation, c.card.remaining, c.card.clue,
      ...(c.result ? [c.result.actual, c.result.gap, c.result.concept, ...c.result.impacts.map(i => i.reason)] : [])])),
    ...(view.report?.judgments.map(j => j.concept) ?? [])
  ]), [view.news, view.report]);
  if (!ids.length) return null;
  const learned = ids.filter(id => seen.has(id)).length;
  return (
    <section className="sec game-terms">
      <h2 className="h">이번 판에 나온 용어</h2>
      <p className="hint">{ids.length}개 중 {learned}개를 열어 봤어요. 눌러서 뜻을 확인하세요.</p>
      <div className="term-chips">{ids.map(id => <button key={id} className={`term-chip${seen.has(id) ? ' seen' : ''}`} onClick={() => open(id)}>{termById.get(id)!.term}</button>)}</div>
      <button className="ghost blue" onClick={() => navigate(`/glossary?quiz=1&pool=${ids.join(',')}`)}>이 용어들로 퀴즈 5문제</button>
    </section>
  );
}
