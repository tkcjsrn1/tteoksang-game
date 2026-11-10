/* 화면 자동 테스트: 실제 브라우저(Chromium)로 390px 휴대폰 화면을 열고 버튼을 눌러 봅니다.
   - 홈 → 혼자 연습 → 주문 → 라운드 결과(등락 막대, 봉 재생) → 용어 설명 → 차트 연습실 1~6
   - 화면마다 가로 스크롤이 생기지 않는지, 브라우저 오류가 없는지 확인합니다.
   사용법: npm run build && npm run e2e   (dist/를 서버가 그대로 내보냅니다)
   실패하면 화면 캡처를 e2e-output/에 남깁니다. */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { MODES } from '../shared/rules';
import { Hub } from '../server/src/hub';

/* 단계 시간을 줄여 한 라운드를 몇 초 안에 끝냅니다(서버 안에서만). */
for (const m of Object.values(MODES)) { m.news = 2; m.trade = 25; m.recap = 30; }

const OUT = path.resolve('e2e-output');
const W = 390;
let failed = 0;
const errors: string[] = [];
const hub = new Hub({ staticDir: path.resolve('dist') });
const port = await hub.listen(0);
const base = `http://localhost:${port}`;
const browser = await chromium.launch(process.env.E2E_NO_PROXY ? { args: ['--no-proxy-server'] } : {});
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
/* 외부 글꼴(Google Fonts) 로딩 실패는 화면 오류가 아니므로 뺍니다. */
const ignorable = (t: string) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|net::ERR_/.test(t);
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(`console: ${m.text()}`); });

