/* 홈 화면의 방 설정을 이 기기에 저장할 때 쓰는 규칙입니다.
   발표용 빠른 판(pace)은 그 판에만 쓰는 설정이라 저장하지 않습니다.
   저장해 두면 다음에 연습할 때도 빠른 판으로 시작해 헷갈리기 때문입니다. */
import type { RoomSettings } from '../../shared/types';

/** 저장할 설정만 남깁니다. 대형 속보 설정(튜토리얼 끔·학술제 반드시)도 그 판에만 씁니다. 예전에 저장된 pace가 있어도 읽을 때 이 함수로 버립니다. */
export function persistedSettings(s: RoomSettings): RoomSettings {
  const { pace: _pace, bigBreaking: _big, ...rest } = s;
  return rest;
}
