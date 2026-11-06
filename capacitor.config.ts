import type { CapacitorConfig } from '@capacitor/cli';

/* 같은 웹 화면을 Android 앱으로 포장합니다. 앱은 빌드할 때 VITE_SERVER_URL로 서버 주소를 넣습니다. */
const config: CapacitorConfig = {
  appId: 'io.github.tkcjsrn1.tteoksang',
  appName: '떡상개론',
  webDir: 'dist',
  android: { allowMixedContent: false }
};
export default config;
