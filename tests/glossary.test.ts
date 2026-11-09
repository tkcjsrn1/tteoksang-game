/* 용어 사전 데이터와 자동 링크 규칙을 검사합니다. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { CATEGORIES, linkTerms, makeQuiz, termById, termsIn, TERMS } from '../shared/glossary';
import { ARCS, CARDS } from '../server/src/content';
import { mulberry } from '../server/src/plan';

test('용어 id는 겹치지 않고, 관련 용어와 분류는 모두 존재한다', () => {
  assert.equal(new Set(TERMS.map(t => t.id)).size, TERMS.length);
  const cats = new Set(CATEGORIES.map(c => c.id));
  for (const t of TERMS) {
    assert.ok(cats.has(t.category), `${t.id} 분류`);
    assert.ok(t.short.length > 0 && t.short.length <= 45, `${t.id} 한 줄 뜻 길이 ${t.short.length}`);
    assert.ok(t.body.length >= 30, `${t.id} 설명이 너무 짧음`);
    for (const r of t.related) assert.ok(termById.has(r), `${t.id} → 없는 관련 용어 ${r}`);
    assert.ok(!t.related.includes(t.id), `${t.id}가 자기 자신을 관련 용어로 가짐`);
  }
  assert.ok(TERMS.length >= 50, `용어 ${TERMS.length}개`);
});

test('같은 자동 링크 낱말이 두 용어에 걸리지 않는다', () => {
  const seen = new Map<string, string>();
  for (const t of TERMS) for (const m of t.match) {
    assert.ok(!seen.has(m), `"${m}"가 ${seen.get(m)}와 ${t.id}에 모두 있음`);
    seen.set(m, t.id);
  }
});

test('자동 링크: 원문을 그대로 보존하고, 같은 용어는 한 번만 링크한다', () => {
  const text = '금리가 오르면 성장주가 흔들리고, 금리가 내리면 성장주가 오릅니다.';
  const segs = linkTerms(text);
  assert.equal(segs.map(s => s.text).join(''), text);
  assert.deepEqual(segs.filter(s => s.termId).map(s => s.termId), ['interest-rate', 'growth-stock']);
});

test('자동 링크: 긴 표현을 먼저 찾고, 다른 낱말 속이나 다른 뜻은 건너뛴다', () => {
  assert.deepEqual(linkTerms('기준금리 동결').filter(s => s.termId).map(s => s.text), ['기준금리']);
  assert.deepEqual(termsIn(['주관사 선정 공고가 나왔습니다']), []);
  assert.deepEqual(termsIn(['계약 체결 자체는 확정되었습니다']), []);
  assert.deepEqual(termsIn(['주문이 체결되었습니다']), ['execution']);
  assert.deepEqual(termsIn(['소형 발전 모듈, 분산 전력 장치']), []);
  assert.deepEqual(termsIn(['1분봉과 5분봉']), ['candle']);
  assert.deepEqual(termsIn(['저가 수주로 마진 감소']), ['contract-win', 'margin']);
});

test('게임 뉴스와 돌발 카드에서 용어를 충분히 배울 수 있다', () => {
  const texts: string[] = [];
  for (const a of ARCS) for (const s of a.stages) {
    texts.push(s.headline, s.facts, s.expectation, s.remaining, s.clue, s.concept);
    for (const o of s.outcomes) texts.push(o.actual, o.gap, ...o.impacts.map(i => i.reason));
  }
  for (const c of CARDS) texts.push(c.body, c.concept, ...c.options.map(o => o.feedback));
  assert.ok(termsIn(texts).length >= 25, `뉴스·카드에 나온 용어 ${termsIn(texts).length}개`);
  for (const c of CARDS) assert.ok(termsIn([c.concept, c.body, ...c.options.map(o => o.feedback)]).length > 0, `돌발 카드 ${c.id}에 연결된 용어가 없음`);
});

test('용어 퀴즈: 보기 4개는 서로 다르고 정답 위치가 맞으며, 같은 시드면 같은 문제', () => {
  const q = makeQuiz(mulberry(1), 5);
  assert.equal(q.length, 5);
  assert.equal(new Set(q.map(x => x.termId)).size, 5);
  for (const x of q) {
    assert.equal(x.options.length, 4);
    assert.equal(new Set(x.options.map(o => o.termId)).size, 4);
    assert.equal(x.options[x.answer].termId, x.termId);
    assert.equal(x.options[x.answer].text, termById.get(x.termId)!.short);
  }
  assert.deepEqual(makeQuiz(mulberry(1), 5), q);
  assert.deepEqual(makeQuiz(mulberry(2), 3, ['bp', 'fee']).map(x => x.termId).sort(), ['bp', 'fee']);
});

test('클라이언트 코드는 서버 시나리오(결말)를 import하지 않는다', () => {
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach(f => { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); });
  walk(path.resolve('client/src'));
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /from ['"][./]*server\//, `${f}가 server를 import함`);
});
