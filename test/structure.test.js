import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('styles.css');
const js = read('app.js');
const vercel = JSON.parse(read('vercel.json'));

const ALLOWED_HOSTS = [
  'github.com',
  'upkeep-ecru-six.vercel.app',
  'ideablend.vercel.app',
  'cleansub-teal.vercel.app',
  'removemehelper.vercel.app'
];

test('required files exist', () => {
  const files = [
    'index.html',
    'styles.css',
    'app.js',
    'favicon.svg',
    'vercel.json',
    'README.md',
    'fonts/press-start-2p.woff2',
    'fonts/vt323.woff2',
    'fonts/OFL.txt',
    'fonts/OFL-press-start-2p.txt',
    'og-sapphire.png'
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
  }
});

test('every local asset reference exists on disk', () => {
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)].map((match) => match[1]);
  assert.ok(refs.length > 0, 'no local asset references found');
  for (const ref of new Set(refs)) {
    assert.ok(fs.existsSync(path.join(root, ref)), `${ref} referenced but missing`);
  }
});

test('no remote scripts, styles, images or fonts', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/i);
  assert.doesNotMatch(html, /<img[^>]+src="https?:/i);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/i);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
});

test('external links are https, allowlisted, and opened safely', () => {
  const plainStart = html.indexOf('<main id="plain"');
  const anchors = [...html.matchAll(/<a\b[^>]*>/g)];
  assert.ok(anchors.length >= 10, 'expected the work and link lists');
  for (const match of anchors) {
    const anchor = match[0];
    const href = (anchor.match(/href="([^"]+)"/) || [])[1];
    if (!href || !href.startsWith('http')) continue;
    const url = new URL(href);
    assert.equal(url.protocol, 'https:', `${href} must use https`);
    assert.ok(ALLOWED_HOSTS.includes(url.hostname), `${href} is not an allowlisted host`);
    assert.match(anchor, /rel="noopener noreferrer"/, `${href} needs rel="noopener noreferrer"`);
    if (match.index < plainStart) {
      assert.match(anchor, /target="_blank"/, `${href} should open in a new tab from the desktop`);
    }
  }
});

test('internal document links resolve to ids', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const internal = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  for (const id of internal) assert.ok(ids.has(id), `#${id} has no target`);
});

test('every aria-labelledby / aria-describedby reference exists', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const attr of ['aria-labelledby', 'aria-describedby']) {
    for (const match of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) {
      for (const id of match[1].split(/\s+/)) {
        assert.ok(ids.has(id), `${attr}="${id}" points at nothing`);
      }
    }
  }
});

test('window dialogs have titles and close controls', () => {
  const wins = [...html.matchAll(/<section class="win[^"]*"[^>]*>/g)].map((match) => match[0]);
  assert.ok(wins.length >= 5, 'expected at least five windows');
  for (const win of wins) {
    assert.match(win, /role="dialog"/);
    assert.match(win, /aria-labelledby="[^"]+"/);
    assert.match(win, /tabindex="-1"/);
  }
  assert.equal((html.match(/data-win-close/g) || []).length, wins.length);
});

test('app.js parses as valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', path.join(root, 'app.js')], { stdio: 'pipe' });
});

test('terminal implements the documented commands', () => {
  for (const command of ['whoami', 'ls', 'open', 'date', 'sudo', 'hack', 'coffee', 'clear', 'exit', 'konami']) {
    assert.ok(new RegExp(`\\b${command}\\s*\\(`).test(js), `terminal command ${command} missing`);
  }
  assert.match(js, /ArrowUp/);
  assert.match(js, /ArrowDown/);
});

test('user input never reaches innerHTML', () => {
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(js, /eval\s*\(|new Function/);
});

test('storage is limited to the sound preference', () => {
  const keys = [...js.matchAll(/store\.(?:get|set)\(\s*'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(keys)], ['sapphire.audio']);
  assert.doesNotMatch(js, /sessionStorage|indexedDB|document\.cookie/);
});

test('plain-text fallback carries the real content', () => {
  const plain = html.slice(html.indexOf('<main id="plain"'));
  assert.match(plain, /<h1>The Sapphire<\/h1>/);
  for (const name of ['Upkeep', 'IdeaBlend', 'CleanSub', 'RemoveMe Helper', 'Seraph AI Trader', 'NFTScan']) {
    assert.ok(plain.includes(name), `plain version is missing ${name}`);
  }
  assert.match(plain, /github\.com\/blksapphire/);
});

test('security headers are configured', () => {
  const headers = vercel.headers[0].headers;
  const map = Object.fromEntries(headers.map((header) => [header.key, header.value]));
  assert.match(map['Content-Security-Policy'], /default-src 'self'/);
  assert.match(map['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(map['X-Content-Type-Options'], 'nosniff');
  assert.equal(map['Referrer-Policy'], 'no-referrer');
});

test('page metadata is present', () => {
  assert.match(html, /<title>SAPPHIRE\.exe — a website that should not exist<\/title>/);
  assert.match(html, /<meta\s+name="description"\s+content="[^"]{80,}"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<meta property="og:image" content="\/og-sapphire\.png"/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
});
