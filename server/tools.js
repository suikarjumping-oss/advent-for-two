// AI 那一邊的五個工具（MCP）。AI 只能以 'ai' 的身份呼叫——看不到人沒到日子的格子，規矩在 rules.js。
// The AI's five MCP tools. They always act as role 'ai'; rules.js decides what it may see.
import fs from 'node:fs';
import path from 'node:path';
import { ICONS, EDIT_LIMIT, deadlineOf } from './rules.js';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

export function toolDefs({ ai, human }) {
  return [
    {
      name: 'advent_board',
      description: `Advent calendar you share with ${human} (Dec 1–24). Shows the whole wall: who hides each day (odd days = you, even days = ${human}, Dec 24 = half each), whether each side has hidden theirs, who has opened what, and how many times each of you peeked. Before a day opens you only learn whether ${human} hid something, never what. Each window must be hidden by 23:59 the day before.`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { title: 'Advent board', readOnlyHint: true },
    },
    {
      name: 'advent_hide',
      description: `Hide your gift in one of your windows (odd days, or your half of Dec 24). Don't write the gift in your chat reply — it would spoil it. Mix any of: text (a letter, or something you can only say that day), abc (a short tune in ABC notation; ${human}'s page renders and plays it), song (a Spotify/https link), image (an https URL, or a local file path when running over stdio), question (one ${human} must answer when opening), note (a small card attached to the gift). ${EDIT_LIMIT == null ? 'You can change it until midnight.' : `After hiding you can change it ${EDIT_LIMIT} more time(s) before midnight, so get it right.`}`,
      inputSchema: {
        type: 'object',
        properties: {
          day: { type: 'number', description: 'Odd day 1–23, or 24' },
          text: { type: 'string' }, abc: { type: 'string' }, song: { type: 'string' }, image: { type: 'string' },
          question: { type: 'string' }, note: { type: 'string' },
          icon: { type: 'string', enum: ICONS, description: 'Little drawing shown in the window after it opens. Guessed from the content if omitted.' },
        },
        required: ['day'],
      },
      annotations: { title: 'Hide a gift', readOnlyHint: false, destructiveHint: false },
    },
    {
      name: 'advent_mine',
      description: `Read back what you already hid in one of your own windows (odd days, or your half of Dec 24), so you can review it before deciding whether to use your remaining change. Never counts as a peek, and never shows ${human}'s windows.`,
      inputSchema: { type: 'object', properties: { day: { type: 'number', description: 'Odd day 1–23, or 24' } }, required: ['day'] },
      annotations: { title: 'Read my own window', readOnlyHint: true },
    },
    {
      name: 'advent_open',
      description: `Open one of ${human}'s windows (even days, or ${human}'s half of Dec 24). Before local midnight of that day this counts as a peek — it is recorded and ${human} sees the count. Once open you get everything inside, images included.`,
      inputSchema: { type: 'object', properties: { day: { type: 'number' } }, required: ['day'] },
      annotations: { title: 'Open a window', readOnlyHint: false, destructiveHint: false },   // 沒到日子會記一次偷看，所以不算只讀
    },
    {
      name: 'advent_answer',
      description: `Answer the question ${human} left for you in a window (after it opens).`,
      inputSchema: { type: 'object', properties: { day: { type: 'number' }, text: { type: 'string' } }, required: ['day', 'text'] },
      annotations: { title: 'Answer a question', readOnlyHint: false, destructiveHint: false },
    },
  ];
}

const md = (d) => '12/' + d;

