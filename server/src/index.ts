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
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { void hub.close().then(() => process.exit(0)); });
