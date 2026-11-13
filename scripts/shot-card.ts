/* 눈으로 확인용 캡처: 쉬움 난이도 주문 화면과 돌발 카드 결과 창(390px).
   사용법: npm run build && npx tsx scripts/shot-card.ts <저장폴더> */
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { MODES } from '../shared/rules';
import { Hub } from '../server/src/hub';

const out = path.resolve(process.argv[2] ?? 'shots');
mkdirSync(out, { recursive: true });
for (const m of Object.values(MODES)) { m.news = 1; m.trade = 12; m.recap = 1; m.rounds = 6; }
const hub = new Hub({ staticDir: path.resolve('dist') });
const port = await hub.listen(0);
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();

const res = await page.request.post(`${base}/api/rooms`, { data: { mode: 'solo', settings: { level: 'easy', rounds: 6 } } });
const { code } = await res.json() as { code: string };
await page.goto(`${base}/#/room/${code}`);
await page.getByRole('button', { name: /게임 시작|시작/ }).first().click().catch(() => {});
await page.locator('.sectors').waitFor({ timeout: 20_000 });
const off = page.getByRole('button', { name: '안내 끄기' });
if (await off.count()) await off.click();

/* 쉬움 난이도 주문 화면 */
await page.locator('.list-head .live-dot').waitFor({ timeout: 20_000 });
await page.locator('.breaking button').first().click().catch(() => {});
await page.locator('main .board button.row, .sectors button.row').first().click();
await page.locator('#order-qty').waitFor();
await page.screenshot({ path: path.join(out, 'easy-order.png'), fullPage: true });
await page.keyboard.press('Escape');

/* 돌발 카드가 나오는 라운드까지 기다렸다가 고르고 결과 창을 캡처 */
const card = page.locator('.card-box');
await card.waitFor({ timeout: 120_000 });
await page.locator('.breaking button').first().click().catch(() => {});
await card.locator('.seg button').first().click();
const sheet = page.getByRole('dialog', { name: '판단 결과' });
await sheet.waitFor({ timeout: 5_000 });
await page.screenshot({ path: path.join(out, 'card-result.png'), fullPage: true });
await sheet.getByRole('button', { name: '알겠어요' }).click();
await page.screenshot({ path: path.join(out, 'card-after.png'), fullPage: true });
console.log('저장:', out);
await browser.close();
await hub.close();
process.exit(0);
