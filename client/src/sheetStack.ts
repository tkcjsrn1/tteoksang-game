/* 아래에서 올라오는 창(시트)을 휴대폰 뒤로가기와 PC의 Esc로 닫습니다.
   창을 열 때 주소는 그대로 두고 방문 기록을 한 칸 쌓습니다. 그래서 뒤로가기를 누르면
   게임 화면에서 나가지 않고 창만 닫힙니다. 창이 겹쳐 있으면(종목 창 위 용어 창) 위의 것부터 닫습니다. */
import { useEffect, useRef } from 'react';

type Entry = { sheet?: number } | null;
let seq = 0, listening = false;
/** 지금 열린 창: 번호 → 닫는 함수. 나중에 열린 창일수록 번호가 큽니다. */
const open = new Map<number, () => void>();
const top = () => (history.state as Entry)?.sheet ?? 0;

/** 뒤로가기: 기록에서 빠진 창을 닫습니다. 창이 이미 다른 방법으로 닫혀 남은 빈 칸에 오면 한 칸 더 뒤로 갑니다. */
export function onBack() {
  const now = top();
  for (const [n, close] of open) if (n > now) close();
  if (now > 0 && !open.has(now)) history.back();
}

/** 맨 위 창만 Esc로 닫습니다. 글자를 조합하는 중(한글 입력)에는 닫지 않습니다. */
export function topSheet() {
  return open.size ? Math.max(...open.keys()) : 0;
}

export function useSheetDismiss(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const n = ++seq;
    open.set(n, () => close.current());
    history.pushState({ ...(history.state ?? {}), sheet: n }, '');
    /* 한 번 붙이면 떼지 않습니다. 창이 다 닫힌 뒤에도 남은 빈 칸을 건너뛰어야 하기 때문입니다. */
    if (!listening) { window.addEventListener('popstate', onBack); listening = true; }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing && topSheet() === n) { e.preventDefault(); close.current(); }
    };
    window.addEventListener('keydown', key);
    return () => {
      open.delete(n);
      window.removeEventListener('keydown', key);
      /* 닫기 버튼·끌기·Esc로 닫았으면 쌓아 둔 기록을 되돌립니다(뒤로가기로 닫혔으면 이미 빠져 있음).
         창을 닫으며 다른 화면으로 이동했다면 기록 맨 위가 내 칸이 아니므로 건드리지 않습니다. */
      if (top() === n) history.back();
    };
  }, []);
}
