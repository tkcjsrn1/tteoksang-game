/* 화면 자동 테스트: 실제 브라우저(Chromium)로 390px 휴대폰 화면을 열고 버튼을 눌러 봅니다.
   - 홈 → 혼자 연습 → 장중 시세(선·10초봉) → 주문 → 라운드 결과(등락 막대, 봉 재생) → 용어 설명 → 차트 연습실 1~6 → 짧은 판 끝까지(매매일지)
   - 화면마다 가로 스크롤이 생기지 않는지, 브라우저 오류가 없는지 확인합니다.
   사용법: npm run build && npm run e2e   (dist/를 서버가 그대로 내보냅니다)
   실패하면 화면 캡처를 e2e-output/에 남깁니다. */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { MODES } from '../shared/rules';
import { Hub } from '../server/src/hub';

/* 단계 시간을 줄여 한 라운드를 몇 초 안에 끝냅니다(서버 안에서만). */
/* 주문 시간은 장중 단계(시세·호가·주문·손절·지정가)를 다 해 볼 만큼 줍니다.
   장중 속보는 주문 시간의 절반쯤에 뜨므로, 그보다 길어야 속보까지 확인할 수 있습니다. */
for (const m of Object.values(MODES)) { m.news = 2; m.trade = 70; m.recap = 30; }

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
let tutorialStock = '';
let tradedStock = '';
/* 외부 글꼴(Google Fonts) 로딩 실패는 화면 오류가 아니므로 뺍니다. */
const ignorable = (t: string) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|net::ERR_/.test(t);
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(`console: ${m.text()}`); });

/* 장중 속보 알림은 떠 있는 동안 화면 위를 가립니다. 단계를 시작하기 전에 치우고,
   무엇이 떴는지는 기록해 두었다가 '장중 속보' 단계에서 확인합니다. */
