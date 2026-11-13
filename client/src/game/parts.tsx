/* 여러 화면이 함께 쓰는 조각: 탭 아이콘, 업종 묶음 목록, 종목 한 줄, 바닥에서 올라오는 창, 연습실 링크.
   Game.tsx가 너무 길어져서 화면 단위로 나눴습니다(2026-11). 옮기기만 했고 동작은 그대로입니다. */
import { useState } from 'react';
import type { ClientMsg, OrderKind, RoomView, Side, StockCode, StockView } from '../../../shared/types';
import { GROUPS, stockOf } from '../../../shared/rules';
import type { StockGroup } from '../../../shared/rules';
import { groupStocks } from '../sectors';
import type { OrderOutcome } from '../net';
import type { CoachStep } from '../coach';
import { intradayBp } from '../live';
export type Tab = 'market' | 'assets' | 'news';
export interface PlayProps { view: RoomView; offset: number; online: boolean; send: (m: ClientMsg) => void; placeOrder: (c: StockCode, s: Side, q: number, kind?: OrderKind, limit?: number) => Promise<OrderOutcome>; cancelOrder: (c: StockCode) => Promise<OrderOutcome>; setStop: (c: StockCode, stop: number | null, take: number | null) => Promise<OrderOutcome> }
import { arrow, dir, pctBp, StockAvatar, won } from '../ui';

export const icon = (d: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const TAB_ICON: Record<Tab, React.ReactNode> = {
  market: icon(<><path d="M3 17l5-5 4 4 8-8" /><path d="M14 8h6v6" /></>),
  assets: icon(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></>),
  news: icon(<><path d="M5 4h11l3 3v13H5z" /><path d="M8 10h8M8 14h8" /></>)
};

/** 첫 판 따라 하기 안내. 단계 판단은 coach.ts에 있습니다. */

export function SectorBoard({ stocks, defaultOpen, pinned, renderRow, summary, live = false }: {
  stocks: StockView[]; defaultOpen: Set<StockGroup>; pinned: StockCode[]; live?: boolean;
  renderRow: (s: StockView) => React.ReactNode; summary?: (b: ReturnType<typeof groupStocks>[number]) => React.ReactNode;
}) {
  const [toggled, setToggled] = useState<Partial<Record<StockGroup, boolean>>>({});
  const blocks = groupStocks(stocks, live);
  const isOpen = (g: StockGroup) => pinned.some(c => stockOf(c).group === g) || (toggled[g] ?? defaultOpen.has(g));
  const allOpen = blocks.every(b => isOpen(b.group));
  return (
    <div className="sectors">
      {blocks.map(b => {
        const open = isOpen(b.group);
        const avg = b.avgChangeBp;
        return (
          <section key={b.group} className={`sector${open ? ' open' : ''}`}>
            <button className="sector-head" aria-expanded={open} onClick={() => setToggled(t => ({ ...t, [b.group]: !open }))}>
              <i className="sector-dot" style={{ background: b.color }} aria-hidden="true" />
              <b>{b.label}</b>
              <span className="sector-meta">{b.stocks.length}종목</span>
              <span className="sector-sum">{summary ? summary(b) : avg === null ? <small className="flat">—</small> : <small className={dir(avg)}>{live ? '오늘' : '평균'} {arrow(avg)} {pctBp(avg)}</small>}</span>
              <svg className={`chev sector-chev${open ? ' up' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && <div className="board">{b.stocks.map(renderRow)}</div>}
          </section>
        );
      })}
      <button className="link sector-all" onClick={() => setToggled(Object.fromEntries(blocks.map(b => [b.group, !allOpen])))}>{allOpen ? '모두 접기' : '모두 펼치기'}</button>
    </div>
  );
}
/** 내가 가진 종목을 시장 화면 맨 위에 모아 보여 줍니다. 눌러서 바로 팔 수 있습니다. */

export function StockRow({ s, view, onOpen, hint = false }: { s: StockView; view: RoomView; onOpen: () => void; hint?: boolean }) {
  const held = view.portfolio?.holdings.find(h => h.code === s.code);
  const ord = view.portfolio?.orders.find(o => o.code === s.code);
  const trading = view.phase === 'trade' && !!s.ticks;
  const ch = trading ? intradayBp(s) : s.lastChangeBp;
  const live = view.phase === 'news' || view.phase === 'trade';
  const targets = live ? view.news[view.news.length - 1]?.cards.map(c => c.card.targets[0]) ?? [] : [];
  const inNews = targets.includes(s.code);
  /* 대장주에 뉴스가 났으면 같은 업종 종목도 함께 움직일 수 있다고 알려 줍니다. */
  const peerNews = !inNews && targets.includes(GROUPS[stockOf(s.code).group].leader);
  const sub = [s.sector, inNews ? '이번 뉴스' : '', peerNews ? '같은 업종 뉴스' : '', held ? `${held.qty.toLocaleString('ko-KR')}주 보유` : '', ord ? `${ord.side === 'buy' ? '매수' : '매도'} ${ord.qty.toLocaleString('ko-KR')}주 ${won(ord.price)} 예약` : ''].filter(Boolean).join(' · ');
  return (
    <button className={`row${inNews ? ' is-news' : ''}${hint ? ' hint-pulse' : ''}`} onClick={onOpen}>
      <StockAvatar code={s.code} name={s.name} />
      <span className="row-main"><b>{s.name}</b><small>{sub}</small></span>
      <span className="row-price"><b key={trading ? s.price : 'x'} className={`num${trading ? ' tick-flash' : ''}`}>{s.price.toLocaleString('ko-KR')}원</b>
        <small className={ch === null ? 'flat' : dir(ch)}>{ch === null ? '—' : `${arrow(ch)} ${pctBp(ch)}`}</small></span>
    </button>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-head"><h2>{title}</h2><button className="help-btn" aria-label="닫기" onClick={onClose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
        {children}
      </section>
    </div>
  );
}

export function lessonLink(view: RoomView, code?: StockCode) {
  const r = view.lastResult?.round ?? view.round;
  const s = code ?? view.stocks.slice().sort((a, b) => Math.abs(b.lastChangeBp ?? 0) - Math.abs(a.lastChangeBp ?? 0))[0].code;
  const stock = view.stocks.find(x => x.code === s)!;
  const b = stock.history.find(h => h.round === r);
  const q = new URLSearchParams({ name: stock.name, summary: b?.summary ?? '', base: String(b?.basePrice ?? ''), close: String(b?.closePrice ?? ''), reason: b?.events[0]?.reason ?? '시장·종목 변동' });
  return `/lessons/news?${q.toString()}`;
}
/** 라운드 결과: 내 변화 → 기대 vs 실제 → 왜 움직였나(막대) → 종목별 결과 */

/** 따라 하기 안내 말풍선 */
export function Coach({ step, onSkip }: { step: CoachStep; onSkip?: () => void }) {
  return (
    <section className="coach" aria-live="polite">
      <p className="coach-head"><span className="coach-dots" role="img" aria-label={`따라 하기 ${step.no}/${step.total}단계`}>{Array.from({ length: step.total }, (_, i) => <i key={i} className={i < step.no ? 'on' : ''} />)}</span>
        <b>{step.no}. {step.title}</b></p>
      <p>{step.text}</p>
      {onSkip && <button className="link" onClick={onSkip}>안내 끄기</button>}
    </section>
  );
}
