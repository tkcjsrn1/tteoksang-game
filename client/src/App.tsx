import { useEffect, useState } from 'react';
import { Display } from './Display';
import { Game } from './Game';
import { Home } from './Home';
import { Lessons } from './lessons/Lessons';

/* Capacitor WebView에서도 그대로 쓰도록 해시 주소로 화면을 나눕니다. */
export function navigate(hash: string) { location.hash = hash; }
function parse() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: new URLSearchParams(query ?? '') };
}
export function App() {
  const [route, setRoute] = useState(parse());
  useEffect(() => { const f = () => { setRoute(parse()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const { parts, query } = route;
  if (parts[0] === 'room' && /^\d{6}$/.test(parts[1] ?? '')) return <Game key={parts[1]} code={parts[1]} />;
  if (parts[0] === 'display' && /^\d{6}$/.test(parts[1] ?? '')) return <Display key={parts[1]} code={parts[1]} />;
  if (parts[0] === 'lessons') return <Lessons lessonId={parts[1] ?? null} review={query} />;
  return <Home />;
}
