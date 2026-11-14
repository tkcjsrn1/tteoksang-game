/* 이 기기 설정: 화면 밝기, 글자 크기, 효과음, 배경음, 음량, 진동. 모두 이 기기에만 저장합니다. */
import { useId, useRef, useState } from 'react';
import { masterVolume, setMasterVolume, useHapticSetting, useMusicSetting, useSoundSetting } from './fx';
import { useTheme } from './theme';
import { useTextSize } from './text';

/** onLeave를 주면 설정 창 맨 아래에 "메인 화면으로 나가기"가 생깁니다(게임 중에만 씁니다). */
export function SettingsButton({ onLeave }: { onLeave?: () => void } = {}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const title = useId();
  const volumeId = useId();
  const [effects, setEffects] = useSoundSetting();
  const [music, setMusic] = useMusicSetting();
  const [haptic, setHaptic] = useHapticSetting();
  const [volume, setVolume] = useState(masterVolume);
  const [theme, setTheme] = useTheme();
  const [text, setTextSize] = useTextSize();
  const canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  return <>
    <button className="help-btn" type="button" title="설정" aria-label="설정" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m10 3-.6 2.1-1.5.9-2.2-.5-2 3.4 1.6 1.5v1.8l-1.6 1.5 2 3.4 2.2-.5 1.5.9.6 2.1h4l.6-2.1 1.5-.9 2.2.5 2-3.4-1.6-1.5v-1.8l1.6-1.5-2-3.4-2.2.5-1.5-.9L14 3Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
    <dialog ref={dialog} className="settings-dialog" aria-labelledby={title}>
      <div className="settings-head">
        <h2 className="h" id={title}>설정</h2>
        <button className="ghost small" type="button" onClick={() => { setConfirming(false); dialog.current?.close(); }}>닫기</button>
      </div>
      <label className="settings-row">
        다크 모드
        <input type="checkbox" checked={theme === 'dark'} onChange={e => setTheme(e.target.checked ? 'dark' : 'light')} />
      </label>
      <label className="settings-row">
        글자 크게
        <input type="checkbox" checked={text === 'large'} onChange={e => setTextSize(e.target.checked ? 'large' : 'normal')} />
      </label>
      <label className="settings-row">
        효과음(체결, 종소리, 속보)
        <input type="checkbox" checked={effects} onChange={e => setEffects(e.target.checked)} />
      </label>
      <label className="settings-row">
        장중 배경음{!effects && <small className="hint"> · 소리를 먼저 켜 주세요</small>}
        <input type="checkbox" checked={music} onChange={e => setMusic(e.target.checked)} />
      </label>
      {canBuzz && <label className="settings-row">
        진동(체결, 손절·익절)
        <input type="checkbox" checked={haptic} onChange={e => setHaptic(e.target.checked)} />
      </label>}
      <div className="settings-volume">
        <div className="settings-head">
          <label htmlFor={volumeId}>전체 음량</label>
          <output htmlFor={volumeId} className="hint num">{volume}%</output>
        </div>
        <input id={volumeId} type="range" min="0" max="100" value={volume}
          onChange={e => { setMasterVolume(e.target.valueAsNumber); setVolume(e.target.valueAsNumber); }} />
      </div>
      {onLeave && <div className="settings-leave">
        {confirming
          ? <>
              <p className="hint">정말 홈으로 돌아가시겠어요? 나가도 방은 그대로 있어서, 코드로 다시 들어오면 이어서 할 수 있어요.</p>
              <div className="btn-row">
                <button className="ghost" type="button" onClick={() => setConfirming(false)}>아니요</button>
                <button className="cta" type="button" onClick={() => { setConfirming(false); dialog.current?.close(); onLeave(); }}>예, 나갈래요</button>
              </div>
            </>
          : <button className="link danger" type="button" onClick={() => setConfirming(true)}>메인 화면으로 나가기</button>}
      </div>}
    </dialog>
  </>;
}
