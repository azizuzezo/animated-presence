#!/usr/bin/env node
// Generator ikon Animated Presence.
//   node scripts/build-icons.js
// Butuh: rsvg-convert (paket librsvg) dan koneksi internet (untuk ikon bahasa Devicon).
// Hasil:
//   assets/icon.png            → ikon ekstensi (Marketplace)
//   assets/app-icon.png        → App Icon di Discord Developer Portal
//   assets/discord/*.png       → upload ke Rich Presence → Art Assets (nama file = key)
//   assets/svg/*.svg           → sumber vektor
//   assets/preview.png         → lembar pratinjau semua ikon

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { LANGUAGE_ICONS } = require('../src/constants');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const SVG_DIR = path.join(ASSETS, 'svg');
const DISCORD_DIR = path.join(ASSETS, 'discord');
const CACHE_DIR = path.join(ASSETS, '.cache', 'devicon');
const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons';
const FONT = "'Noto Sans', 'DejaVu Sans', sans-serif";

for (const d of [SVG_DIR, DISCORD_DIR, CACHE_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------- desain ----------

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
  `<defs>${defs}</defs>${body}</svg>`;

// Logo utama: gradasi blurple→ungu, </> dengan garis denyut (pulse) di tengah.
// fullBleed: isi penuh tanpa sudut transparan (Discord memotong sendiri jadi lingkaran/rounded).
function logo({ fullBleed = true } = {}) {
  const shape = fullBleed
    ? (fill) => `<rect width="1024" height="1024" fill="${fill}"/>`
    : (fill) => `<rect x="32" y="32" width="960" height="960" rx="224" fill="${fill}"/>`;
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5865F2"/>
      <stop offset="0.55" stop-color="#7C4DFF"/>
      <stop offset="1" stop-color="#C026D3"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pulse" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#67E8F9"/>
      <stop offset="1" stop-color="#FFFFFF"/>
    </linearGradient>`;
  const body = `
    ${shape('url(#bg)')}
    ${shape('url(#glow)')}
    <g fill="none" stroke="#FFFFFF" stroke-width="72" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="318,322 168,512 318,702"/>
      <polyline points="706,322 856,512 706,702"/>
    </g>
    <polyline points="300,512 392,512 440,400 512,640 572,452 612,512 724,512"
      fill="none" stroke="url(#pulse)" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg(body, defs);
}

// Ikon aktivitas: lingkaran penuh berwarna + glyph putih (Discord memotong gambar kecil jadi lingkaran).
const circleIcon = (color, glyph) =>
  svg(`<circle cx="512" cy="512" r="512" fill="${color}"/>${glyph}`);

const ACTIVITY = {
  // titik tiga ala indikator "sedang mengetik"
  typing: circleIcon('#23A55A', `
    <g fill="#FFFFFF">
      <circle cx="332" cy="512" r="76"/>
      <circle cx="512" cy="512" r="76"/>
      <circle cx="692" cy="512" r="76"/>
    </g>`),
  // mata
  reading: circleIcon('#5865F2', `
    <path d="M192 512 C 300 330, 724 330, 832 512 C 724 694, 300 694, 192 512 Z"
      fill="none" stroke="#FFFFFF" stroke-width="56" stroke-linejoin="round"/>
    <circle cx="512" cy="512" r="104" fill="#FFFFFF"/>
    <circle cx="548" cy="476" r="34" fill="#5865F2"/>`),
  // kumbang (bug)
  debugging: circleIcon('#F23F43', `
    <g fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round">
      <path d="M440 300 L 392 236 M 584 300 L 632 236"/>
      <path d="M340 470 L 236 430 M 340 580 L 220 580 M 350 680 L 248 752"/>
      <path d="M684 470 L 788 430 M 684 580 L 804 580 M 674 680 L 776 752"/>
    </g>
    <ellipse cx="512" cy="356" rx="104" ry="80" fill="#FFFFFF"/>
    <path d="M512 410 C 400 410, 332 500, 332 600 C 332 720, 420 790, 512 790
             C 604 790, 692 720, 692 600 C 692 500, 624 410, 512 410 Z" fill="#FFFFFF"/>
    <path d="M512 440 L 512 770" stroke="#F23F43" stroke-width="28"/>`),
  // bulan sabit
  idle: circleIcon('#F0B232', `
    <path d="M600 236 A 290 290 0 1 0 788 640 A 230 230 0 1 1 600 236 Z" fill="#FFFFFF"/>
    <g fill="#FFFFFF">
      <circle cx="720" cy="300" r="26"/>
      <circle cx="800" cy="420" r="16"/>
    </g>`),
};

// Ikon file generik untuk bahasa yang tidak ada di daftar
const LANG_BG = '#F2F3F5';
const langFile = circleIcon(LANG_BG, `
  <path d="M372 236 H 580 L 692 348 V 760 Q 692 788 664 788 H 372 Q 344 788 344 760 V 264 Q 344 236 372 236 Z"
    fill="#FFFFFF" stroke="#4E5058" stroke-width="36" stroke-linejoin="round"/>
  <path d="M580 236 V 348 H 692" fill="none" stroke="#4E5058" stroke-width="36" stroke-linejoin="round"/>
  <g stroke="#7C4DFF" stroke-width="36" stroke-linecap="round">
    <path d="M420 480 H 616 M 420 568 H 616 M 420 656 H 540"/>
  </g>`);

const textBadge = (label, color, bg = LANG_BG) => circleIcon(bg,
  `<text x="512" y="512" text-anchor="middle" dominant-baseline="central"
     font-family="${FONT}" font-weight="800" font-size="${label.length > 3 ? 230 : label.length > 1 ? 300 : 440}"
     fill="${color}">${label}</text>`);

// ---------- ikon AI agent (Simple Icons, CC0) ----------
// Logo brand dipakai hanya untuk menunjukkan agent yang sedang dipakai.
// si = [slug, versi] Simple Icons; tanpa si → lencana teks.
const SIMPLE_ICONS = 'https://cdn.jsdelivr.net/npm/simple-icons@';
const AGENT_ICONS = {
  claude: { si: ['claudecode', '16.30.0'], bg: '#D97757', fg: '#FFFFFF' },
  codex: { si: ['openai', '15.0.0'], bg: '#FFFFFF', fg: '#000000' },
  copilot: { si: ['githubcopilot', '16.30.0'], bg: '#FFFFFF', fg: '#000000' },
  gemini: { si: ['googlegemini', '16.30.0'], bg: '#FFFFFF', fg: '#8E75B2' },
  cursor: { si: ['cursor', '16.30.0'], bg: '#FFFFFF', fg: '#000000' },
  windsurf: { si: ['windsurf', '16.30.0'], bg: '#FFFFFF', fg: '#0B100F' },
  cline: { si: ['cline', '16.30.0'], bg: '#FFFFFF', fg: '#18181B' },
  trae: { si: ['trae', '16.30.0'], bg: '#0B0F0D', fg: '#32F08C' },
  qwen: { si: ['qwen', '16.30.0'], bg: '#6950EF', fg: '#FFFFFF' },
  antigravity: { text: 'AG', bg: '#4285F4', fg: '#FFFFFF' },
  kiro: { text: 'K', bg: '#790ECB', fg: '#FFFFFF' },
  roo: { text: 'Roo', bg: '#1F2937', fg: '#FFFFFF' },
  kilo: { text: 'Kilo', bg: '#F8F675', fg: '#111111' },
  continue: { text: 'CON', bg: '#FFFFFF', fg: '#111111' },
  amazonq: { text: 'Q', bg: '#232F3E', fg: '#FF9900' },
  aider: { text: 'aider', bg: '#14B014', fg: '#FFFFFF' },
  opencode: { text: 'OC', bg: '#FFFFFF', fg: '#111111' },
};

async function simpleIcon(slug, version) {
  const cached = path.join(CACHE_DIR, `si-${slug}.svg`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  const res = await fetch(`${SIMPLE_ICONS}${version}/icons/${slug}.svg`);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.includes('<svg')) return null;
  fs.writeFileSync(cached, text);
  return text;
}

function agentIcon(siSvg, bg, fg) {
  const colored = siSvg.replace('<svg ', `<svg fill="${fg}" `);
  const uri = `data:image/svg+xml;base64,${Buffer.from(colored).toString('base64')}`;
  return circleIcon(bg, `<image x="272" y="272" width="480" height="480" href="${uri}"/>`);
}

// ---------- ikon bahasa (Devicon, MIT) ----------

const DEVICON_NAME = {
  javascript: 'javascript', typescript: 'typescript', react: 'react', python: 'python', java: 'java',
  c: 'c', cpp: 'cplusplus', csharp: 'csharp', go: 'go', rust: 'rust', php: 'php', ruby: 'ruby',
  html: 'html5', css: 'css3', scss: 'sass', json: 'json', markdown: 'markdown', shellscript: 'bash',
  lua: 'lua', dart: 'dart', kotlin: 'kotlin', swift: 'swift', vue: 'vuejs', svelte: 'svelte',
  yaml: 'yaml', dockerfile: 'docker',
};
const TEXT_FALLBACK = { sql: ['SQL', '#E38C00'] };

async function devicon(name) {
  const cached = path.join(CACHE_DIR, `${name}.svg`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  for (const variant of ['original', 'plain']) {
    const res = await fetch(`${DEVICON}/${name}/${name}-${variant}.svg`);
    if (res.ok) {
      const text = await res.text();
      if (!text.includes('<svg')) continue;
      fs.writeFileSync(cached, text);
      return text;
    }
  }
  return null;
}

function langIcon(deviconSvg) {
  const uri = `data:image/svg+xml;base64,${Buffer.from(deviconSvg).toString('base64')}`;
  return circleIcon(LANG_BG, `<image x="232" y="232" width="560" height="560" href="${uri}"/>`);
}

// ---------- render ----------

function render(name, svgText, outPng, size) {
  const svgPath = path.join(SVG_DIR, `${name}.svg`);
  fs.writeFileSync(svgPath, svgText);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', outPng, svgPath]);
}

async function main() {
  const made = [];

  // Logo: pakai assets/brand/logo.png jika ada, selain itu desain SVG bawaan
  const brand = path.join(ASSETS, 'brand', 'logo.png');
  if (fs.existsSync(brand)) {
    const uri = `data:image/png;base64,${fs.readFileSync(brand).toString('base64')}`;
    const full = svg(`<image width="1024" height="1024" href="${uri}" preserveAspectRatio="xMidYMid slice"/>`);
    const rounded = svg(`<image width="1024" height="1024" href="${uri}" clip-path="url(#r)" preserveAspectRatio="xMidYMid slice"/>`,
      '<clipPath id="r"><rect width="1024" height="1024" rx="224"/></clipPath>');
    render('logo', full, path.join(DISCORD_DIR, 'logo.png'), 1024);
    render('app-icon', full, path.join(ASSETS, 'app-icon.png'), 1024);
  } else {
    render('logo', logo(), path.join(DISCORD_DIR, 'logo.png'), 1024);
    render('app-icon', logo(), path.join(ASSETS, 'app-icon.png'), 1024);
  }
  // Ikon Marketplace & gambar README selalu memakai desain sendiri tanpa logo brand lain
  // (Marketplace menolak ikon yang memuat logo VS Code / Discord sebagai "suspicious content").
  render('icon', logo({ fullBleed: false }), path.join(ASSETS, 'icon.png'), 256);
  render('logo-neutral', logo(), path.join(ASSETS, 'logo-neutral.png'), 1024);
  made.push('logo');

  for (const [key, s] of Object.entries(ACTIVITY)) {
    render(key, s, path.join(DISCORD_DIR, `${key}.png`), 1024);
    made.push(key);
  }

  render('lang-file', langFile, path.join(DISCORD_DIR, 'lang-file.png'), 1024);
  made.push('lang-file');

  const missing = [];
  for (const lang of LANGUAGE_ICONS) {
    const key = `lang-${lang}`;
    let s = null;
    if (TEXT_FALLBACK[lang]) s = textBadge(...TEXT_FALLBACK[lang]);
    else if (DEVICON_NAME[lang]) {
      const d = await devicon(DEVICON_NAME[lang]);
      if (d) s = langIcon(d);
    }
    if (!s) { missing.push(lang); s = textBadge(lang.slice(0, 3).toUpperCase(), '#4E5058'); }
    render(key, s, path.join(DISCORD_DIR, `${key}.png`), 1024);
    made.push(key);
  }

  for (const [id, spec] of Object.entries(AGENT_ICONS)) {
    const key = `agent-${id}`;
    let s = null;
    if (spec.si) {
      const d = await simpleIcon(...spec.si);
      if (d) s = agentIcon(d, spec.bg, spec.fg);
    }
    if (!s) {
      if (spec.si) missing.push(key);
      s = textBadge(spec.text || id.slice(0, 2).toUpperCase(), spec.fg, spec.bg);
    }
    render(key, s, path.join(DISCORD_DIR, `${key}.png`), 1024);
    made.push(key);
  }

  // Lembar pratinjau
  const cols = 8;
  const cell = 160;
  const rows = Math.ceil(made.length / cols);
  const items = made.map((k, i) => {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * (cell + 28);
    const src = k === 'logo' ? path.join(ASSETS, 'logo-neutral.png') : path.join(DISCORD_DIR, `${k}.png`); // README: tanpa logo brand
    const png = fs.readFileSync(src).toString('base64');
    return `<image x="${x + 16}" y="${y + 12}" width="128" height="128" href="data:image/png;base64,${png}"/>
      <text x="${x + cell / 2}" y="${y + 168}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#DBDEE1">${k}</text>`;
  }).join('');
  const W = cols * cell;
  const H = rows * (cell + 28) + 8;
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="100%" height="100%" fill="#313338"/>${items}</svg>`;
  render('preview', sheet, path.join(ASSETS, 'preview.png'), W);
  fs.unlinkSync(path.join(SVG_DIR, 'preview.svg'));

  console.log(`Selesai: ${made.length} ikon Discord di assets/discord/`);
  if (missing.length) console.log(`Tanpa ikon Devicon (pakai teks): ${missing.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
