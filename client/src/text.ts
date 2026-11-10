/* 글자 크기(보통·크게). 고른 값은 이 기기에만 저장합니다. */
import { useEffect, useState } from 'react';

export type TextSize = 'normal' | 'large';
const KEY = 'tteoksang:text';
const listeners = new Set<(v: TextSize) => void>();
let current: TextSize = 'normal';

export function parseTextSize(saved: string | null): TextSize {
  return saved === 'large' ? 'large' : 'normal';
}
function apply(v: TextSize) {
  current = v;
  if (typeof document === 'undefined') return;
  if (v === 'large') document.documentElement.dataset.text = 'large';
  else delete document.documentElement.dataset.text;
}
/** 첫 화면을 그리기 전에 한 번 부릅니다. */
export function initTextSize() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* 저장소를 못 쓰면 보통 크기 */ }
  apply(parseTextSize(saved));
}
export function setTextSize(v: TextSize) {
  apply(v);
  try { localStorage.setItem(KEY, v); } catch { /* 저장 못 해도 이번 접속에는 적용됩니다 */ }
  listeners.forEach(f => f(v));
}
export function useTextSize(): [TextSize, (v: TextSize) => void] {
  const [v, setV] = useState<TextSize>(current);
  useEffect(() => { listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return [v, setTextSize];
}
