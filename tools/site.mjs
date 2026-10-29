#!/usr/bin/env node
// Builds the website in _site/: the home page with its examples gallery, the
// player and builder, the AI guide (/ai, llms.txt and llms-full.txt), the spec,
// the schema and the skill.
// GitHub Pages publishes _site/ from main (.github/workflows/pages.yml).
//
// Run `npm run site`, which builds the validator first.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { expandTimeline } from '../lib/timeline.js';

const root = new URL('../', import.meta.url);
const out = new URL('_site/', root);
const at = (path) => new URL(path, out);

if (!existsSync(new URL('lib/validator.generated.js', root))) {
  throw new Error('Run tools/build.mjs first: lib/validator.generated.js is missing.');
}

rmSync(out, { recursive: true, force: true });
cpSync(new URL('site/', root), out, { recursive: true });
for (const dir of ['demo', 'lib', 'schema', 'conformance']) {
  cpSync(new URL(`${dir}/`, root), at(`${dir}/`), { recursive: true });
}
cpSync(new URL('examples/', root), at('examples/'), { recursive: true });
cpSync(new URL('SPEC.md', root), at('spec.md'));

// The home page's examples gallery: a card for each workout in
// examples/examples.json, with a link that opens it in the player.
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const playIcon = '<svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z"/></svg>';
const { examples } = JSON.parse(readFileSync(new URL('examples/examples.json', root), 'utf8'));
const cards = examples.map(({ file, discipline, group }) => {
  const doc = JSON.parse(readFileSync(new URL(`examples/${file}`, root), 'utf8'));
  const { totalSeconds } = expandTimeline(doc);
  const link = `play/#w=z.${deflateRawSync(JSON.stringify(doc), { level: 9 }).toString('base64url')}`;
  const level = doc.level && doc.level[0].toUpperCase() + doc.level.slice(1);
  const meta = [totalSeconds ? `${Math.round(totalSeconds / 60)} min` : 'Self-paced', level].filter(Boolean).join(' · ');
  return `<li class="example card" data-group="${escape(group)}">
          <span class="tag">${escape(discipline)}</span>
          <h3>${escape(doc.name)}</h3>
          <p class="muted">${escape(doc.description)}</p>
          <p class="meta small">${escape(meta)}</p>
          <p class="actions"><a class="button primary" href="${link}">${playIcon}Play</a> <a class="button" href="examples/${file}">JSON</a></p>
        </li>`;
});
const groups = [...new Set(examples.map((e) => e.group))];
const filters = ['All', ...groups].map((group, i) =>
  `<button type="button" class="chip" aria-pressed="${i === 0}" data-group="${i === 0 ? '' : escape(group)}">${escape(group)}</button>`);
let home = readFileSync(new URL('site/index.html', root), 'utf8');
for (const [marker, html] of [['<!-- example filters -->', filters.join('\n        ')], ['<!-- examples -->', cards.join('\n        ')]]) {
  if (!home.includes(marker)) throw new Error(`site/index.html has no ${marker}`);
  home = home.replace(marker, () => html);
}
writeFileSync(at('index.html'), home);

// The AI guide, as llms-full.txt and at /ai, the short address the site's
// prompts use. GitHub Pages serves a folder only through index.html, so /ai
// wraps the Markdown in a page.
const guide = readFileSync(new URL('skills/portable-workout-format/references/guide.md', root), 'utf8');
writeFileSync(at('llms-full.txt'), guide);
mkdirSync(at('ai/'));
writeFileSync(at('ai/index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Writing workouts in PWF: a guide for AI assistants</title>
  <meta name="description" content="How AI assistants write, change and share workouts in the Portable Workout Format.">
  <link rel="icon" href="../favicon.ico" sizes="32x32">
  <link rel="alternate" type="text/markdown" href="../llms-full.txt">
  <style>
    body { margin: 0 auto; max-width: 50rem; padding: 1.5rem 1rem 3rem; background: #f6f5f2; color: #1d1d1b; font: 0.9rem/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    a { color: #d9481e; }
    @media (prefers-color-scheme: dark) { body { background: #141413; color: #f1efe9; } a { color: #f0643a; } }
  </style>
</head>
<body>
  <p><a href="../">portableworkout.org</a> · <a href="../llms-full.txt">Plain text</a></p>
  <pre>${escape(guide)}</pre>
</body>
</html>
`);

// /play/ and /build/ serve the demo pages at short URLs. A <base> element
// points their relative links and scripts back at /demo/.
for (const page of ['play', 'build']) {
  const html = readFileSync(new URL(`demo/${page}.html`, root), 'utf8');
  if (!html.includes('<head>')) throw new Error(`demo/${page}.html has no <head>`);
  mkdirSync(at(`${page}/`), { recursive: true });
  writeFileSync(at(`${page}/index.html`), html.replace('<head>', '<head>\n  <base href="../demo/">'));
}

// The skill, zipped for uploading to Claude or ChatGPT.
mkdirSync(at('skill/'));
execFileSync('zip', ['-q', '-r', '-X', new URL('skill/portable-workout-format.zip', out).pathname,
  'portable-workout-format', '-x', '*/__pycache__/*', '*.pyc', '*/.DS_Store'], { cwd: new URL('skills/', root) });

console.log(`Built ${out.pathname}`);