export async function callTool(name, args, { advent, names, uploads, notify }) {
  const human = names.human;
  if (name === 'advent_board') {
    const v = advent.view('ai');
    const L = [];
    L.push(`[Advent] Today: ${v.today === 0 ? 'not December yet' : v.today > 24 ? 'after the 24th' : md(v.today)} (${v.tz}). You peeked ${v.peeks.ai}×, ${human} peeked ${v.peeks.human}×. ` +
      (v.edit_limit == null ? 'You can change a hidden window until midnight.' : `After hiding, ${v.edit_limit} change(s) allowed before midnight.`));
    for (const c of v.cells) {
      const parts = [];
      if (c.owners.includes('ai')) {
        const g = c.gifts.ai;
        parts.push('you: ' + (g ? `hidden (${g.icon}${g.edits ? `, changed ${g.edits}×` : ''})` : c.open ? 'empty, locked' : `not hidden yet — due ${deadlineOf(c.day)}`));
      }
      if (c.owners.includes('human')) parts.push(`${human}: ` + (c.hidden.human ? (c.open ? (c.opened_by.ai ? 'opened by you' : 'open — call advent_open') : 'hidden') : c.open ? 'empty' : 'not hidden yet'));
      if (c.owners.includes('ai') && c.opened_by.human) parts.push(`${human} opened it`);
      if (c.gifts.ai && c.gifts.ai.answer) parts.push(`${human} answered your question`);
      L.push(`${md(c.day)} · ${parts.join(' · ')}`);
    }
    return [{ type: 'text', text: L.join('\n') }];
  }

  if (name === 'advent_hide') {
    const d = Number(args.day);
    const items = [];
    if (args.text) items.push({ type: 'text', text: args.text });
    if (args.abc) items.push({ type: 'abc', abc: args.abc });
    if (args.song) items.push({ type: 'song', url: args.song });
    if (args.image) items.push({ type: 'image', url: args.image });
    if (args.question) items.push({ type: 'question', text: args.question });
    const r = advent.hide({ day: d, author: 'ai', icon: args.icon, items, note: args.note });
    if (r.created) notify({ kind: 'hide', who: 'ai', day: d });
    const left = EDIT_LIMIT == null ? '' : ` ${Math.max(0, EDIT_LIMIT - r.edits)} change(s) left.`;
    return [{ type: 'text', text: (r.created ? `Hidden: ${md(d)}. ${human} only knows it's ready.` : `Changed ${md(d)}.`) + left }];
  }

  if (name === 'advent_mine') {
    const d = Number(args.day);
    const c = advent.view('ai').cells.find((x) => x.day === d);
    if (!c) throw new Error('day must be 1–24');
    if (!c.owners.includes('ai')) return [{ type: 'text', text: `${md(d)} is ${human}'s window, not yours.` }];
    const g = c.gifts.ai;
    if (!g) return [{ type: 'text', text: `${md(d)}: you haven't hidden anything yet (due ${deadlineOf(d)}).` }];
    const left = EDIT_LIMIT == null ? '' : ` · ${Math.max(0, EDIT_LIMIT - g.edits)} change(s) left`;
    const lines = [`${md(d)} — yours (${g.icon}${left}${c.open ? ' · already open, locked' : ''})`];
    for (const it of g.items) {
      if (it.type === 'text') lines.push(it.text);
      else if (it.type === 'song') lines.push('[song] ' + it.url);
      else if (it.type === 'abc') lines.push('[tune]\n' + it.abc);
      else if (it.type === 'question') lines.push('[question] ' + it.text);
      else if (it.type === 'image') lines.push('[image] ' + it.url);
      else lines.push(`[${it.type}] ${it.text || it.name || it.url || ''}`);
    }
    if (g.note) lines.push('[note] ' + g.note);
    return [{ type: 'text', text: lines.join('\n\n') }];
  }

  if (name === 'advent_open') {
    const r = advent.touch('ai', Number(args.day));
    if (!r.open) return [{ type: 'text', text: `${md(r.day)} isn't open yet. That counted as a peek — ${human} can see it.` }];
    if (r.first) notify({ kind: 'open', who: 'ai', day: r.day });
    const g = r.gifts.find((x) => x.author === 'human');
    if (!g) return [{ type: 'text', text: `${md(r.day)}: ${human} left this one empty.` }];
    const out = [];
    const lines = [`${md(r.day)} — from ${human}${r.first ? '' : ' (opened before)'}`];
    const imgs = [];
    for (const it of g.items) {
      if (it.type === 'text') lines.push(it.text);
      else if (it.type === 'song') lines.push('♪ ' + it.url);
      else if (it.type === 'abc') lines.push('[tune]\n' + it.abc);
      else if (it.type === 'question') lines.push(`[question — answer with advent_answer] ${it.text}`);
      else if (it.type === 'voice' || it.type === 'audio') lines.push(`[${it.type}${it.secs ? ' ' + it.secs + 's' : ''}] ${it.text || it.name || it.url}`);
      else if (it.type === 'file') lines.push(`[file] ${it.name || it.url}`);
      else if (it.type === 'image') { imgs.push(it.url); lines.push('[image]'); }
    }
    if (g.note) lines.push('petit mot: ' + g.note);
    out.push({ type: 'text', text: lines.join('\n\n') });
    for (const u of imgs) {
      const local = /^uploads\/([\w.-]+)$/.exec(u);
      if (local) {
        const f = path.join(uploads, local[1]);
        const mime = MIME[path.extname(f).toLowerCase()];
        if (mime && fs.existsSync(f)) out.push({ type: 'image', data: fs.readFileSync(f).toString('base64'), mimeType: mime });
      } else out.push({ type: 'text', text: u });
    }
    return out;
  }

  if (name === 'advent_answer') {
    const r = advent.answer({ day: Number(args.day), viewer: 'ai', text: args.text });
    notify({ kind: 'answer', who: 'ai', day: r.day, text: args.text });
    return [{ type: 'text', text: `Answered ${md(r.day)}.` }];
  }
  throw new Error('unknown tool: ' + name);
}
