import { useId, useRef, useState } from 'react';
import { masterVolume, musicOn, setMasterVolume, setMusic, useSoundSetting } from './fx';
import { store } from './net';

export function SettingsButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const volumeId = useId();
  const [effects, setEffects] = useSoundSetting();
  const [music, setMusicEnabled] = useState(musicOn);
  const [volume, setVolume] = useState(masterVolume);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  return <>
    <button className="help-btn" type="button" title="설정" aria-label="설정" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m10 3-.6 2.1-1.5.9-2.2-.5-2 3.4 1.6 1.5v1.8l-1.6 1.5 2 3.4 2.2-.5 1.5.9.6 2.1h4l.6-2.1 1.5-.9 2.2.5 2-3.4-1.6-1.5v-1.8l1.6-1.5-2-3.4-2.2.5-1.5-.9L14 3Z" />
        <circle cx="12" cy="11.3" r="3" />
      </svg>
    </button>
    <dialog ref={dialog} className="settings-dialog" aria-labelledby={title}>
      <div className="settings-head">
        <h2 className="h" id={title}>설정</h2>
        <button className="ghost small" type="button" onClick={() => dialog.current?.close()}>닫기</button>
      </div>
      <label className="settings-row">
        배경음
        <input type="checkbox" checked={music} onChange={e => { setMusic(e.target.checked); setMusicEnabled(e.target.checked); }} />
      </label>
      <label className="settings-row">
        효과음
        <input type="checkbox" checked={effects} onChange={e => setEffects(e.target.checked)} />
      </label>
      <div className="settings-volume">
        <div className="settings-head">
          <label htmlFor={volumeId}>전체 음량</label>
          <output htmlFor={volumeId} className="hint num">{volume}%</output>
        </div>
        <input id={volumeId} type="range" min="0" max="100" value={volume}
          onChange={e => { setMasterVolume(e.target.valueAsNumber); setVolume(e.target.valueAsNumber); }} />
      </div>
      <label className="settings-row">
        다크 모드
        <input type="checkbox" checked={dark} onChange={e => {
          const theme = e.target.checked ? 'dark' : 'light';
          document.documentElement.dataset.theme = theme;
          store.set('theme', theme);
          setDark(e.target.checked);
        }} />
      </label>
    </dialog>
  </>;
}
