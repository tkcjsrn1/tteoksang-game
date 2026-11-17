/* 소리와 숫자 연출.
   - 효과음은 파일 없이 브라우저의 WebAudio로 짧게 합성합니다(저작권·용량 걱정 없음).
   - 브라우저는 사용자가 한 번 누르기 전에는 소리를 막으므로, 첫 클릭 때 오디오를 엽니다.
   - 배경음도 WebAudio로 만듭니다(장중에만, 마감 10초 전부터 빨라짐). 진동은 지원하는 휴대폰에서만 울립니다.
   - 화면이 꺼지거나 앱이 뒤로 가면 오디오를 재워서 효과음·배경음 모두 나지 않게 합니다.
   - 소리·배경음·진동 켜고 끄기는 이 기기에만 저장합니다. 움직임 줄이기 설정이면 숫자 애니메이션을 건너뜁니다.
   계산 함수(countValue, revealTone, fillTone, musicStep, musicBpm)는 React와 브라우저 없이 tests/fx.test.ts에서 검사합니다. */
import { useEffect, useRef, useState } from 'react';

export type Tone = 'tick' | 'book' | 'up' | 'down' | 'flat' | 'stamp' | 'win' | 'open' | 'close' | 'news' | 'buy' | 'sell' | 'trigger';

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
/** 체결 소리: 매수는 올라가는 두 음, 매도는 내려가는 두 음, 손절·익절 자동 매도는 경고음 */
export function fillTone(side: 'buy' | 'sell', trigger?: 'stop' | 'take' | null): Tone {
  return trigger ? 'trigger' : side === 'buy' ? 'buy' : 'sell';
}

/* ---------- 효과음 ---------- */
const SOUND_KEY = 'tteoksang:sound';
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
const savedVolume = Number(readAudioSetting(VOLUME_KEY) ?? '100');
let volume = Number.isInteger(savedVolume) && savedVolume >= 0 && savedVolume <= 100 ? savedVolume : 100;
const listeners = new Set<(on: boolean) => void>();

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
export const masterVolume = () => volume;
export function setMasterVolume(value: number) {
  volume = value;
  saveAudioSetting(VOLUME_KEY, String(value));
  if (master && ctx) master.gain.setTargetAtTime(value / 100, ctx.currentTime, 0.02);
}
/** 화면이 지금 안 보이는지(화면 꺼짐, 홈 화면, 다른 탭) */
const pageHidden = () => typeof document !== 'undefined' && document.hidden;
/** 효과음을 낼지. 소리를 껐거나, 음량이 0이거나, 화면이 안 보이면 내지 않습니다 */
export function soundAllowed(on: boolean, vol: number, hidden: boolean): boolean {
  return on && vol > 0 && !hidden;
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
  if (ctx.state === 'suspended' && !pageHidden()) void ctx.resume().catch(() => {});
  return ctx;
}
/* 화면이 숨겨지면 오디오 자체를 재웁니다. 이미 예약된 음(배경음 꼬리 등)도 함께 멈춥니다.
   예전에는 배경음만 멈춰서, 서버가 계속 진행하는 동안 종·속보·결과 효과음이 화면 밖에서 울렸습니다. */
function onVisibility() {
  if (pageHidden()) { if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {}); }
  else if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  syncMusic();
}
/* 첫 터치·클릭 때 오디오를 열어 둡니다(브라우저 자동 재생 정책). */
if (typeof window !== 'undefined') {
  window.addEventListener('click', () => { audio(); syncMusic(); }, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  /* 안드로이드 앱(Capacitor)이 뒤로 갈 때 보내는 pause·resume 이벤트도 같이 받습니다 */
  document.addEventListener('pause', onVisibility);
  document.addEventListener('resume', onVisibility);
}
function note(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number, output: AudioNode) {
  if (dur <= 0 || gain <= 0) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(output);
  o.start(start); o.stop(start + dur + 0.02);
}
/** 짧은 효과음을 냅니다. 소리를 껐거나 오디오를 못 쓰는 환경이면 아무것도 하지 않습니다. */
export function play(tone: Tone) {
  if (!soundAllowed(enabled, volume, pageHidden())) return;
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
    win:   [[523, 0, 0.14, 'triangle', 0.12], [659, 0.12, 0.14, 'triangle', 0.12], [784, 0.24, 0.14, 'triangle', 0.12], [1047, 0.36, 0.4, 'triangle', 0.14]],
    /* 장 시작 종: 맑은 종소리 두 번. 종은 기본음에 높은 배음을 얹어 만듭니다 */
    open:  [[1175, 0, 0.9, 'sine', 0.12], [2350, 0, 0.5, 'sine', 0.04], [1175, 0.32, 1.1, 'sine', 0.12], [2350, 0.32, 0.6, 'sine', 0.04]],
    /* 장 마감 종: 낮은 종소리 세 번 */
    close: [[784, 0, 0.7, 'sine', 0.12], [1568, 0, 0.35, 'sine', 0.04], [784, 0.28, 0.7, 'sine', 0.12], [1568, 0.28, 0.35, 'sine', 0.04], [784, 0.56, 1.2, 'sine', 0.12], [1568, 0.56, 0.5, 'sine', 0.04]],
    /* 속보: 짧게 두 번 */
    news:  [[988, 0, 0.09, 'square', 0.06], [988, 0.14, 0.09, 'square', 0.06], [1319, 0.28, 0.2, 'square', 0.06]],
    buy:   [[587, 0, 0.08, 'triangle', 0.13], [880, 0.07, 0.14, 'triangle', 0.13]],
    sell:  [[880, 0, 0.08, 'triangle', 0.13], [587, 0.07, 0.14, 'triangle', 0.13]],
    trigger: [[740, 0, 0.1, 'sawtooth', 0.07], [554, 0.12, 0.1, 'sawtooth', 0.07], [740, 0.24, 0.1, 'sawtooth', 0.07], [554, 0.36, 0.22, 'sawtooth', 0.07]]
  };
  for (const [f, at, d, type, g] of seq[tone]) note(ac, f, t + at, d, type, g, master);
}

