#!/usr/bin/env node
// Builds the website in _site/: the home page, the player and builder, the
// AI guide (llms.txt and llms-full.txt), the spec, the schema and the skill.
// GitHub Pages publishes _site/ from main (.github/workflows/pages.yml).
//
// Run `npm run site`, which builds the validator first.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

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
cpSync(new URL('SPEC.md', root), at('spec.md'));
cpSync(new URL('skills/portable-workout-format/references/guide.md', root), at('llms-full.txt'));

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