let breakingSeen: string | null = null;
async function closeBreaking() {
  const pop = page.locator('.breaking');
  if (!(await pop.count())) return;
  breakingSeen ??= await pop.innerText().catch(() => null);
  await pop.getByRole('button', { name: /닫기/ }).click().catch(() => {});
  await pop.waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {});
}
async function step(name: string, f: () => Promise<void>) {
  const before = errors.length;
  try {
    await closeBreaking();
    await f();
    await noHorizontalScroll(page, name);
    if (errors.length > before) throw new Error(errors.slice(before).join(' | '));
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message.split('\n').slice(0, 8).join(' / ') : String(e)}`);
    const sheet = page.locator('.sheet');
    console.log(`     상태: 종목창 ${await sheet.count()} · 수량버튼 ${await sheet.locator('.pcts').count()} · 주문버튼 ${JSON.stringify(await sheet.locator('button.go').allTextContents())} · VI ${await page.locator('.vi-note').count()} · 속보 ${await page.locator('.breaking').count()} · 단계 ${await page.locator('.topbar b, .topbar').first().innerText().catch(() => '?')}`);
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
  ok(await page.getByRole('button', { name: /튜토리얼로 시작/ }).count() === 1, '튜토리얼 시작 버튼 없음');
  ok(await page.getByText('투자 조언이 아닙니다').count(), '면책 문구 없음');
  await page.setViewportSize({ width: 1024, height: 844 });
  const desktopHome = await page.locator('main.home').boundingBox();
  ok(desktopHome && desktopHome.width >= 680, 'PC에서 화면 폭이 넓어지지 않음');
  await page.setViewportSize({ width: W, height: 844 });
  const settings = page.getByRole('dialog', { name: '설정' });
  const music = settings.getByRole('checkbox', { name: '배경음' });
  const effects = settings.getByRole('checkbox', { name: '효과음' });
  const theme = settings.getByRole('checkbox', { name: '다크 모드' });
  const volume = settings.getByRole('slider', { name: '전체 음량' });
  await page.getByRole('button', { name: '설정' }).click();
  await music.check();
  await effects.uncheck();
  await volume.fill('35');
  await theme.check();
  await page.reload();
  await page.getByRole('button', { name: '설정' }).click();
  ok(await theme.isChecked(), '다크 모드가 유지되지 않음');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme === 'dark'), '다크 모드 색상 미적용');
  ok(await music.isChecked() && !(await effects.isChecked()) && await volume.inputValue() === '35', '음량·오디오 설정이 유지되지 않음');
  await music.uncheck();
  await effects.check();
  await volume.fill('100');
  await theme.uncheck();
  await settings.getByRole('button', { name: '닫기' }).click();
});

await step('혼자 연습: 3라운드·종목 30개', async () => {
  await page.getByText(/^게임 설정 ·/).click();
  await page.getByLabel('종목 수').selectOption('30');
  await page.getByLabel('라운드 수').selectOption('3');
  await page.getByRole('button', { name: '혼자 연습 시작' }).click();
  await page.getByLabel('1라운드, 전체 3라운드').waitFor();
  await page.locator('.sectors').waitFor();
  await page.getByRole('button', { name: '설정' }).click();
  const settings = page.getByRole('dialog', { name: '설정' });
  await settings.waitFor();
  await page.keyboard.press('Escape');
  await settings.waitFor({ state: 'hidden' });
  const news = page.locator('main .news').first();
  const newsBox = await news.boundingBox();
  const balanceBox = await page.locator('main .wallet-label').first().boundingBox();
  ok(newsBox && balanceBox && newsBox.y < balanceBox.y, '첫 라운드에서 내 평가액이 뉴스보다 앞에 있음');
  const related = page.getByRole('button', { name: /종목 보기/ });
  await related.click();
  const order = page.getByRole('dialog');
  await order.locator('#order-qty').waitFor();
  tutorialStock = await order.getByRole('heading').first().innerText();
  await order.getByRole('button', { name: '관심종목', exact: true }).click();
  ok(!(await order.locator('.company').isVisible()), '첫 주문에서 기업 정보가 먼저 열려 있음');
  await page.locator('.list-head .live-dot').waitFor({ state: 'attached' });
  await order.getByRole('button', { name: '이번에는 지켜보기' }).click();
  await order.waitFor({ state: 'detached' });
  await page.getByText('4. 시세를 지켜봐요', { exact: true }).waitFor();
  await page.getByRole('region', { name: '관심종목' }).getByText(tutorialStock, { exact: true }).waitFor();
  ok(await page.locator('.sector-head').count() >= 1, '업종 머리줄 없음');
  await page.getByRole('button', { name: '모두 펼치기' }).click();
  ok(await page.locator('.sectors button.row').count() === 30, '종목이 30개가 아님');
});

await step('장중 시세: 가격이 1초마다 바뀐다', async () => {
  await page.locator('.list-head .live-dot').waitFor({ timeout: 15_000 });
  const firstRow = page.locator('.sectors button.row').filter({ hasNotText: tutorialStock || /$^/ }).first();
  const t0 = await page.locator('.list-head .live-dot').count();
  ok(t0 === 1, '실시간 시세 표시 없음');
  /* 이번 라운드 시세 그래프가 열리는지(종목 창) */
  await firstRow.click();
  tradedStock = await page.getByRole('dialog').getByRole('heading').first().innerText();
  await page.locator('.live-chart').waitFor({ timeout: 5_000 });
  ok(/시가총액 .*억 원/.test(await page.locator('.company summary').innerText()), '기업 정보 없음');
  const before = await page.locator('.live-chart path').getAttribute('d');
  await page.waitForTimeout(2_500);
  const after = await page.locator('.live-chart path').getAttribute('d');
  ok(before !== after, '2.5초 동안 시세 그래프가 그대로');
  /* 그래프를 누르면 그 시각의 가격(십자선)이 나옵니다 */
  await page.locator('.live-chart svg.probe-area').click({ position: { x: 20, y: 60 } });
  ok(/\d초 · [\d,]+원/.test(await page.locator('.live-chart .probe').innerText()), '십자선 가격 표시 없음');
  /* 10초봉으로 바꾸면 봉(rect)이 그려지고, 다시 선으로 돌립니다 */
  const kinds = page.getByRole('group', { name: '그래프 종류' });
  await kinds.getByRole('button', { name: '10초봉' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.live-chart svg rect').length >= 1, null, { timeout: 12_000 });
  await kinds.getByRole('button', { name: '일봉' }).click();
  await page.locator('.sheet .replay, .sheet .chart-fig svg').first().waitFor({ timeout: 5_000 });
  ok(await page.locator('.live-chart').count() === 0, '일봉을 골랐는데 장중 그래프가 남아 있음');
  await kinds.getByRole('button', { name: '1초' }).click();
  await page.locator('.live-chart').waitFor({ timeout: 5_000 });
});

await step('호가창: 매도 5단계·매수 5단계, 가격을 누르면 지정가로', async () => {
  const qb = page.locator('.qbook');
  await qb.waitFor();
  ok(await qb.locator('tr.ask').count() === 5 && await qb.locator('tr.bid').count() === 5, '호가 단계 수가 다름');
  await qb.locator('tr.bid .lvl').first().click();
  const v = await page.locator('#order-limit').inputValue();
  ok(/^\d+$/.test(v), '호가를 눌러도 지정가가 채워지지 않음');
  await page.getByRole('button', { name: '시장가 · 바로 체결' }).click();
});

await step('비용 안내: 살 때는 수수료만, 팔 때는 거래세까지', async () => {
  const sheet = page.locator('.sheet'), side = sheet.locator('.seg.side');
  await sheet.locator('.pcts').getByRole('button', { name: '25%' }).click();
  await sheet.getByText('수수료 0.10%').waitFor();
  ok(await sheet.getByText('증권거래세 0.20%').count() === 0, '매수인데 증권거래세가 보임');
  await side.locator('[data-s=sell]').click();
  await sheet.locator('.pcts').getByRole('button', { name: '25%' }).click();
  await sheet.getByText('증권거래세 0.20%').waitFor();
  /* 다음 단계가 매수로 시작하도록 되돌립니다 */
  await side.locator('[data-s=buy]').click();
});

await step('시장가 매수: 바로 체결', async () => {
  const sheet = page.locator('.sheet'), go = sheet.locator('button.go');
  await sheet.locator('.pcts').first().getByRole('button', { name: '25%', exact: true }).click();
  ok(await go.isEnabled(), '주문 버튼이 꺼져 있음');
  ok(/매수$/.test((await go.textContent()) ?? ''), '시장가 버튼 문구가 "…매수"가 아님');
  await go.click();
  await page.getByText(/체결 · 매수/).first().waitFor({ timeout: 5_000 });
  /* 그래프 종류 버튼은 종목 창 위쪽에 있습니다(차트 안이 아님) */
  const chart = page.locator('.live-chart'), kinds = page.getByRole('group', { name: '그래프 종류' });
  await chart.locator('.chart-fill').first().waitFor();
  await chart.locator('.chart-events summary').click();
  ok(/매수 .*주 · .*원/.test(await chart.locator('.chart-events ul').innerText()), '체결 가격과 수량이 표시되지 않음');
  await kinds.getByRole('button', { name: '10초봉' }).click();
  ok(await chart.locator('.chart-fill').first().isVisible(), '봉 차트에서 체결 표시가 사라짐');
  await kinds.getByRole('button', { name: '1초' }).click();
});

await step('손절·익절 걸고 해제', async () => {
  const box = page.locator('details.stops');
  await box.waitFor({ timeout: 5_000 });
  if (!(await box.getAttribute('open') !== null)) await box.locator('summary').click();
  await box.getByRole('button', { name: '평균 −10%' }).click();
  await box.getByRole('button', { name: '걸기' }).click();
  await page.getByText('손절·익절을 걸었어요').first().waitFor({ timeout: 5_000 });
  await box.getByRole('button', { name: '해제' }).click();
  await page.getByText('손절·익절을 해제했어요').first().waitFor({ timeout: 5_000 });
});

await step('지정가 매도 예약과 취소', async () => {
  await page.getByRole('button', { name: '매도', exact: true }).click();
  await page.getByRole('button', { name: '지정가 · 예약' }).click();
  const limit = page.locator('#order-limit');
  await limit.waitFor();
  /* 지금 시세보다 높은 가격에 걸어야 바로 체결되지 않고 예약됩니다 */
  for (let i = 0; i < 30; i++) await page.getByRole('button', { name: '지정가 10원 올리기' }).click();
  await page.getByRole('button', { name: '최대', exact: true }).click();
  const go = page.locator('button.go');
  ok(/매도 예약$/.test((await go.textContent()) ?? ''), '지정가 버튼 문구가 "…매도 예약"이 아님');
  await go.click();
  await page.getByText(/지정가 예약 완료/).first().waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: '예약 취소' }).click();
  await page.getByText('예약을 취소했습니다').first().waitFor({ timeout: 5_000 });
  await page.keyboard.press('Escape');
});

await step('장중 속보: 알림이 뜨고 닫힌다', async () => {
  /* 속보는 주문 시간 절반쯤에 뜹니다. 앞 단계에서 이미 지나갔으면 그때 기록해 둔 내용을 씁니다. */
  if (!breakingSeen) {
    await page.locator('.breaking').waitFor({ timeout: 45_000 }).catch(() => {});
    await closeBreaking();
  }
  ok(breakingSeen, '주문 시간이 끝날 때까지 장중 속보 알림이 뜨지 않음');
  ok(/속보/.test(breakingSeen ?? ''), '속보 표시 없음');
  ok(/%/.test(breakingSeen ?? ''), '속보 대상 종목의 등락이 없음');
});

await step('발표 일정: 다음 라운드 예정 종목만 보인다', async () => {
  const box = page.locator('.schedule');
  await box.waitFor();
  ok(/2라운드 예정/.test(await box.innerText()), '다음 라운드 안내가 없음');
  ok(await box.locator('.list li').count() >= 1, '예정 종목이 없음');
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
  ok(await page.locator('.rank-moves li').count() === 4, '순위 변화 4줄이 아님');
  ok(await page.locator('.sectors .avatar svg, .board .avatar svg').count() >= 1, '기업 로고 없음');
  ok(await page.getByText(/1초 시세를 빠르게 다시/).count(), '실제 시세 재생 안내 없음');
  await page.locator('main .board button.row').filter({ hasText: tutorialStock }).first().click();
  const resultStock = page.getByRole('dialog', { name: tutorialStock });
  await resultStock.locator('.live-chart .chart-breaking').waitFor();
  await resultStock.getByRole('button', { name: '닫기' }).click();
  await page.locator('main .board button.row').filter({ hasText: tradedStock }).first().click();
  const filledStock = page.getByRole('dialog', { name: tradedStock });
  const events = filledStock.locator('.chart-events');
  await events.locator('summary').click();
  const labels = await events.locator('li').allTextContents();
  const times = labels.map(label => label.split(' · ', 1)[0]);
  ok(labels.some(label => label.includes('속보')) && labels.some(label => label.includes('매수')), '속보 또는 매수가 이벤트 목록에 없음');
  ok(times.every((t, i) => i === 0 || times[i - 1] <= t), '차트 이벤트가 시간순이 아님');
  await filledStock.getByRole('button', { name: '닫기' }).click();
});

await step('대기실: 내 이름 바꾸기', async () => {
  const res = await page.request.post(`${base}/api/rooms`, { data: { mode: 'friend' } });
  const { code } = await res.json() as { code: string };
  await page.goto(`${base}/#/room/${code}`);
  await page.getByRole('button', { name: '이름 바꾸기' }).click();
  const input = page.getByLabel('내 이름');
  await input.fill('정혁');
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByText('정혁', { exact: true }).first().waitFor({ timeout: 5_000 });
  ok((await page.locator('.people').innerText()).includes('정혁'), '참가자 목록에 바뀐 이름이 없음');
});