async function step(name: string, f: () => Promise<void>) {
  const before = errors.length;
  try {
    await f();
    await noHorizontalScroll(page, name);
    if (errors.length > before) throw new Error(errors.slice(before).join(' | '));
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${name.replace(/[^\w가-힣]+/g, '_')}.png`), fullPage: true }).catch(() => {});
  }
}
async function noHorizontalScroll(p: Page, where: string) {
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  if (sw > W + 1) throw new Error(`${where}: 가로 스크롤 생김(${sw}px)`);
}
const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

console.log(`화면 테스트: ${base} (${W}px)`);
await step('홈과 첫 방문 안내', async () => {
  await page.goto(base + '/');
  await page.getByRole('dialog', { name: '게임 방법' }).waitFor();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByRole('button', { name: '혼자 연습 시작' }).waitFor();
  ok(await page.getByText('투자 조언이 아닙니다').count(), '면책 문구 없음');
});

await step('혼자 연습: 업종별 종목 10개', async () => {
  await page.getByRole('button', { name: '혼자 연습 시작' }).click();
  await page.locator('.sectors').waitFor();
  const off = page.getByRole('button', { name: '안내 끄기' });
  if (await off.count()) await off.click();
  ok(await page.locator('.sector-head').count() >= 1, '업종 머리줄 없음');
  await page.getByRole('button', { name: '모두 펼치기' }).click();
  ok(await page.locator('.sectors button.row').count() === 10, '종목이 10개가 아님');
});

await step('장중 시세: 가격이 1초마다 바뀐다', async () => {
  await page.locator('.live-dot').waitFor({ timeout: 15_000 });
  const firstRow = page.locator('.sectors button.row').first();
  const t0 = await page.locator('.live-dot').count();
  ok(t0 === 1, '실시간 시세 표시 없음');
  /* 이번 라운드 시세 그래프가 열리는지(종목 창) */
  await firstRow.click();
  await page.locator('.live-chart').waitFor({ timeout: 5_000 });
  const before = await page.locator('.live-chart path').getAttribute('d');
  await page.waitForTimeout(2_500);
  const after = await page.locator('.live-chart path').getAttribute('d');
  ok(before !== after, '2.5초 동안 시세 그래프가 그대로');
});

await step('시장가 매수: 바로 체결', async () => {
  const go = page.locator('button.go');
  await page.getByRole('button', { name: '25%' }).click();
  ok(await go.isEnabled(), '주문 버튼이 꺼져 있음');
  ok(/매수$/.test((await go.textContent()) ?? ''), '시장가 버튼 문구가 "…매수"가 아님');
  await go.click();
  await page.getByText(/체결 · 매수/).first().waitFor({ timeout: 5_000 });
});

await step('지정가 매도 예약과 취소', async () => {
  await page.getByRole('button', { name: '매도', exact: true }).click();
  await page.getByRole('button', { name: /지정가/ }).click();
  const limit = page.locator('#order-limit');
  await limit.waitFor();
  /* 지금 시세보다 높은 가격에 걸어야 바로 체결되지 않고 예약됩니다 */
  for (let i = 0; i < 30; i++) await page.getByRole('button', { name: '지정가 10원 올리기' }).click();
  await page.getByRole('button', { name: '최대' }).click();
  const go = page.locator('button.go');
  ok(/매도 예약$/.test((await go.textContent()) ?? ''), '지정가 버튼 문구가 "…매도 예약"이 아님');
  await go.click();
  await page.getByText(/지정가 예약 완료/).first().waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: '예약 취소' }).click();
  await page.getByText('예약을 취소했습니다').first().waitFor({ timeout: 5_000 });
  await page.keyboard.press('Escape');
});

await step('라운드 결과: 등락 막대와 봉 재생', async () => {
  await page.locator('.replay').first().waitFor({ timeout: 40_000 });
  const bars = await page.locator('.bar-row .bar i').evaluateAll(els => els.map(e => {
    const r = e.getBoundingClientRect(), pr = e.parentElement!.getBoundingClientRect();
    return { pos: getComputedStyle(e).position, inside: r.left >= pr.left - 1 && r.right <= pr.right + 1, w: r.width };
  }));
  ok(bars.length >= 3, '등락 막대가 없음');
  ok(bars.every(b => b.pos === 'absolute' && b.inside), '등락 막대가 칸 밖으로 나가거나 모양이 깨짐');
  ok(await page.locator('.replay svg rect').count() >= 1, '봉 재생 그림 없음');
  ok(await page.getByText(/1초 시세를 빠르게 다시/).count(), '실제 시세 재생 안내 없음');
});

await step('용어 설명 창 열고 닫기', async () => {
  await page.locator('button.gl-term').first().click();
  const sheet = page.locator('.term-sheet');
  await sheet.waitFor();
  ok(await sheet.getByText('이 게임에서는').count() + await sheet.locator('.term-short').count() > 0, '설명 내용 없음');
  await sheet.getByRole('button', { name: '닫기' }).click();
  await sheet.waitFor({ state: 'detached' });
});

await step('용어 사전과 퀴즈', async () => {
  await page.goto(base + '/#/glossary');
  await page.getByRole('heading', { name: '주식 용어 사전' }).waitFor();
  await page.getByPlaceholder(/용어 검색/).fill('슬리피지');
  await page.getByText('주문할 때 본 가격과 실제 체결된 가격의 차이').waitFor();
});

await step('차트 연습실 목록: 제목이 잘리지 않음', async () => {
  await page.goto(base + '/#/lessons');
  const rows = page.locator('.lesson-row');
  await rows.first().waitFor();
  ok(await rows.count() === 6, '수업이 6개가 아님');
  const cut = await page.locator('.lesson-row .row-main b, .lesson-row .row-main small').evaluateAll(els =>
    els.filter(e => e.scrollWidth > e.clientWidth + 1 || (e.textContent ?? '').length < 4 || e.getBoundingClientRect().width < 120).map(e => e.textContent));
  ok(cut.length === 0, `잘린 글자: ${cut.join(', ')}`);
});

const answers: Record<string, string> = { orders: '10,040원', earnings: '루펠 배양액', risk: '약 79%' };
for (const [id, label] of [['candle', '봉 하나 읽기'], ['compare', '봉 비교'], ['news', '뉴스와 주가'], ['orders', '주문 화면'], ['earnings', '기업 실적'], ['risk', '내 자산과 위험']] as const) {
  await step(`차트 연습실: ${label}`, async () => {
    await page.goto(`${base}/#/lessons/${id}`);
    await page.locator('h1, h2').first().waitFor();
    if (answers[id]) {
      await page.getByRole('button', { name: answers[id] }).first().click();
      await page.locator('.answer').waitFor();
      ok(await page.locator('.correct').count(), '정답 표시 없음');
    }
  });
}

await browser.close();
await hub.close();
console.log(failed ? `결과: 실패 ${failed}건 (캡처: e2e-output/)` : '결과: 통과');
process.exit(failed ? 1 : 0);
