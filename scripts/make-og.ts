/* 아이콘과 링크 미리보기 그림을 만듭니다(브라우저로 그려서 PNG로 저장).
   favicon.svg를 고쳤거나 문구를 바꿨을 때만 다시 돌리면 됩니다.
   사용법: npx tsx scripts/make-og.ts   → client/public/*.png */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pub = path.resolve('client/public');
const icon = readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
const browser = await chromium.launch(process.env.E2E_NO_PROXY ? { args: ['--no-proxy-server'] } : {});

/* 1) 앱 아이콘: favicon.svg를 크기별 PNG로 */
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${icon.replace(/width="64" height="64"/, `width="${size}" height="${size}"`)}</body>`);
  writeFileSync(path.join(pub, `icon-${size}.png`), await page.screenshot({ omitBackground: true }));
  await page.close();
}

/* 2) 링크 미리보기(카카오톡·디스코드 등): 1200×630 */
const og = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<div style="width:1200px;height:630px;box-sizing:border-box;padding:76px 88px;background:#FFFFFF;
     font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#10151D;position:relative;overflow:hidden">
  <div style="display:flex;align-items:center;gap:18px">
    ${icon.replace(/width="64" height="64"/, 'width="72" height="72"')}
    <span style="font-size:46px;font-weight:800;letter-spacing:-1px">떡상개론</span>
  </div>
  <p style="margin:52px 0 0;font-size:72px;font-weight:800;line-height:1.25;letter-spacing:-2px">같은 뉴스, 다른 판단.<br/>누가 왜 이겼는지 바로 나와요</p>
  <p style="margin:34px 0 0;font-size:34px;color:#5A6472;font-weight:500">가상 기업과 가상 자금 1,000만 원으로 하는 주식 게임</p>
  <p style="position:absolute;left:88px;bottom:56px;margin:0;font-size:24px;color:#8A93A0">게임용 가상 정보이며 투자 조언이 아닙니다</p>
  <svg width="340" height="200" viewBox="0 0 340 200" style="position:absolute;right:70px;bottom:56px" fill="none">
    <path d="M8 168 L68 120 L128 148 L188 72 L248 96 L332 16" stroke="#3182F6" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="332" cy="16" r="13" fill="#3182F6"/>
  </svg>
</div></body>`;
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(og);
writeFileSync(path.join(pub, 'og.png'), await page.screenshot());
await browser.close();
console.log('만들었습니다: client/public/icon-180.png, icon-192.png, icon-512.png, og.png');
process.exit(0);