await step('용어 설명 창 열고 닫기', async () => {
  /* 용어 사전에서 설명을 펼치면 관련 용어가 점선 버튼으로 나옵니다 */
  await page.goto(base + '/#/glossary');
  await page.getByPlaceholder(/용어 검색/).fill('슬리피지');
  await page.locator('.term-row').first().click();
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

await step('매매일지: 판이 끝나면 내 체결과 메모', async () => {
  /* 2라운드짜리 짧은 판을 새로 시작합니다(이후에 만드는 방부터 적용) */
  Object.assign(MODES.solo, { rounds: 2, news: 1, trade: 6, recap: 2 });
  await page.goto(base + '/');
  await page.getByRole('button', { name: '혼자 연습 시작' }).click();
  await page.locator('.sectors').waitFor();
  await page.getByRole('region', { name: '관심종목' }).getByText(tutorialStock, { exact: true }).waitFor();
  const off = page.getByRole('button', { name: '안내 끄기' });
  if (await off.count()) await off.click();
  await page.locator('.list-head .live-dot').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: '모두 펼치기' }).click().catch(() => {});
  await page.locator('.sectors button.row').first().click();
  await page.getByRole('button', { name: '시장가 · 바로 체결' }).click().catch(() => {});
  await page.getByRole('button', { name: '25%', exact: true }).click();
  await page.locator('button.go').click();
  await page.getByText(/체결 · 매수/).first().waitFor({ timeout: 5_000 });
  await page.keyboard.press('Escape');
  const j = page.locator('.journal');
  await j.waitFor({ timeout: 40_000 });
  ok(await j.locator('.journal-item').count() >= 1, '매매일지에 거래가 없음');
  ok(/종가/.test(await j.locator('.journal-item').first().innerText()), '종가 비교 없음');
  await j.getByRole('button', { name: '+ 메모 남기기' }).first().click();
  await j.locator('textarea').fill('뉴스 보고 샀음');
  await j.locator('textarea').blur();
  await j.getByText('메모: 뉴스 보고 샀음').waitFor();
});

await browser.close();
await hub.close();
console.log(failed ? `결과: 실패 ${failed}건 (캡처: e2e-output/)` : '결과: 통과');
process.exit(failed ? 1 : 0);
