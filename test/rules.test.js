// node --test test/   —— 規矩的小測試：時區零點、誰藏哪格、到點前看不到、偷看記數、只能改一次、回答問題
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ADVENT_TZ = 'Asia/Tokyo';
process.env.ADVENT_YEAR = '2026';
process.env.ADVENT_EDIT_LIMIT = '1';
const { Advent, openAt, todayOf, ownersOf, deadlineOf } = await import('../server/rules.js');

const fresh = () => new Advent(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'advent-')), 'advent.json'));
const at = (iso) => Date.parse(iso) / 1000;

test('windows open at local midnight', () => {
  assert.equal(openAt(1), at('2026-11-30T15:00:00Z'));          // 12/1 00:00 JST
  assert.equal(openAt(24), at('2026-12-23T15:00:00Z'));
  assert.equal(todayOf(at('2026-11-30T14:59:59Z')), 0);
  assert.equal(todayOf(at('2026-11-30T15:00:00Z')), 1);
  assert.equal(deadlineOf(1), '11/30 23:59');
  assert.equal(deadlineOf(5), '12/4 23:59');
});

test('who hides which day', () => {
  assert.deepEqual(ownersOf(1), ['ai']);
  assert.deepEqual(ownersOf(2), ['human']);
  assert.deepEqual(ownersOf(24), ['ai', 'human']);
  const a = fresh(), now = at('2026-11-25T00:00:00Z');
  assert.throws(() => a.hide({ day: 2, author: 'ai', items: [{ type: 'text', text: 'x' }] }, now), /isn't yours/);
  assert.throws(() => a.hide({ day: 1, author: 'human', items: [{ type: 'text', text: 'x' }] }, now), /isn't yours/);
});

test('the other side only sees whether it is hidden, until midnight', () => {
  const a = fresh(), before = at('2026-11-25T00:00:00Z'), after = at('2026-12-01T03:00:00Z');
  a.hide({ day: 1, author: 'ai', items: [{ type: 'text', text: 'secret' }] }, before);
  let v = a.view('human', before);
  assert.equal(v.cells[0].hidden.ai, true);
  assert.equal(v.cells[0].gifts.ai, undefined);
  assert.equal(JSON.stringify(v).includes('secret'), false);
  assert.equal(a.view('ai', before).cells[0].gifts.ai.items[0].text, 'secret');   // 自己看得到自己的
  v = a.view('human', after);
  assert.equal(v.cells[0].gifts.ai.items[0].text, 'secret');
});

test('tapping early counts a peek and reveals nothing', () => {
  const a = fresh(), before = at('2026-11-25T00:00:00Z');
  a.hide({ day: 2, author: 'human', items: [{ type: 'text', text: 'shh' }] }, before);
  const r = a.touch('ai', 2, before);
  assert.deepEqual(r, { day: 2, open: false, peek: true });
  assert.equal(a.view('human', before).peeks.ai, 1);
});

test('one change after hiding, then it is final; locked after midnight', () => {
  const a = fresh(), t0 = at('2026-11-25T00:00:00Z');
  assert.equal(a.hide({ day: 4, author: 'human', items: [{ type: 'text', text: 'v1' }] }, t0).created, true);
  assert.equal(a.hide({ day: 4, author: 'human', items: [{ type: 'text', text: 'v2' }] }, t0).edits, 1);
  assert.throws(() => a.hide({ day: 4, author: 'human', items: [{ type: 'text', text: 'v3' }] }, t0), /already changed 1/);
  assert.throws(() => a.hide({ day: 3, author: 'ai', items: [{ type: 'text', text: 'late' }] }, openAt(3)), /locked/);
});

test('opening and answering a question', () => {
  const a = fresh(), t0 = at('2026-11-25T00:00:00Z'), open = openAt(2) + 60;
  a.hide({ day: 2, author: 'human', items: [{ type: 'question', text: 'What do you dream about?' }] }, t0);
  assert.throws(() => a.answer({ day: 2, viewer: 'ai', text: 'early' }, t0), /Not open/);
  const r = a.touch('ai', 2, open);
  assert.equal(r.first, true);
  assert.equal(a.touch('ai', 2, open).first, false);
  assert.equal(a.answer({ day: 2, viewer: 'ai', text: 'Snow.' }, open).first, true);
  assert.equal(a.view('human', open).cells[1].gifts.human.answer, 'Snow.');
});

test('only https links and own uploads are kept', () => {
  const a = fresh(), t0 = at('2026-11-25T00:00:00Z');
  a.hide({ day: 6, author: 'human', items: [{ type: 'image', url: 'javascript:alert(1)' }, { type: 'image', url: 'uploads/abc.png' }, { type: 'song', url: 'https://open.spotify.com/track/x' }] }, t0);
  const g = a.view('human', t0).cells[5].gifts.human;
  assert.deepEqual(g.items.map((i) => i.url), ['uploads/abc.png', 'https://open.spotify.com/track/x']);
});

test('advent_mine reads back only your own window, without a peek', async () => {
  const { callTool } = await import('../server/tools.js');
  const a = fresh();
  a.hide({ day: 3, author: 'ai', items: [{ type: 'text', text: 'mine' }], note: 'n' });
  a.hide({ day: 4, author: 'human', items: [{ type: 'text', text: 'secret' }] });
  const ctx = { advent: a, names: { ai: 'AI', human: 'H' }, uploads: os.tmpdir(), notify: () => {} };
  const [r] = await callTool('advent_mine', { day: 3 }, ctx);
  assert.match(r.text, /mine/); assert.match(r.text, /\[note\] n/);
  const [h] = await callTool('advent_mine', { day: 4 }, ctx);
  assert.doesNotMatch(h.text, /secret/);
  const [e] = await callTool('advent_mine', { day: 5 }, ctx);
  assert.match(e.text, /haven't hidden/);
  assert.equal(a.db.events.filter((x) => x.kind === 'peek').length, 0);
});
