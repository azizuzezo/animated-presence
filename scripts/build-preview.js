#!/usr/bin/env node
// Membuat gambar contoh untuk README: mockup kartu presence Discord.
//   node scripts/build-preview.js
// Butuh: rsvg-convert dan ffmpeg. Jalankan build-icons.js lebih dulu.
// Hasil: media/demo.gif (animasi), media/card-*.png (statis), media/icons.png

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ICONS = path.join(ROOT, 'assets', 'discord');
const MEDIA = path.join(ROOT, 'media');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-preview-'));
fs.mkdirSync(MEDIA, { recursive: true });

const FONT = "'Noto Sans', 'DejaVu Sans', 'Noto Color Emoji', sans-serif";
const APP_NAME = 'Visual Studio Code'; // nama aplikasi Discord
const W = 600;
const SCALE = 2;

const img = (name) => `data:image/png;base64,${fs.readFileSync(path.join(ICONS, `${name}.png`)).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Emoji dirender sebagai gambar Twemoji (seperti di Discord), karena rsvg tidak bisa font emoji berwarna.
// Twemoji © Twitter / jdecked, CC-BY 4.0
const TWEMOJI = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg';
const EMOJI_CACHE = path.join(ROOT, 'assets', '.cache', 'twemoji');
const emojiData = {};
async function loadEmoji(ch) {
  const code = [...ch].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f').join('-');
  const file = path.join(EMOJI_CACHE, `${code}.svg`);
  if (!fs.existsSync(file)) {
    const res = await fetch(`${TWEMOJI}/${code}.svg`);
    if (!res.ok) throw new Error(`Twemoji ${code} tidak ditemukan`);
    fs.mkdirSync(EMOJI_CACHE, { recursive: true });
    fs.writeFileSync(file, await res.text());
  }
  emojiData[ch] = `data:image/svg+xml;base64,${fs.readFileSync(file).toString('base64')}`;
}
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;

// Baris teks; emoji di awal digambar sebagai ikon
function line(text, x, y, attrs) {
  const m = text.match(LEADING_EMOJI);
  if (!m) return `<text x="${x}" y="${y}" ${attrs}>${esc(text)}</text>`;
  return `<image x="${x}" y="${y - 15}" width="18" height="18" href="${emojiData[m[1]]}"/>
    <text x="${x + 24}" y="${y}" ${attrs}>${esc(text.slice(m[0].length))}</text>`;
}

// Kartu aktivitas bergaya profil Discord (tema gelap)
function card({ details, state, large = 'logo', small, elapsed, button = 'View Repository', heading = 'Playing' }) {
  const H = button ? 222 : 172;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="large"><rect x="32" y="62" width="96" height="96" rx="12"/></clipPath>
    <clipPath id="small"><circle cx="120" cy="150" r="17"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="#1E1F22"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="#2B2D31"/>
  <text x="32" y="44" font-family="${FONT}" font-size="13" font-weight="700" fill="#B5BAC1">${heading}</text>
  <image x="32" y="62" width="96" height="96" href="${img(large)}" clip-path="url(#large)"/>
  <circle cx="120" cy="150" r="21" fill="#2B2D31"/>
  <image x="103" y="133" width="34" height="34" href="${img(small)}" clip-path="url(#small)"/>
  <g font-family="${FONT}">
    <text x="148" y="80" font-size="16" font-weight="700" fill="#F2F3F5">${APP_NAME}</text>
    ${line(details, 148, 104, 'font-size="14" fill="#DBDEE1"')}
    ${line(state, 148, 127, 'font-size="14" fill="#DBDEE1"')}
    <text x="148" y="150" font-size="13" font-weight="600" fill="#23A55A">${elapsed} elapsed</text>
  </g>
  ${button ? `<rect x="32" y="172" width="${W - 64}" height="34" rx="8" fill="#4E5058"/>
  <text x="${W / 2}" y="194" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="#FFFFFF">${button}</text>` : ''}
</svg>`;
}

// Urutan frame mengikuti keluaran ekstensi (default settings), tiap frame = 15 detik di Discord
const FRAMES = [
  { details: 'Editing app.ts', state: '⠋ Line 50', large: 'lang-typescript', small: 'logo', elapsed: '12:04' },
  { details: 'Workspace: my-project', state: '▰▰▰▰▱▱▱▱ 50%', large: 'lang-typescript', small: 'typing', elapsed: '12:19' },
  { details: 'Coding in typescript', state: '⠹ 12m coding', large: 'lang-typescript', small: 'logo', elapsed: '12:34' },
  { details: '🤖 Coding with Claude Code', state: '⠸ Line 64', large: 'agent-claude', small: 'logo', elapsed: '12:49' },
  { details: '⚡ Claude Code is writing code', state: '▰▰▰▰▰▱▱▱ 64%', large: 'agent-claude', small: 'logo', elapsed: '13:04' },
  { details: 'Editing server.py', state: '⠼ Line 128', large: 'lang-python', small: 'logo', elapsed: '13:19' },
  { details: 'Workspace: my-project', state: '▰▰▰▰▰▰▱▱ 71%', large: 'lang-python', small: 'debugging', elapsed: '13:34' },
];

function render(svgText, out) {
  const svgPath = path.join(TMP, 'tmp.svg');
  fs.writeFileSync(svgPath, svgText);
  execFileSync('rsvg-convert', ['-z', String(SCALE), '-o', out, svgPath]);
}

async function main() {
const IDLE = { details: '💤 Idle...', state: 'my-project', small: 'idle', elapsed: '47:12' };
for (const f of [...FRAMES, IDLE]) {
  for (const t of [f.details, f.state]) {
    const m = t.match(LEADING_EMOJI);
    if (m && !emojiData[m[1]]) await loadEmoji(m[1]);
  }
}

// Animasi
FRAMES.forEach((f, i) => render(card(f), path.join(TMP, `f${String(i).padStart(2, '0')}.png`)));
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-framerate', '1/1.6', '-i', path.join(TMP, 'f%02d.png'),
  '-vf', 'fps=5,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none',
  '-loop', '0', path.join(MEDIA, 'demo.gif'),
]);

// Kartu statis
render(card(FRAMES[4]), path.join(MEDIA, 'card-agent.png'));
render(card(IDLE), path.join(MEDIA, 'card-idle.png'));
render(card({ details: 'Editing main.rs', state: '⠦ Line 12', large: 'lang-rust', small: 'debugging', elapsed: '03:41', button: null }),
  path.join(MEDIA, 'card-debug.png'));

// Lembar ikon
fs.copyFileSync(path.join(ROOT, 'assets', 'preview.png'), path.join(MEDIA, 'icons.png'));

fs.rmSync(TMP, { recursive: true, force: true });
console.log('Selesai: media/demo.gif, media/card-*.png, media/icons.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