/* ---------- 진동 ---------- */
const HAPTIC_KEY = 'tteoksang:haptic';
let hapticOn = (() => { try { return localStorage.getItem(HAPTIC_KEY) !== 'off'; } catch { return true; } })();
const hapticListeners = new Set<(on: boolean) => void>();
export type Buzz = 'fill' | 'trigger' | 'news' | 'bell';
/** 진동 길이(ms). 배열이면 진동·쉼·진동 순서입니다 */
export const BUZZ: Record<Buzz, number | number[]> = { fill: 25, trigger: [70, 50, 70], news: [30, 40, 30], bell: 40 };
export function buzz(kind: Buzz) {
  /* 화면이 안 보일 때는 진동도 하지 않습니다(효과음과 같은 이유) */
  if (!hapticOn || pageHidden() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(BUZZ[kind]); } catch { /* 막혀 있으면 넘어갑니다 */ }
}
export function setHaptic(on: boolean) {
  hapticOn = on;
  try { localStorage.setItem(HAPTIC_KEY, on ? 'on' : 'off'); } catch { /* 저장 불가 환경 */ }
  hapticListeners.forEach(f => f(on));
  if (on) buzz('fill');
}
export function useHapticSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(hapticOn);
  useEffect(() => { hapticListeners.add(setOn); return () => { hapticListeners.delete(setOn); }; }, []);
  return [on, setHaptic];
}

/* ---------- 배경음 ----------
   네 마디(가단조 → 바장조 → 다장조 → 사장조)를 여덟 박씩 도는 조용한 분산화음입니다. 파일 없이 그때그때 만듭니다. */
const MUSIC_KEY = 'tteoksang:music';
let musicOn = readAudioSetting(MUSIC_KEY) !== 'off';
const musicListeners = new Set<(on: boolean) => void>();
const CHORDS: number[][] = [
  [220.00, 261.63, 329.63, 392.00],   // Am7
  [174.61, 220.00, 261.63, 329.63],   // Fmaj7
  [130.81, 196.00, 261.63, 329.63],   // C
  [196.00, 246.94, 293.66, 392.00]    // G
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
export const MUSIC_STEPS = CHORDS.length * ARP.length;
/** i번째 박에 낼 음(Hz). bass는 마디 첫 박에만 깔리는 낮은 음입니다 */
export function musicStep(i: number): { freq: number; bass: number | null } {
  const k = ((i % MUSIC_STEPS) + MUSIC_STEPS) % MUSIC_STEPS;
  const chord = CHORDS[Math.floor(k / ARP.length)], beat = k % ARP.length;
  return { freq: chord[ARP[beat]] * 2, bass: beat === 0 ? chord[0] / 2 : null };
}
/** 박자 빠르기. 평소 84, 마감이 가까우면(urgent) 132 */
export const musicBpm = (urgent: boolean) => urgent ? 132 : 84;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicNext = 0, musicI = 0, musicUrgent = false, musicWanted = false;
function musicTick() {
  const ac = audio();
  if (!ac || !master || ac.state !== 'running') return;
  if (musicNext < ac.currentTime) musicNext = ac.currentTime + 0.05;
  /* 0.3초 앞까지만 미리 예약해서, 빠르기를 바꾸면 곧바로 반영되게 합니다 */
  while (musicNext < ac.currentTime + 0.3) {
    const beat = 60 / musicBpm(musicUrgent) / 2;
    const { freq, bass } = musicStep(musicI++);
    note(ac, freq, musicNext, beat * 1.8, 'sine', 0.028, master);
    if (bass) note(ac, bass, musicNext, beat * 7, 'triangle', 0.04, master);
    if (musicUrgent && musicI % 2 === 0) note(ac, freq * 2, musicNext, beat * 0.6, 'sine', 0.012, master);
    musicNext += beat;
  }
}
function syncMusic() {
  /* 장중일 때만, 효과음과 배경음이 모두 켜져 있고, 탭이 보일 때만 소리를 냅니다. */
  const should = musicWanted && musicOn && enabled && typeof document !== 'undefined' && !document.hidden;
  if (should && !musicTimer) { musicNext = 0; musicTimer = setInterval(musicTick, 100); musicTick(); }
  if (!should && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
/** 장중에 켜고, 그 밖에는 끕니다. urgent면 박자가 빨라집니다. 효과음을 끄면 배경음도 함께 멈춥니다. */
export function setMusicScene(playing: boolean, urgent = false) { musicWanted = playing; musicUrgent = urgent; syncMusic(); }
export function setMusic(on: boolean) {
  musicOn = on;
  saveAudioSetting(MUSIC_KEY, on ? 'on' : 'off');
  musicListeners.forEach(f => f(on));
  syncMusic();
}
export function useMusicSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(musicOn);
  useEffect(() => { musicListeners.add(setOn); return () => { musicListeners.delete(setOn); }; }, []);
  return [on, setMusic];
}
listeners.add(() => syncMusic());

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
