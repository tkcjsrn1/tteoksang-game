import { useEffect, useMemo, useState } from 'react';
import { buildCandle, movingAverage, type Candle } from '../../../shared/candles';
import { navigate } from '../App';
import { bpText, dir, Disclaimer, signedWon, won } from '../ui';
import { candleExample, candleParts, candleQuestion, compareQuestion, dailyCloses, earningsCase, earningsQuestion, fiveMinute, LESSONS, marketBuy, newsCase, newsQuestion, oneMinute, operatingMargin, orderBook, orderQuestion, riskCase, riskQuestion, riskSummary, type CandlePart, type ChoiceQuestion } from './data';
import { TermLink } from '../glossary/GlossaryContext';
import type { ReactNode } from 'react';

const n = (x: number) => Math.round(x).toLocaleString('ko-KR');

export function Lessons({ lessonId, review }: { lessonId: string | null; review: URLSearchParams }) {
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (lesson?.ready) return (
    <main className="lesson">
      <button className="link back" onClick={() => navigate('/lessons')}>← 수업 목록</button>
      <p className="course">수업 {lesson.no}</p>
      <h1 className="h1">{lesson.title}</h1>
      {lesson.id === 'candle' && <CandleLesson />}
      {lesson.id === 'compare' && <CompareLesson />}
      {lesson.id === 'news' && <NewsLesson review={review} />}
      {lesson.id === 'orders' && <OrdersLesson />}
      {lesson.id === 'earnings' && <EarningsLesson />}
      {lesson.id === 'risk' && <RiskLesson />}
      <Disclaimer />
    </main>
  );
  return (
    <main className="lesson">
      <button className="link back" onClick={() => navigate('/')}>← 처음으로</button>
      <p className="course">시간 제한 없음 · 수업당 1~2분</p>
      <h1 className="h1">차트 연습실</h1>
      <p className="lede">예시를 보고, 직접 눌러 보고, 근거를 확인합니다. 모든 기업과 데이터는 가상입니다.</p>
      <div className="board">{LESSONS.map(l => (
        <button key={l.id} className="row" disabled={!l.ready} onClick={() => navigate(`/lessons/${l.id}`)}>
          <span className="row-main"><b>{l.no}. {l.title}</b><small>{l.goal}</small></span>
          <span className="row-price"><small>{l.ready ? '시작' : '준비 중'}</small></span>
        </button>
      ))}</div>
      <Disclaimer />
    </main>
  );
}

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return <ol className="steps">{['예시 보기', '직접 풀기', '근거 확인'].map((t, i) => <li key={t} aria-current={step === i + 1 ? 'step' : undefined} className={step >= i + 1 ? 'on' : ''}>{t}</li>)}</ol>;
}
function NextLesson({ id }: { id: string }) {
  const i = LESSONS.findIndex(l => l.id === id), next = LESSONS[i + 1];
  return next?.ready ? <button className="cta" onClick={() => navigate(`/lessons/${next.id}`)}>다음 수업: {next.title}</button> : <button className="cta" onClick={() => navigate('/lessons')}>수업 목록으로</button>;
}

