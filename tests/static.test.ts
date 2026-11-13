/* 화면 파일 내보내기: 링크 미리보기 주소 치환, 새 파일 형식, 없는 주소는 index.html로 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { Hub } from '../server/src/hub';

const dir = mkdtempSync(path.join(tmpdir(), 'tteoksang-static-'));
writeFileSync(path.join(dir, 'index.html'), '<!doctype html><meta property="og:image" content="%PUBLIC_URL%/og.png"><div id="root"></div>');
writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
writeFileSync(path.join(dir, 'manifest.webmanifest'), '{"name":"떡상개론"}');
const hub = new Hub({ staticDir: dir });
const port = await hub.listen(0);
const base = `http://localhost:${port}`;
after(() => hub.close());

test('index.html에 %PUBLIC_URL% 자리표시자가 남지 않는다', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type')!, /text\/html/);
  const html = await r.text();
  assert.equal(html.includes('%PUBLIC_URL%'), false, '치환되지 않은 자리표시자가 그대로 나갔습니다');
  assert.match(html, /og:image/);
});

test('없는 주소는 index.html로 돌려주고(해시 라우팅), 자리표시자는 역시 치환된다', async () => {
  const html = await (await fetch(base + '/records')).text();
  assert.equal(html.includes('%PUBLIC_URL%'), false);
  assert.match(html, /id="root"/);
});

test('아이콘과 웹 매니페스트를 올바른 형식으로 내보낸다', async () => {
  const svg = await fetch(base + '/favicon.svg');
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
  const man = await fetch(base + '/manifest.webmanifest');
  assert.equal(man.headers.get('content-type'), 'application/manifest+json');
  assert.equal((await man.json() as { name: string }).name, '떡상개론');
});
