/* 밝은·어두운 테마. 고른 값은 이 기기에 저장하고, 고른 적이 없으면 기기 설정을 따릅니다. */
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'tteoksang:theme';   /* 예전 판에서 쓰던 'theme' 키도 읽어 줍니다 */
const listeners = new Set<(t: Theme) => void>();

export function parseTheme(saved: string | null, systemDark: boolean): Theme {
  return saved === 'dark' || saved === 'light' ? saved : systemDark ? 'dark' : 'light';
}
function read(): Theme {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY) ?? localStorage.getItem('theme'); } catch { /* 저장소를 못 쓰면 기기 설정을 따릅니다 */ }
  const systemDark = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return parseTheme(saved, systemDark);
}
let current: Theme = 'light';
function apply(t: Theme) {
  current = t;
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#17191E' : '#FFFFFF');
}
/** 첫 화면을 그리기 전에 한 번 부릅니다. */
export function initTheme() { apply(read()); }
export function setTheme(t: Theme) {
  apply(t);
  try { localStorage.setItem(KEY, t); } catch { /* 저장 못 해도 이번 접속에는 적용됩니다 */ }
  listeners.forEach(f => f(t));
}
export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(current);
  useEffect(() => { listeners.add(setT); return () => { listeners.delete(setT); }; }, []);
  return [t, setTheme];
}