/* ---------- 수업 1 ---------- */
function CandleSvg({ candle, playing, selected, highlight, onPart }: { candle: Candle; playing: number; selected: CandlePart | null; highlight: CandlePart | null; onPart: (p: CandlePart) => void }) {
  const W = 320, H = 280, cx = 120, bw = 56;
  const hi = candle.high + 80, lo = candle.low - 80;
  const y = (v: number) => 14 + (hi - v) / (hi - lo) * (H - 28);
  const color = candle.close >= candle.open ? 'var(--up)' : 'var(--down)';
  const top = Math.max(candle.open, candle.close), bot = Math.min(candle.open, candle.close);
  const stroke = (p: CandlePart) => (selected === p || highlight === p ? 'var(--led)' : color);
  const label = (v: number, text: string, part: CandlePart) => (
    <g role="button" tabIndex={0} aria-label={`${text} ${n(v)}원`} onClick={() => onPart(part)} onKeyDown={e => { if (e.key === 'Enter') onPart(part); }} style={{ cursor: 'pointer' }}>
      <rect x={196} y={y(v) - 13} width={122} height={26} rx={4} fill={selected === part || highlight === part ? 'var(--led)' : 'var(--panel-2)'} />
      <text x={206} y={y(v) + 5} fontSize="14" fontWeight="700" fill={selected === part || highlight === part ? 'var(--led-ink)' : 'var(--fg)'}>{text} {n(v)}</text>
      <line x1={cx + bw / 2 + 4} x2={194} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 3" />
    </g>
  );
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="봉 하나의 구조">
      {playing >= 1 && <>
        <g role="button" tabIndex={0} aria-label="윗꼬리" onClick={() => onPart('upper')} onKeyDown={e => { if (e.key === 'Enter') onPart('upper'); }} style={{ cursor: 'pointer' }}>
          <rect x={cx - 22} y={y(candle.high) - 4} width={44} height={y(top) - y(candle.high) + 4} fill="transparent" />
          <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(top)} stroke={stroke('upper')} strokeWidth={selected === 'upper' || highlight === 'upper' ? 6 : 4} />
        </g>
        <g role="button" tabIndex={0} aria-label="아랫꼬리" onClick={() => onPart('lower')} onKeyDown={e => { if (e.key === 'Enter') onPart('lower'); }} style={{ cursor: 'pointer' }}>
          <rect x={cx - 22} y={y(bot)} width={44} height={y(candle.low) - y(bot) + 6} fill="transparent" />
          <line x1={cx} x2={cx} y1={y(bot)} y2={y(candle.low)} stroke={stroke('lower')} strokeWidth={selected === 'lower' || highlight === 'lower' ? 6 : 4} />
        </g>
        <rect x={cx - bw / 2} y={y(top)} width={bw} height={Math.max(3, y(bot) - y(top))} fill={color} stroke={stroke('body')} strokeWidth={selected === 'body' || highlight === 'body' ? 4 : 0} role="button" aria-label="몸통" onClick={() => onPart('body')} style={{ cursor: 'pointer' }} />
        {label(candle.high, '고가', 'high')}
        {label(candle.close, '종가', 'close')}
        {label(candle.open, '시가', 'open')}
        {label(candle.low, '저가', 'low')}
      </>}
    </svg>
  );
}
function partPrice(c: Candle, p: CandlePart) {
  if (p === 'open') return won(c.open);
  if (p === 'close') return won(c.close);
  if (p === 'high') return won(c.high);
  if (p === 'low') return won(c.low);
  if (p === 'body') return `${won(c.open)} ~ ${won(c.close)}`;
  if (p === 'upper') return `${won(Math.max(c.open, c.close))} ~ ${won(c.high)}`;
  return `${won(c.low)} ~ ${won(Math.min(c.open, c.close))}`;
}
function CandleLesson() {
  const trades = candleExample.trades;
  const [played, setPlayed] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'explore' | 'quiz' | 'done'>('explore');
  const [part, setPart] = useState<CandlePart | null>(null);
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    if (!running) return;
    if (played >= trades.length) { setRunning(false); return; }
    const t = setTimeout(() => setPlayed(p => p + 1), 800);
    return () => clearTimeout(t);
  }, [running, played, trades.length]);
  const shown = useMemo(() => trades.slice(0, Math.max(1, played)), [trades, played]);
  const candle = buildCandle(0, shown);
  const full = played >= trades.length;
  const onPart = (p: CandlePart) => {
    setPart(p);
    if (mode === 'quiz') {
      if (p === candleQuestion.answer || candleQuestion.alsoCorrect.includes(p)) { setMode('done'); setWrong(false); }
      else setWrong(true);
    }
  };
  const step = mode === 'explore' ? 1 : mode === 'quiz' ? 2 : 3;
  return (
    <>
      <StepBar step={step} />
      <p className="lede">{candleExample.company}의 가상 체결 가격을 순서대로 보며 봉이 만들어지는 과정을 봅니다.</p>
      <ol className="ticks">{trades.map((t, i) => <li key={i} className={i < played ? 'on' : ''}><span className="num">{n(t.price)}</span></li>)}</ol>
      {mode === 'explore' && <button className="ghost" disabled={running} onClick={() => { setPlayed(0); setRunning(true); setPart(null); }}>{played ? '다시 재생' : '체결 재생하기'}</button>}
      <CandleSvg candle={candle} playing={played} selected={mode === 'quiz' ? null : part} highlight={mode === 'quiz' && wrong ? 'lower' : null} onPart={onPart} />
      {full && <p className="tag">{candle.close > candle.open ? '양봉: 종가가 시가보다 높습니다 (빨강)' : '음봉: 종가가 시가보다 낮습니다 (파랑)'}</p>}
      {!played && <p className="hint">재생을 누르면 체결이 하나씩 쌓입니다.</p>}
      {mode === 'explore' && full && !part && <p className="hint">봉의 각 부분을 눌러 보세요.</p>}
      {part && mode !== 'quiz' && <div className="term"><b>{candleParts[part].term}</b> <span className="num">{partPrice(candle, part)}</span><p>{candleParts[part].meaning}</p></div>}
      {mode === 'explore' && full && <button className="cta" onClick={() => { setMode('quiz'); setPart(null); setWrong(false); }}>문제 풀기</button>}
      {mode === 'quiz' && <div className="quiz"><p className="q">{candleQuestion.prompt}</p>{wrong && <p className="error" role="alert">{candleQuestion.wrongHint}</p>}</div>}
      {mode === 'done' && <div className="answer"><p className="correct">정답: {candleQuestion.correct}</p><p>{candleQuestion.explanation}</p><p className="hint">음봉은 반대로 종가가 시가보다 낮을 때 나타나는 파란 봉입니다.</p><NextLesson id="candle" /></div>}
    </>
  );
}

