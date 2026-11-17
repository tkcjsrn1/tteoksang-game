/* 용어 사전을 어느 화면에서든 띄우는 장치.
   - <TermLink id>: 낱말 하나를 눌러 뜻을 봅니다.
   - <Rich text>: 글 속 용어를 자동으로 찾아 링크합니다(shared/glossary.ts의 linkTerms).
   - 열어 본 용어는 이 기기에만 기록해 사전 화면에서 진행도로 보여 줍니다. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSheetDrag } from '../sheetDrag';
import { categoryLabel, linkTerms, termById, TERMS } from '../../../shared/glossary';
import { navigate } from '../App';
import { store } from '../net';

interface Ctx { open: (id: string) => void; seen: Set<string> }
const GlossaryCtx = createContext<Ctx>({ open: () => {}, seen: new Set() });
export const useGlossary = () => useContext(GlossaryCtx);

const SEEN_KEY = 'terms-seen';
function loadSeen(): Set<string> {
  try { const v = JSON.parse(store.get(SEEN_KEY) ?? '[]'); return new Set(Array.isArray(v) ? v.filter(x => termById.has(x)) : []); } catch { return new Set(); }
}

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [seen, setSeen] = useState(loadSeen);
  const open = useCallback((id: string) => {
    if (!termById.has(id)) return;
    setCurrent(id);
    setSeen(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      store.set(SEEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);
  /* 다른 화면으로 넘어가면(뒤로 가기 포함) 열려 있던 설명 창을 닫습니다. */
  useEffect(() => {
    const close = () => setCurrent(null);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
  const value = useMemo(() => ({ open, seen }), [open, seen]);
  return (
    <GlossaryCtx.Provider value={value}>
      {children}
      {current && <TermSheet id={current} onOpen={open} onClose={() => setCurrent(null)} />}
    </GlossaryCtx.Provider>
  );
}

function TermSheet({ id, onOpen, onClose }: { id: string; onOpen: (id: string) => void; onClose: () => void }) {
  const t = termById.get(id)!;
  const { sheet, handle } = useSheetDrag(onClose);
  return (
    <div className="sheet-wrap top" onClick={onClose}>
      <section ref={sheet} className="sheet term-sheet" role="dialog" aria-label={`용어: ${t.term}`} onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" {...handle} />
        <div className="sheet-head" {...handle}>
          <h2>{t.term}</h2>
          <button className="ghost small" onClick={onClose}>닫기</button>
        </div>
        <p className="hint">{categoryLabel(t.category)}{t.en ? ` · ${t.en}` : ''}</p>
        <p className="term-short">{t.short}</p>
        <p>{t.body}</p>
        {t.game && <p className="term-game"><b>이 게임에서는</b> {t.game}</p>}
        {t.related.length > 0 && <>
          <p className="hint">함께 보면 좋은 용어</p>
          <div className="term-chips">{t.related.map(r => termById.get(r) && <button key={r} className="term-chip" onClick={() => onOpen(r)}>{termById.get(r)!.term}</button>)}</div>
        </>}
        <button className="link" onClick={() => { onClose(); navigate(`/glossary/${t.id}`); }}>용어 사전 전체 보기 ({TERMS.length}개)</button>
      </section>
    </div>
  );
}

/** 낱말 하나를 용어 링크로 만듭니다. children이 없으면 사전의 표제어를 씁니다. */
export function TermLink({ id, children }: { id: string; children?: ReactNode }) {
  const { open } = useGlossary();
  const t = termById.get(id);
  if (!t) return <>{children}</>;
  /* 읽어 주는 이름은 화면에 보이는 글자로 시작해야 음성 제어로 누를 수 있습니다 */
  const visible = typeof children === 'string' ? children : t.term;
  return (
    <button type="button" className="gl-term" aria-label={`${visible} 뜻 보기`}
      onClick={e => { e.stopPropagation(); open(id); }}>{children ?? t.term}</button>
  );
}

/** 글 속 용어를 자동으로 링크합니다. 버튼 안에서는 쓰지 마세요(버튼 안에 버튼이 들어갑니다). */
export function Rich({ text }: { text: string }) {
  const segs = useMemo(() => linkTerms(text), [text]);
  return <>{segs.map((s, i) => s.termId ? <TermLink key={i} id={s.termId}>{s.text}</TermLink> : <span key={i}>{s.text}</span>)}</>;
}
