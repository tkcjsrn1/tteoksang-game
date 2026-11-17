/* 게임 중에는 휴대폰 화면이 저절로 꺼지지 않게 합니다(Screen Wake Lock).
   결과 화면이나 뉴스를 읽는 동안 화면을 안 만지면 폰이 잠기고 연결이 끊기기 때문입니다.
   지원하지 않는 브라우저에서는 아무 일도 하지 않습니다. 화면을 다른 앱으로 바꾸면 브라우저가
   잠금을 풀고, 다시 돌아오면 이 코드가 다시 겁니다. */
import { useEffect } from 'react';

type Sentinel = { release(): Promise<void>; released?: boolean };
type Nav = { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };
type Doc = { visibilityState: string; addEventListener(t: 'visibilitychange', f: () => void): void; removeEventListener(t: 'visibilitychange', f: () => void): void };

/** 화면 꺼짐 방지를 켜고, 끄는 함수를 돌려줍니다. 화면에 보일 때만 요청합니다. */
export function keepAwake(nav: Nav, doc: Doc): () => void {
  const api = nav.wakeLock;
  if (!api) return () => {};
  let lock: Sentinel | null = null, stopped = false, pending = false;
  const acquire = () => {
    if (stopped || pending || doc.visibilityState !== 'visible' || (lock && !lock.released)) return;
    pending = true;
    api.request('screen')
      .then(l => { if (stopped) void l.release().catch(() => {}); else lock = l; })
      .catch(() => {})   // 배터리 절약 모드 등으로 거절되면 그냥 넘어갑니다
      .finally(() => { pending = false; });
  };
  doc.addEventListener('visibilitychange', acquire);
  acquire();
  return () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', acquire);
    if (lock) void lock.release().catch(() => {});
    lock = null;
  };
}

/** on이 참인 동안 화면이 꺼지지 않습니다. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || typeof document === 'undefined') return;
    return keepAwake(navigator as Nav, document);
  }, [on]);
}