/* ---------- 수업 2 ---------- */
function CandleChart({ candles, selected, highlightVolume, onBar }: { candles: Candle[]; selected: number | null; highlightVolume: boolean; onBar: (start: number) => void }) {
  const W = 340, H = 240, L = 6, R = 50, volH = 60, gap = 12;
  const priceH = H - volH - gap - 8;
  const hi = Math.max(...candles.map(c => c.high)), lo = Math.min(...candles.map(c => c.low));
  const span = Math.max(hi - lo, 1), step = (W - L - R) / candles.length;
  const y = (v: number) => 6 + (hi - v) / span * (priceH - 12);
  const maxV = Math.max(...candles.map(c => c.volume));
  const baseY = H - 2;
  const bw = Math.max(3, Math.min(step * .62, 40));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="봉차트와 거래량">
      <text x={W - R + 4} y={y(hi) + 4} fontSize="11" fill="var(--muted)">{n(hi)}</text>
      <text x={W - R + 4} y={y(lo) + 4} fontSize="11" fill="var(--muted)">{n(lo)}</text>
      <text x={W - R + 4} y={baseY - volH + 10} fontSize="11" fill="var(--muted)">거래량</text>
      {candles.map((c, i) => {
        const x = L + step * i + step / 2, up = c.close >= c.open, color = up ? 'var(--up)' : 'var(--down)';
        const top = Math.max(c.open, c.close), bot = Math.min(c.open, c.close), vh = c.volume / maxV * (volH - 6);
        const sel = selected === c.start;
        return (
          <g key={c.start}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
            <rect x={x - bw / 2} y={y(top)} width={bw} height={Math.max(2, y(bot) - y(top))} fill={color} />
            <g role="button" tabIndex={0} aria-label={`${c.start}분 거래량 ${c.volume}주`} onClick={() => onBar(c.start)} onKeyDown={e => { if (e.key === 'Enter') onBar(c.start); }} style={{ cursor: 'pointer' }}>
              <rect x={x - step / 2} y={baseY - volH} width={step} height={volH} fill="transparent" />
              <rect x={x - bw / 2} y={baseY - vh} width={bw} height={vh} fill={sel || highlightVolume ? 'var(--led)' : 'var(--muted)'} opacity={sel || highlightVolume ? 1 : .55} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
function MaChart({ selected, onSelect }: { selected: number | null; onSelect: (i: number) => void }) {
  const W = 340, H = 170, L = 6, R = 50;
  const ma = movingAverage(dailyCloses, 5);
  const hi = Math.max(...dailyCloses) + 40, lo = Math.min(...dailyCloses) - 40;
  const x = (i: number) => L + i / (dailyCloses.length - 1) * (W - L - R), y = (v: number) => 8 + (hi - v) / (hi - lo) * (H - 28);
  const closeLine = dailyCloses.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const maLine = ma.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="가상 일봉 종가와 5일 이동평균선">
      <polyline fill="none" stroke="var(--muted)" strokeWidth="1.5" points={closeLine} />
      <polyline fill="none" stroke="var(--led)" strokeWidth="2.5" points={maLine} />
      <text x={W - R + 4} y={y(dailyCloses[dailyCloses.length - 1]) + 4} fontSize="11" fill="var(--muted)">종가</text>
      <text x={W - R + 4} y={y(ma[ma.length - 1]!) + 4} fontSize="11" fill="var(--led)">5일선</text>
      {dailyCloses.map((_, i) => i % 2 === 0 && <text key={i} x={x(i)} y={H - 4} fontSize="11" textAnchor="middle" fill="var(--muted)">{i + 1}일</text>)}
      {ma.map((v, i) => v !== null && (
        <g key={i} role="button" tabIndex={0} aria-label={`${i + 1}일째 5일 평균`} onClick={() => onSelect(i)} onKeyDown={e => { if (e.key === 'Enter') onSelect(i); }} style={{ cursor: 'pointer' }}>
          <circle cx={x(i)} cy={y(v)} r="14" fill="transparent" />
          <circle cx={x(i)} cy={y(v)} r={selected === i ? 6 : 3.5} fill="var(--led)" />
        </g>
      ))}
    </svg>
  );
}
function CompareLesson() {
  const [unit, setUnit] = useState<1 | 5>(1);
  const [bar, setBar] = useState<number | null>(null);
  const [ma, setMa] = useState<number | null>(null);
  const [state, setState] = useState<'explore' | 'quiz' | 'done'>('explore');
  const [wrong, setWrong] = useState(false);
  const candles = useMemo(() => (unit === 1 ? oneMinute() : fiveMinute()), [unit]);
  const onBar = (start: number) => {
    setBar(start);
    if (state === 'quiz') { if (unit === 5 && start === compareQuestion.answerStart) { setState('done'); setWrong(false); } else setWrong(true); }
  };
  const c = candles.find(x => x.start === bar) ?? null;
  const fives = fiveMinute();
  const maValues = movingAverage(dailyCloses, 5);
  return (
    <>
      <StepBar step={state === 'explore' ? 1 : state === 'quiz' ? 2 : 3} />
      <p className="lede">같은 체결 기록도 묶는 시간에 따라 봉의 모양이 달라집니다.</p>
      <div className="seg"><button aria-pressed={unit === 1} onClick={() => { setUnit(1); setBar(null); }}>1분봉</button><button aria-pressed={unit === 5} onClick={() => { setUnit(5); setBar(null); }}>5분봉</button></div>
      <CandleChart candles={candles} selected={bar} highlightVolume={state === 'quiz' && wrong} onBar={onBar} />
      <p className="hint">봉 {candles.length}개 · 총 거래량 {n(candles.reduce((a, x) => a + x.volume, 0))}주 · 아래쪽 거래량 막대를 눌러 보세요.</p>
      {c && <div className="term"><b>{unit === 5 ? `${c.start}~${c.start + 4}분` : `${c.start}분`}</b> 거래량 <span className="num">{n(c.volume)}주</span> ({c.trades}건 체결)
        <dl className="kv small"><dt>첫 체결가(시가)</dt><dd className="num">{n(c.open)}</dd><dt>최고 체결가(고가)</dt><dd className="num">{n(c.high)}</dd><dt>최저 체결가(저가)</dt><dd className="num">{n(c.low)}</dd><dt>마지막 체결가(종가)</dt><dd className="num">{n(c.close)}</dd></dl></div>}
      {state === 'explore' && <button className="cta" onClick={() => { setState('quiz'); setUnit(5); setBar(null); setWrong(false); }}>문제 풀기</button>}
      {state === 'quiz' && <div className="quiz"><p className="q">{compareQuestion.prompt}</p>{wrong && <p className="error" role="alert">{compareQuestion.wrongHint}</p>}</div>}
      {state === 'done' && <div className="answer">
        <p className="correct">정답: {compareQuestion.correct}</p><p>{compareQuestion.explanation}</p>
        <table className="rank-table"><thead><tr><th>구간</th><th>첫·최고·최저·마지막</th><th>거래량</th></tr></thead><tbody>{fives.map(f => <tr key={f.start}><td className="num">{f.start}~{f.start + 4}분</td><td className="num left">{n(f.open)} · {n(f.high)} · {n(f.low)} · {n(f.close)}</td><td className="num">{n(f.volume)}</td></tr>)}</tbody></table>
        <h2 className="h">5일 이동평균선</h2>
        <p className="hint">가상 일봉의 최근 종가 5개 평균을 이은 선입니다. 노란 점을 눌러 보세요.</p>
        <MaChart selected={ma} onSelect={setMa} />
        {ma !== null && <div className="term"><b>{ma + 1}일째 5일 평균 <span className="num">{n(maValues[ma]!)}원</span></b><p>종가 5개: <span className="num">{dailyCloses.slice(ma - 4, ma + 1).map(n).join(' + ')}</span></p><p>합계 {n(dailyCloses.slice(ma - 4, ma + 1).reduce((a, b) => a + b, 0))} ÷ 5 = {n(maValues[ma]!)}</p></div>}
        <NextLesson id="compare" />
      </div>}
    </>
  );
}

/* ---------- 수업 3 ---------- */
function NewsChart({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const W = 340, H = 170, L = 16, R = 50;
  const d = newsCase.chart;
  const hi = 10150, lo = 9450;
  const x = (i: number) => L + i / (d.length - 1) * (W - L - R), y = (v: number) => 10 + (hi - v) / (hi - lo) * (H - 34);
  const last = d.length - 1;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="누바칸 가상 가격 그래프">
      <polyline fill="none" stroke="var(--down)" strokeWidth="2.2" points={d.map((p, i) => `${x(i)},${y(p.close)}`).join(' ')} />
      {d.map((p, i) => <text key={p.label} x={x(i)} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--muted)">{p.label}</text>)}
      {d.slice(0, last).map((p, i) => <circle key={i} cx={x(i)} cy={y(p.close)} r="3.5" fill="var(--muted)" />)}
      <text x={x(last) + 10} y={y(d[last].close) + 4} fontSize="12" fontWeight="700" fill="var(--down)">{n(d[last].close)}</text>
      <g role="button" tabIndex={0} aria-label="하락 지점의 근거 열기" onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }} style={{ cursor: 'pointer' }}>
        <circle cx={x(last)} cy={y(d[last].close)} r="20" fill="transparent" />
        <circle cx={x(last)} cy={y(d[last].close)} r={open ? 7 : 6} fill="var(--led)" stroke="var(--panel)" strokeWidth="2" />
      </g>
    </svg>
  );
}
function NewsLesson({ review }: { review: URLSearchParams }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const sel = newsQuestion.options.find(o => o.id === picked);
  const done = !!sel?.correct;
  const fromGame = review.get('summary');
  const fall = newsCase.chart[newsCase.chart.length - 1];
  return (
    <>
      <StepBar step={done ? 3 : picked ? 2 : 1} />
      {fromGame && <div className="term"><b>방금 경기: {review.get('name')}</b><p>{fromGame}</p><p className="hint">{review.get('base') && `${n(Number(review.get('base')))}원 → ${n(Number(review.get('close')))}원`} · {review.get('reason')}</p><p className="hint">아래 사례로 이런 변동을 읽는 법을 연습해 보세요.</p></div>}
      <div className="compare-box">
        <div className={picked && !done ? 'glow' : ''}><small>시장 기대</small><b>1만 대</b></div>
        <span aria-hidden="true">→</span>
        <div className={picked && !done ? 'glow' : ''}><small>실제 계약</small><b>6천 대</b></div>
        <span aria-hidden="true">→</span>
        <div><small>{newsCase.company}</small><b className="down num">−4.60%</b></div>
      </div>
      <p className="q">{newsQuestion.prompt}</p>
      <div className="options">{newsQuestion.options.map(o => <button key={o.id} className={`opt ${picked === o.id ? (o.correct ? 'right' : 'bad') : ''}`} disabled={done} onClick={() => setPicked(o.id)}>{o.label}</button>)}</div>
      {sel && <p className={sel.correct ? 'correct' : 'error'} role="status">{sel.feedback}</p>}
      {done && <div className="answer">
        <p>{newsQuestion.takeaway}</p>
        <table className="rank-table"><thead><tr><th>항목</th><th>시장 기대</th><th>실제 결과</th></tr></thead><tbody><tr><td>계약 수량</td><td className="num">10,000대</td><td className="num">6,000대</td></tr></tbody></table>
        <h2 className="h">그래프의 하락 지점을 눌러 보세요</h2>
        <NewsChart open={open} onOpen={() => setOpen(true)} />
        {open && <div className="breakdown">
          <p className="bd-title">{fall.headline}</p>
          <dl className="kv"><dt>이전가</dt><dd className="num">{won(fall.base!)}</dd><dt>종료가</dt><dd className="num">{won(fall.close)}</dd><dt>실제 등락률</dt><dd className="num down">▼ −4.60%</dd></dl>
          <ul className="bd-list">{newsCase.breakdown.map(b => <li key={b.name}><span><b>{b.name}</b><small>{b.reason}</small></span><span className={`num ${dir(b.bp)}`}>{bpText(b.bp)}</span></li>)}
            <li className="bd-sum"><span>합계</span><span className="num down">{bpText(newsCase.breakdown.reduce((a, b) => a + b.bp, 0))}</span></li></ul>
        </div>}
        <NextLesson id="news" />
      </div>}
    </>
  );
}

/* ---------- 수업 4~6 공통: 예시를 보고 하나 고르기 ---------- */
function ChoiceLesson({ id, q, example, answer }: { id: string; q: ChoiceQuestion; example: ReactNode; answer: ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  const sel = q.options.find(o => o.id === picked);
  const done = !!sel?.correct;
  return (
    <>
      <StepBar step={done ? 3 : picked ? 2 : 1} />
      {example}
      <p className="q">{q.prompt}</p>
      <div className="options">{q.options.map(o => <button key={o.id} className={`opt ${picked === o.id ? (o.correct ? 'right' : 'bad') : ''}`} disabled={done} onClick={() => setPicked(o.id)}>{o.label}</button>)}</div>
      {sel && <p className={sel.correct ? 'correct' : 'error'} role="status">{sel.feedback}</p>}
      {done && <div className="answer">
        {answer}
        <p>{q.takeaway}</p>
        <NextLesson id={id} />
      </div>}
    </>
  );
}

/* ---------- 수업 4 ---------- */
function OrdersLesson() {
  const r = marketBuy(orderBook.asks, orderBook.buyQty);
  const best = Math.min(...orderBook.asks.map(a => a.price));
  const maxQty = Math.max(...[...orderBook.asks, ...orderBook.bids].map(x => x.qty));
  const bar = (q: number) => ({ width: `${Math.round(q / maxQty * 100)}%` });
  return <ChoiceLesson id="orders" q={orderQuestion}
    example={<>
      <p className="lede"><TermLink id="order-book">호가</TermLink>창은 지금 걸려 있는 주문입니다. 위(파랑)는 팔려는 주문, 아래(빨강)는 사려는 주문이에요. <TermLink id="market-order">시장가 주문</TermLink>은 가격을 정하지 않고 지금 있는 주문과 바로 <TermLink id="execution">체결</TermLink>합니다.</p>
      <table className="book" aria-label={`${orderBook.company} 가상 호가창`}>
        <thead><tr><th>팔려는 수량</th><th>가격</th><th>사려는 수량</th></tr></thead>
        <tbody>
          {orderBook.asks.map(a => <tr key={a.price} className="ask"><td><i style={bar(a.qty)} />{n(a.qty)}</td><td className="num">{n(a.price)}</td><td /></tr>)}
          {orderBook.bids.map(b => <tr key={b.price} className="bid"><td /><td className="num">{n(b.price)}</td><td><i style={bar(b.qty)} />{n(b.qty)}</td></tr>)}
        </tbody>
      </table>
      <p className="hint">가상 예시입니다. 가격 한 칸은 10원으로 두었습니다.</p>
    </>}
    answer={<>
      <table className="rank-table"><thead><tr><th>체결 가격</th><th>수량</th><th>금액</th></tr></thead>
        <tbody>{r.fills.map(f => <tr key={f.price}><td className="num">{n(f.price)}원</td><td className="num">{n(f.qty)}주</td><td className="num">{n(f.price * f.qty)}원</td></tr>)}
          <tr><td><b>평균 {n(r.avg)}원</b></td><td className="num">{n(r.filled)}주</td><td className="num">{n(r.total)}원</td></tr></tbody></table>
      <p className="hint">가장 싼 호가 {n(best)}원으로 샀다면 {n(best * r.filled)}원. 차이 {n(r.total - best * r.filled)}원이 <TermLink id="slippage">슬리피지</TermLink>입니다. 여기에 <TermLink id="fee">수수료</TermLink>가 따로 붙습니다.</p>
      <p className="hint">이 게임에는 호가창이 없습니다. 대신 주문 금액이 200만 원을 넘으면 정해진 표대로 슬리피지가 붙습니다.</p>
    </>} />;
}

/* ---------- 수업 5 ---------- */
function EarningsLesson() {
  const cs = earningsCase.companies;
  return <ChoiceLesson id="earnings" q={earningsQuestion}
    example={<>
      <p className="lede">매출은 판 돈 전체, <TermLink id="operating-profit">영업이익</TermLink>은 그중 본업으로 남긴 돈입니다. 두 가상 회사의 지난해 실적을 보세요.</p>
      <table className="rank-table"><thead><tr><th>회사</th><th>매출</th><th>영업이익</th></tr></thead>
        <tbody>{cs.map(c => <tr key={c.name}><td>{c.name}</td><td className="num">{n(c.revenue)}억 원</td><td className="num">{n(c.operatingProfit)}억 원</td></tr>)}</tbody></table>
    </>}
    answer={<table className="rank-table"><thead><tr><th>회사</th><th>계산</th><th>영업이익률</th></tr></thead>
      <tbody>{cs.map(c => <tr key={c.name}><td>{c.name}</td><td className="num">{c.operatingProfit} ÷ {c.revenue}</td><td className="num"><b>{operatingMargin(c).toFixed(0)}%</b></td></tr>)}</tbody></table>} />;
}

/* ---------- 수업 6 ---------- */
function RiskLesson() {
  const r = riskSummary(riskCase);
  return <ChoiceLesson id="risk" q={riskQuestion}
    example={<>
      <p className="lede">가상 계좌입니다. <TermLink id="portfolio-value">평가액</TermLink>은 현금 + 보유 주식 × 현재가, <TermLink id="unrealized-pnl">평가손익</TermLink>은 (현재가 − <TermLink id="avg-cost">평균 단가</TermLink>) × 수량입니다.</p>
      <table className="rank-table"><thead><tr><th>종목(업종)</th><th>평가금액</th><th>평가손익</th></tr></thead>
        <tbody>{r.rows.map(h => <tr key={h.name}><td>{h.name}<br /><small className="hint">{h.sector} · {n(h.qty)}주 · 평균 {n(h.avgCost)} → {n(h.price)}</small></td><td className="num">{n(h.value)}원</td><td className={`num ${dir(h.pnl)}`}>{signedWon(h.pnl)}</td></tr>)}
          <tr><td>현금</td><td className="num">{n(riskCase.cash)}원</td><td /></tr>
          <tr><td><b>합계</b></td><td className="num"><b>{n(r.total)}원</b></td><td className={`num ${dir(r.pnl)}`}><b>{signedWon(r.pnl)}</b></td></tr></tbody></table>
    </>}
    answer={<div className="sector-bars">{r.sectors.map(sc => <div key={sc.sector} className="bar-row"><span>{sc.sector}</span><i style={{ width: `${sc.pct.toFixed(0)}%` }} /><b className="num">{sc.pct.toFixed(0)}%</b></div>)}
      <p className="hint">나머지는 현금입니다. 관련 용어: <TermLink id="co-movement">동조화</TermLink>, <TermLink id="diversification">분산 투자</TermLink>, <TermLink id="concentration">집중 투자</TermLink></p></div>} />;
}
