/* 소리와 숫자 연출.
   - 효과음은 파일 없이 브라우저의 WebAudio로 짧게 합성합니다(저작권·용량 걱정 없음).
   - 브라우저는 사용자가 한 번 누르기 전에는 소리를 막으므로, 첫 클릭 때 오디오를 엽니다.
   - 소리 켜고 끄기는 이 기기에만 저장합니다. 움직임 줄이기 설정이면 숫자 애니메이션을 건너뜁니다.
   계산 함수(countValue, revealTone)는 React와 브라우저 없이 tests/fx.test.ts에서 검사합니다. */
import { useEffect, useRef, useState } from 'react';

export type Tone = 'tick' | 'book' | 'up' | 'down' | 'flat' | 'stamp' | 'win';

/** 0~1 진행도에서 보여 줄 숫자. 끝으로 갈수록 천천히(ease-out) 다가가고, 끝에서는 정확히 목표값입니다. */
export function countValue(from: number, to: number, t: number): number {
  if (t >= 1) return to;
  if (t <= 0) return from;
  const e = 1 - Math.pow(1 - t, 3);
  return Math.round(from + (to - from) * e);
}
/** 라운드 결과 공개 때 낼 소리. 평가액이 늘면 올라가는 소리, 줄면 내려가는 소리 */
export function revealTone(delta: number): Tone {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
}

/* ---------- 효과음 ---------- */
const SOUND_KEY = 'tteoksang:sound';
let ctx: AudioContext | null = null;
let enabled = (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } })();
const listeners = new Set<(on: boolean) => void>();

export function soundOn() { return enabled; }
export function setSound(on: boolean) {
  enabled = on;
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* 저장 불가 환경 */ }
  listeners.forEach(f => f(on));
  if (on) play('book');
}
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => { listeners.add(setOn); return () => { listeners.delete(setOn); }; }, []);
  return [on, setSound];
}
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) { try { ctx = new AC(); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
/* 첫 터치·클릭 때 오디오를 열어 둡니다(브라우저 자동 재생 정책). */
if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
}
function note(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ac.destination);
  o.start(start); o.stop(start + dur + 0.02);
}
/** 짧은 효과음을 냅니다. 소리를 껐거나 오디오를 못 쓰는 환경이면 아무것도 하지 않습니다. */
export function play(tone: Tone) {
  if (!enabled) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime;
  const seq: Record<Tone, [number, number, number, OscillatorType, number][]> = {
    tick:  [[880, 0, 0.05, 'sine', 0.05]],
    book:  [[660, 0, 0.08, 'triangle', 0.12], [990, 0.07, 0.1, 'triangle', 0.1]],
    up:    [[523, 0, 0.12, 'triangle', 0.12], [659, 0.1, 0.12, 'triangle', 0.12], [784, 0.2, 0.22, 'triangle', 0.12]],
    down:  [[523, 0, 0.14, 'triangle', 0.1], [415, 0.12, 0.14, 'triangle', 0.1], [330, 0.24, 0.26, 'triangle', 0.1]],
    flat:  [[587, 0, 0.12, 'sine', 0.08]],
    stamp: [[110, 0, 0.18, 'square', 0.12], [70, 0.02, 0.2, 'sine', 0.2]],
    win:   [[523, 0, 0.14, 'triangle', 0.12], [659, 0.12, 0.14, 'triangle', 0.12], [784, 0.24, 0.14, 'triangle', 0.12], [1047, 0.36, 0.4, 'triangle', 0.14]]
  };
  for (const [f, at, d, type, g] of seq[tone]) note(ac, f, t + at, d, type, g);
}

/* ---------- 숫자 카운트업 ---------- */
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** target이 바뀌면 이전 값에서 target까지 ms 동안 숫자를 굴립니다. 처음 그릴 때는 from에서 시작합니다. */
export function useCountUp(target: number, ms = 800, from = 0): number {
  const [shown, setShown] = useState(reduced() ? target : from);
  const prev = useRef(reduced() ? target : from);
  useEffect(() => {
    if (reduced()) { setShown(target); prev.current = target; return; }
    const start = performance.now(), a = prev.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(countValue(a, target, t));
      if (t < 1) raf = requestAnimationFrame(step); else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); prev.current = target; };
  }, [target, ms]);
  return shown;
}
