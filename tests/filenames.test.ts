/* Windows·macOS는 파일 이름의 대소문자를 구분하지 않습니다. 확장자를 뺀 이름이 대소문자만 다른 파일이
   같은 폴더에 있으면 import가 엉뚱한 파일로 연결되어 Windows에서만 빌드가 깨집니다(records.ts / Records.tsx 사례). */
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

test('같은 폴더에 대소문자만 다른 모듈 이름이 없다', () => {
  const walk = (d: string) => {
    const seen = new Map<string, string>();
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (f === 'node_modules' || f.startsWith('.')) continue;
      if (statSync(p).isDirectory()) { walk(p); continue; }
      const key = f.replace(/\.(tsx?|jsx?|css)$/, '').toLowerCase();
      assert.ok(!seen.has(key), `${d}: ${seen.get(key)} 와 ${f}`);
      seen.set(key, f);
    }
  };
  ['client', 'server', 'shared', 'tests', 'scripts'].forEach(walk);
});
