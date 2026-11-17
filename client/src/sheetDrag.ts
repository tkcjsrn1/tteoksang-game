/* 아래에서 올라오는 창(시트)의 손잡이를 아래로 끌면 닫습니다.
   손잡이와 제목 줄에서만 끌 수 있고, 본문은 원래대로 스크롤됩니다. 닫기 버튼도 그대로 둡니다. */
import { useRef, type PointerEvent } from 'react';

/** 이만큼(px) 끌었거나 */
export const CLOSE_DISTANCE = 100;
/** 이 속도(px/ms)보다 빠르게 튕기듯 내리면 닫습니다 */
export const CLOSE_SPEED = 0.6;
/** 너무 짧은 움직임은 튕김으로 보지 않습니다(손떨림 방지) */
const MIN_FLICK = 24;

/** 끈 거리와 마지막 속도로 닫을지 정합니다. 화면 없이 시험하려고 따로 뺐습니다. */
export function shouldClose(dy: number, speed: number) {
  return dy >= CLOSE_DISTANCE || (dy >= MIN_FLICK && speed >= CLOSE_SPEED);
}

export function useSheetDrag(onClose: () => void) {
  const sheet = useRef<HTMLElement>(null);
  /* y0: 누른 위치, dy: 지금까지 내린 거리, y/t: 직전 위치와 시각(속도 계산용) */
  const drag = useRef<{ id: number; y0: number; dy: number; y: number; t: number; v: number } | null>(null);

  const set = (dy: number, animate: boolean) => {
    const el = sheet.current;
    if (!el) return;
    el.style.transition = animate ? 'transform .18s ease-out' : 'none';
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    /* 닫기·용어 버튼을 누른 것은 끌기로 보지 않습니다 */
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    drag.current = { id: e.pointerId, y0: e.clientY, dy: 0, y: e.clientY, t: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    set(0, false);
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (e.clientY - d.y) / dt;
    d.y = e.clientY; d.t = e.timeStamp;
    d.dy = Math.max(0, e.clientY - d.y0);   // 위로는 끌리지 않습니다
    set(d.dy, false);
  };
  const end = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!cancelled && shouldClose(d.dy, d.v)) {
      /* 화면 아래로 마저 내린 뒤 닫습니다. 움직임 줄이기 설정이면 바로 닫습니다. */
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || !sheet.current) { onClose(); return; }
      set(sheet.current.offsetHeight, true);
      setTimeout(onClose, 180);
      return;
    }
    set(0, true);   // 덜 끌었으면 제자리로
  };

  return {
    sheet,
    handle: {
      onPointerDown, onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, false),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true),
    },
  };
}
