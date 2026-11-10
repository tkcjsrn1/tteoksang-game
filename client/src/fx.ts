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
const MUSIC_KEY = 'tteoksang:music';
const VOLUME_KEY = 'tteoksang:volume';
function readAudioSetting(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveAudioSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* 저장 불가 환경 */ }
}
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = readAudioSetting(SOUND_KEY) !== 'off';
let musicEnabled = readAudioSetting(MUSIC_KEY) === 'on';
const savedVolume = Number(readAudioSetting(VOLUME_KEY) ?? '100');
let volume = Number.isInteger(savedVolume) && savedVolume >= 0 && savedVolume <= 100 ? savedVolume : 100;
const listeners = new Set<(on: boolean) => void>();

export function soundOn() { return enabled; }
export function setSound(on: boolean) {
  enabled = on;
  saveAudioSetting(SOUND_KEY, on ? 'on' : 'off');
  listeners.forEach(f => f(on));
  if (on) play('book');
}
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => { listeners.add(setOn); return () => { listeners.delete(setOn); }; }, []);
  return [on, setSound];
}
export const musicOn = () => musicEnabled;
export function setMusic(on: boolean) {
  musicEnabled = on;
  saveAudioSetting(MUSIC_KEY, on ? 'on' : 'off');
  syncMusic();
}
export const masterVolume = () => volume;
export function setMasterVolume(value: number) {
  volume = value;
  saveAudioSetting(VOLUME_KEY, String(value));
  if (master && ctx) master.gain.setTargetAtTime(value / 100, ctx.currentTime, 0.02);
}
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      const next = new AC();
      master = next.createGain();
      master.gain.value = volume / 100;
      master.connect(next.destination);
      ctx = next;
    } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}
/* 첫 터치·클릭 때 오디오를 열어 둡니다(브라우저 자동 재생 정책). */
if (typeof window !== 'undefined') {
  window.addEventListener('click', () => { audio(); syncMusic(); }, { once: true });
  document.addEventListener('visibilitychange', syncMusic);
}
function note(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number, output: AudioNode) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(output);
  o.start(start); o.stop(start + dur + 0.02);
}
/* 느린 배경음을 짧은 화음 네 개로 반복합니다. 탭을 숨기거나 끄면 바로 멈춥니다. */
const MUSIC_CHORDS = [
  [130.81, 196, 261.63, 329.63],
  [110, 164.81, 261.63, 329.63],
  [87.31, 130.81, 220, 261.63],
  [98, 146.83, 246.94, 293.66]
];
let musicBus: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
function syncMusic() {
  if (typeof document === 'undefined') return;
  if (!musicEnabled || document.hidden) {
    if (musicTimer !== null) clearInterval(musicTimer);
    musicTimer = null;
    musicBus?.disconnect();
    musicBus = null;
    return;
  }
  const ac = audio();
  if (!ac) return;
  const start = () => {
    if (!master || !musicEnabled || document.hidden || musicTimer !== null || ac.state !== 'running') return;
    const bus = ac.createGain();
    bus.connect(master);
    musicBus = bus;
    let bar = 0;
    const queue = () => {
      if (ac.state !== 'running') return;
      const startAt = ac.currentTime + 0.02;
      MUSIC_CHORDS[bar++ % MUSIC_CHORDS.length].forEach((freq, i) => {
        note(ac, freq, startAt + i * 0.34, 1.35, 'sine', i === 0 ? 0.035 : 0.026, bus);
      });
    };
    queue();
    musicTimer = setInterval(queue, 2200);
  };
  if (ac.state === 'running') start();
  else void ac.resume().then(start).catch(() => {});
}

/** 짧은 효과음을 냅니다. 소리를 껐거나 오디오를 못 쓰는 환경이면 아무것도 하지 않습니다. */
export function play(tone: Tone) {
  if (!enabled || volume === 0) return;
  const ac = audio();
  if (!ac || !master || ac.state !== 'running') return;
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
  for (const [f, at, d, type, g] of seq[tone]) note(ac, f, t + at, d, type, g, master);
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

/* ---------- 봉 재생(연출) ----------
   결과가 정해진 뒤 봉이 시가에서 출발해 꼬리를 그리고 종가에 닿는 모습을 보여 줍니다. 실제 라운드 안 가격은 계산하지 않으므로 연출입니다.
   오른 봉은 시가 → 저가 → 고가 → 종가, 내린 봉은 시가 → 고가 → 저가 → 종가 순서로 움직입니다. */
export function replayPath(open: number, high: number, low: number, close: number): number[] {
  return close >= open ? [open, low, high, close] : [open, high, low, close];
}
/** 진행률 t(0~1)에서의 현재가와 지금까지 지난 최고·최저가. 구간 길이는 가격 차이에 비례합니다. 가격은 10원 단위로 맞춥니다. */
export function replayAt(path: number[], t: number): { price: number; high: number; low: number } {
  const segs = path.slice(1).map((p, i) => Math.abs(p - path[i]));
  const total = segs.reduce((a, b) => a + b, 0);
  const tt = Math.min(1, Math.max(0, t));
  let price = path[path.length - 1];
  let hi = Math.max(path[0]), lo = Math.min(path[0]);
  if (total === 0) return { price: path[0], high: path[0], low: path[0] };
  let left = tt * total;
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(1, left / segs[i]) : 1;
      const raw = path[i] + (path[i + 1] - path[i]) * f;
      price = tt >= 1 ? path[path.length - 1] : Math.round(raw / 10) * 10;
      hi = Math.max(hi, price); lo = Math.min(lo, price);
      break;
    }
    hi = Math.max(hi, path[i + 1]); lo = Math.min(lo, path[i + 1]);
    left -= segs[i];
  }
  return { price, high: hi, low: lo };
}
/** 마운트되면 ms 동안 0→1로 진행률을 올립니다. 움직임 줄이기 설정이면 바로 1입니다. replay()로 다시 재생합니다. */
export function useReplay(ms = 2400): { t: number; replay: () => void } {
  const [t, setT] = useState(reduced() ? 1 : 0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (reduced()) { setT(1); return; }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => { const v = Math.min(1, (now - start) / ms); setT(v); if (v < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, ms]);
  return { t, replay: () => setRun(r => r + 1) };
}

/** 실제 시세 목록을 진행률 t로 재생합니다. 지나온 최고·최저가도 함께 돌려줍니다. */
export function replayTicks(ticks: number[], t: number): { price: number; high: number; low: number } {
  const tt = Math.min(1, Math.max(0, t));
  const i = Math.min(ticks.length - 1, Math.floor(tt * (ticks.length - 1) + 1e-9));
  const seen = ticks.slice(0, i + 1);
  return { price: ticks[i], high: Math.max(...seen), low: Math.min(...seen) };
}
