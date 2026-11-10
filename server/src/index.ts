import path from 'node:path';
import { MODES } from '../../shared/rules';
import { Hub } from './hub';
import { createStore } from './store';

/* 개발용: TIME_DIVISOR=3 이면 모든 단계 시간을 3분의 1로 줄입니다. 운영에서는 설정하지 마세요. */
const divisor = Number(process.env.TIME_DIVISOR ?? 1);
if (divisor > 1) for (const m of Object.values(MODES)) { m.news = Math.ceil(m.news / divisor); m.trade = Math.ceil(m.trade / divisor); m.recap = Math.ceil(m.recap / divisor); }

const store = createStore();
const hub = new Hub({
  store,
  staticDir: path.resolve(process.cwd(), 'dist'),
  allowTestHooks: process.env.ALLOW_TEST_HOOKS === '1',
  trustProxy: process.env.TRUST_PROXY === '1'
});
const port = await hub.listen(Number(process.env.PORT ?? 8787));
console.log(`서버 실행 중: http://localhost:${port} (저장소: ${store.name})`);
if (store.name === 'memory') console.log('DATABASE_URL이 없어 메모리에 저장합니다. 서버를 끄면 방이 사라집니다.');
/* 종료 신호(배포 교체 포함)를 받으면 방 상태를 저장하고 끕니다. 10초 안에 안 끝나면 강제로 끕니다. */
let stopping = false;
function shutdown(code: number, why: string) {
  if (stopping) return;
  stopping = true;
  console.log(`서버 종료: ${why}`);
  setTimeout(() => { console.error('종료가 10초를 넘어 강제로 끕니다'); process.exit(code || 1); }, 10_000).unref();
  hub.close().then(() => process.exit(code), e => { console.error('종료 중 오류', e); process.exit(1); });
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => shutdown(0, sig));
/* 예상하지 못한 오류: 기록하고, 상태를 저장한 뒤 다시 시작되게 끝냅니다(Render·Docker가 다시 띄움). */
process.on('uncaughtException', e => { console.error('처리되지 않은 오류', e); shutdown(1, 'uncaughtException'); });
process.on('unhandledRejection', e => { console.error('처리되지 않은 Promise 거부', e); });
