/* 용어 사전 화면(#/glossary)과 용어 퀴즈(#/glossary?quiz=1).
   #/glossary/<id> 로 들어오면 그 용어를 펼친 채로 보여 줍니다. */
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, makeQuiz, termById, TERMS, type QuizQuestion, type TermCategory } from '../../../shared/glossary';
import { navigate } from '../App';
import { Disclaimer } from '../ui';
import { TermLink, useGlossary } from './GlossaryContext';

export function GlossaryPage({ termId, query }: { termId: string | null; query: URLSearchParams }) {
  if (query.get('quiz') === '1') return <Quiz pool={query.get('pool')?.split(',').filter(Boolean) ?? null} />;
  return <Dictionary focus={termId} />;
}

function Dictionary({ focus }: { focus: string | null }) {
  const { seen } = useGlossary();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<TermCategory | 'all'>(() => (focus && termById.get(focus)?.category) || 'all');
  const [openId, setOpenId] = useState<string | null>(focus);
  useEffect(() => { if (focus) document.getElementById(`t-${focus}`)?.scrollIntoView({ block: 'center' }); }, [focus]);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return TERMS.filter(t => (cat === 'all' || t.category === cat) &&
      (!k || [t.term, t.en ?? '', t.short, ...t.match].some(s => s.toLowerCase().includes(k))));
  }, [q, cat]);
  const learned = TERMS.filter(t => seen.has(t.id)).length;
  return (
    <main className="lesson">
      <button className="link back" onClick={() => navigate('/')}>← 처음으로</button>
      <p className="course">처음 듣는 말이 나오면 눌러 보세요</p>
      <h1 className="h1">주식 용어 사전</h1>
      <div className="progress" aria-label={`열어 본 용어 ${learned}개, 전체 ${TERMS.length}개`}>
        <i style={{ width: `${learned / TERMS.length * 100}%` }} />
      </div>
      <p className="hint">열어 본 용어 {learned}/{TERMS.length}개 · 게임 화면에서 밑줄 친 낱말을 눌러도 여기에 기록됩니다.</p>
      <button className="cta" onClick={() => navigate('/glossary?quiz=1')}>용어 퀴즈 5문제</button>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="용어 검색 (예: 공시, 반대매매)" aria-label="용어 검색" />
      <div className="cat-row" role="group" aria-label="분류">
        <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>전체</button>
        {CATEGORIES.map(c => <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      <ul className="term-list">
        {list.map(t => (
          <li key={t.id} id={`t-${t.id}`} className={openId === t.id ? 'open' : ''}>
            <button className="term-row" aria-expanded={openId === t.id} onClick={() => setOpenId(openId === t.id ? null : t.id)}>
              <span><b>{t.term}</b>{seen.has(t.id) && <small className="seen"> ✓</small>}<small>{t.short}</small></span>
            </button>
            {openId === t.id && <div className="term-detail">
              <p>{t.body}</p>
              {t.game && <p className="term-game"><b>이 게임에서는</b> {t.game}</p>}
              {t.related.length > 0 && <p className="hint">관련: {t.related.map((r, i) => <span key={r}>{i ? ', ' : ''}<TermLink id={r} /></span>)}</p>}
            </div>}
          </li>
        ))}
        {!list.length && <li><p className="hint">찾는 용어가 없습니다.</p></li>}
      </ul>
      <Disclaimer />
    </main>
  );
}

function Quiz({ pool }: { pool: string[] | null }) {
  const [round, setRound] = useState(0);
  const questions = useMemo<QuizQuestion[]>(() => makeQuiz(Math.random, 5, pool ?? undefined), [round, pool]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const { open } = useGlossary();
  const restart = () => { setRound(r => r + 1); setI(0); setPicked(null); setScore(0); };
  const back = <button className="link back" onClick={() => navigate('/glossary')}>← 용어 사전</button>;
  if (!questions.length) return <main className="lesson">{back}<p className="hint">퀴즈로 낼 용어가 없습니다.</p></main>;
  if (i >= questions.length) return (
    <main className="lesson">
      {back}
      <h1 className="h1">퀴즈 결과</h1>
      <p className="rank-big num">{score}/{questions.length}</p>
      <p className="lede">{score === questions.length ? '전부 맞혔어요. 게임에서 직접 확인해 보세요.' : '틀린 용어는 아래에서 다시 읽어 보세요.'}</p>
      <ul className="term-chips">{questions.map(q => <li key={q.termId}><button className="term-chip" onClick={() => open(q.termId)}>{termById.get(q.termId)!.term}</button></li>)}</ul>
      <button className="cta" onClick={restart}>새 문제 5개</button>
      <button className="ghost" onClick={() => navigate('/')}>처음으로</button>
      <Disclaimer />
    </main>
  );
  const q = questions[i], t = termById.get(q.termId)!;
  const choose = (k: number) => { if (picked !== null) return; setPicked(k); if (k === q.answer) setScore(s => s + 1); };
  return (
    <main className="lesson">
      {back}
      <p className="course">용어 퀴즈 {i + 1}/{questions.length}</p>
      <h1 className="h1">“{t.term}”의 뜻은?</h1>
      <div className="quiz-opts">
        {q.options.map((o, k) => (
          <button key={o.termId} disabled={picked !== null}
            className={picked === null ? '' : k === q.answer ? 'right' : k === picked ? 'wrong' : ''}
            onClick={() => choose(k)}>{o.text}</button>
        ))}
      </div>
      {picked !== null && <div className="term-detail">
        <p className={picked === q.answer ? 'correct' : 'error'}>{picked === q.answer ? '맞았어요' : `정답: ${t.short}`}</p>
        <p>{t.body}</p>
        {picked !== q.answer && <p className="hint">고른 보기는 “{termById.get(q.options[picked].termId)!.term}”의 뜻입니다.</p>}
        <button className="cta" onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 < questions.length ? '다음 문제' : '결과 보기'}</button>
      </div>}
      <Disclaimer />
    </main>
  );
}
