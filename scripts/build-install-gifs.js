#!/usr/bin/env node
// GIF langkah instalasi untuk README (mockup UI editor + kursor + keterangan langkah).
//   node scripts/build-install-gifs.js
// Butuh: rsvg-convert dan ffmpeg. Jalankan build-icons.js lebih dulu.
// Hasil: media/install-vsix.gif (VS Code), media/install-openvsx.gif (Antigravity/Cursor/Windsurf/VSCodium)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');
const ICONS = path.join(ROOT, 'assets', 'discord');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-install-'));
const VERSION = require(path.join(ROOT, 'package.json')).version;
const VSIX = `animated-presence-${VERSION}.vsix`;

const W = 640;
const H = 400;
const SCALE = 2;
const FONT = "'Noto Sans', 'DejaVu Sans', sans-serif";
const C = {
  bg: '#1F1F1F', side: '#181818', border: '#2B2B2B', text: '#CCCCCC', dim: '#8B8B8B',
  accent: '#0078D4', hover: '#2A2D2E', input: '#313131', blurple: '#5865F2',
};

const png = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const ICON = png(path.join(ROOT, 'assets', 'icon.png'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const t = (x, y, s, { size = 12, fill = C.text, weight = 400, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

// Kursor panah
const cursor = (x, y) => `<path transform="translate(${x} ${y})" d="M0 0 L0 17 L4.5 13 L7.5 20 L10.2 18.8 L7.3 12 L13 12 Z"
  fill="#FFFFFF" stroke="#000000" stroke-width="1.2" stroke-linejoin="round"/>`;

// Kerangka jendela editor: activity bar, sidebar Extensions, area editor, status bar, keterangan langkah
function frame({ step, caption, sidebar = '', editor = '', overlay = '', status = false, search = '', caret = false }) {
  const capH = 56;
  const winH = H - capH;
  const searchText = search
    ? t(70, 95, search, { size: 12, fill: '#E0E0E0' })
    : t(70, 95, 'Search Extensions in Marketplace', { size: 12, fill: C.dim });
  const caretX = 71 + search.length * 6.45;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <!-- title bar -->
  <rect width="${W}" height="30" fill="${C.side}"/>
  <g fill="#5A5A5A"><circle cx="16" cy="15" r="5"/><circle cx="32" cy="15" r="5"/><circle cx="48" cy="15" r="5"/></g>
  ${t(W / 2, 19, 'my-project', { size: 11, fill: C.dim, anchor: 'middle' })}
  <!-- activity bar -->
  <rect x="0" y="30" width="48" height="${winH - 52}" fill="${C.side}"/>
  <rect x="0" y="${30 + 4 * 44}" width="2" height="44" fill="${C.text}"/>
  <g fill="none" stroke="#858585" stroke-width="1.6">
    <rect x="15" y="42" width="16" height="20" rx="2"/>
    <circle cx="22" cy="95" r="7"/><path d="M27 100 L32 105"/>
    <circle cx="18" cy="134" r="3"/><circle cx="28" cy="146" r="3"/><path d="M18 137 V150 M28 143 C28 138 18 140 18 137"/>
    <path d="M16 176 L30 184 L16 192 Z"/>
  </g>
  <g fill="${C.text}"><rect x="14" y="218" width="8" height="8" rx="1"/><rect x="24" y="218" width="8" height="8" rx="1"/>
    <rect x="14" y="228" width="8" height="8" rx="1"/><rect x="26" y="216" width="8" height="8" rx="1" transform="rotate(45 30 220)"/></g>
  <!-- sidebar -->
  <rect x="48" y="30" width="262" height="${winH - 52}" fill="${C.side}"/>
  <rect x="309" y="30" width="1" height="${winH - 52}" fill="${C.border}"/>
  ${t(62, 56, 'EXTENSIONS', { size: 11, fill: C.text, weight: 600 })}
  <g fill="${C.text}"><circle cx="281" cy="52" r="1.6"/><circle cx="287" cy="52" r="1.6"/><circle cx="293" cy="52" r="1.6"/></g>
  <rect x="62" y="78" width="236" height="26" rx="3" fill="${C.input}" ${search || caret ? `stroke="${C.accent}"` : ''}/>
  ${searchText}
  ${caret ? `<rect x="${caretX}" y="84" width="1.2" height="14" fill="#E0E0E0"/>` : ''}
  ${sidebar}
  <!-- editor -->
  ${editor || t(475, 200, 'Ctrl+Shift+X  membuka Extensions', { size: 12, fill: '#5A5A5A', anchor: 'middle' })}
  <!-- status bar -->
  <rect x="0" y="${winH - 22}" width="${W}" height="22" fill="${C.side}"/>
  <rect x="0" y="${winH - 22}" width="${W}" height="1" fill="${C.border}"/>
  ${t(12, winH - 7, 'main', { size: 11, fill: C.dim })}
  ${status ? `<g><circle cx="${W - 92}" cy="${winH - 11}" r="3" fill="#23A55A"/>
    <path d="M${W - 99} ${winH - 17} A9 9 0 0 0 ${W - 99} ${winH - 5} M${W - 85} ${winH - 17} A9 9 0 0 1 ${W - 85} ${winH - 5}" fill="none" stroke="${C.text}" stroke-width="1.3"/>
    ${t(W - 78, winH - 7, 'Presence', { size: 11, fill: C.text })}</g>` : ''}
  ${overlay}
  <!-- keterangan langkah -->
  <rect x="0" y="${winH}" width="${W}" height="${capH}" fill="${C.blurple}"/>
  <circle cx="34" cy="${winH + capH / 2}" r="15" fill="#FFFFFF"/>
  ${t(34, winH + capH / 2 + 5.5, String(step), { size: 15, fill: C.blurple, weight: 800, anchor: 'middle' })}
  ${t(60, winH + capH / 2 + 5.5, caption, { size: 15, fill: '#FFFFFF', weight: 600 })}
</svg>`;
}

// Item ekstensi di daftar sidebar
function extItem(y, button) {
  const btn = button === 'install'
    ? `<rect x="250" y="${y + 40}" width="46" height="20" rx="2" fill="${C.accent}"/>${t(273, y + 54, 'Install', { size: 11, fill: '#FFFFFF', anchor: 'middle' })}`
    : button === 'installed'
      ? `<g fill="none" stroke="${C.text}" stroke-width="1.4"><circle cx="286" cy="${y + 50}" r="5"/><circle cx="286" cy="${y + 50}" r="1.6"/></g>`
      : '';
  return `<rect x="48" y="${y}" width="261" height="68" fill="${C.hover}"/>
  <image x="62" y="${y + 10}" width="42" height="42" href="${ICON}"/>
  ${t(114, y + 22, 'Animated Presence', { size: 13, fill: '#FFFFFF', weight: 600 })}
  ${t(114, y + 39, 'Animated Discord Rich Presence...', { size: 11, fill: C.dim })}
  ${t(114, y + 56, 'xyyxzxx', { size: 11, fill: C.text, weight: 600 })}
  ${btn}`;
}

const toast = (msg) => `<g>
  <rect x="${W - 352}" y="${H - 56 - 22 - 78}" width="340" height="66" rx="4" fill="#252526" stroke="#3C3C3C"/>
  <circle cx="${W - 330}" cy="${H - 56 - 22 - 54}" r="8" fill="${C.accent}"/>
  ${t(W - 330, H - 56 - 22 - 50, 'i', { size: 12, fill: '#FFFFFF', weight: 700, anchor: 'middle' })}
  ${t(W - 312, H - 56 - 22 - 50, msg[0], { size: 12, fill: C.text })}
  ${t(W - 312, H - 56 - 22 - 32, msg[1], { size: 12, fill: C.text })}
</g>`;

// Sorotan item "Presence" di status bar
const statusHighlight = () => `<rect x="${W - 106}" y="${H - 56 - 22}" width="100" height="22" rx="3" fill="none" stroke="#F0B232" stroke-width="2"/>
  <path d="M${W - 56} ${H - 56 - 30} L${W - 56} ${H - 56 - 58}" stroke="#F0B232" stroke-width="2"/>
  ${t(W - 12, H - 56 - 64, 'Terhubung ke Discord', { size: 12, fill: '#F0B232', weight: 600, anchor: 'end' })}`;

// Kartu presence Discord (versi ringkas)
function discordCard() {
  const large = png(path.join(ICONS, 'lang-typescript.png'));
  const small = png(path.join(ICONS, 'logo.png'));
  const x = 340;
  const y = 92;
  return `<defs><clipPath id="sm"><circle cx="${x + 92}" cy="${y + 124}" r="14"/></clipPath></defs>
  <rect x="${x}" y="${y}" width="280" height="190" rx="12" fill="#2B2D31" stroke="#3F4147"/>
  ${t(x + 18, y + 28, 'Playing', { size: 11, fill: '#B5BAC1', weight: 700 })}
  <image x="${x + 18}" y="${y + 42}" width="84" height="84" href="${large}"/>
  <circle cx="${x + 92}" cy="${y + 124}" r="17" fill="#2B2D31"/>
  <image x="${x + 78}" y="${y + 110}" width="28" height="28" href="${small}" clip-path="url(#sm)"/>
  ${t(x + 118, y + 62, 'Visual Studio Code', { size: 13, fill: '#F2F3F5', weight: 700 })}
  ${t(x + 118, y + 82, 'Editing app.ts', { size: 12, fill: '#DBDEE1' })}
  ${t(x + 118, y + 101, 'Line 42', { size: 12, fill: '#DBDEE1' })}
  ${t(x + 118, y + 120, '00:05 elapsed', { size: 11, fill: '#23A55A', weight: 600 })}
  <rect x="${x + 18}" y="${y + 144}" width="244" height="30" rx="6" fill="#4E5058"/>
  ${t(x + 140, y + 164, 'View Repository', { size: 12, fill: '#FFFFFF', weight: 600, anchor: 'middle' })}`;
}

// ---------- GIF 1: VS Code, install dari file .vsix ----------
const menuItems = ['Views', 'Check for Extension Updates', 'Enable All Extensions', 'Disable All Extensions', '-', 'Install from VSIX...'];
function menu(highlight) {
  let y = 66;
  let out = `<rect x="160" y="60" width="230" height="${menuItems.length * 24 - 8}" rx="5" fill="#252526" stroke="#454545"/>`;
  for (const item of menuItems) {
    if (item === '-') { out += `<rect x="168" y="${y + 3}" width="214" height="1" fill="#454545"/>`; y += 8; continue; }
    if (item === highlight) out += `<rect x="164" y="${y}" width="222" height="22" rx="3" fill="${C.accent}"/>`;
    out += t(176, y + 15, item, { size: 12, fill: item === highlight ? '#FFFFFF' : C.text });
    y += 24;
  }
  return out;
}

function fileDialog(selected) {
  const rows = ['Screenshot 2026-11-20.png', VSIX, 'notes.txt'];
  let out = `<rect x="330" y="60" width="290" height="230" rx="8" fill="#252526" stroke="#454545"/>
  ${t(346, 84, 'Install from VSIX', { size: 13, fill: '#FFFFFF', weight: 600 })}
  <rect x="346" y="96" width="258" height="22" rx="3" fill="${C.input}"/>
  ${t(354, 111, '~/Downloads', { size: 11, fill: C.text })}`;
  rows.forEach((r, i) => {
    const y = 128 + i * 28;
    if (r === selected) out += `<rect x="346" y="${y}" width="258" height="24" rx="3" fill="#04395E"/>`;
    out += `<rect x="354" y="${y + 6}" width="10" height="12" rx="1" fill="none" stroke="${C.dim}"/>`;
    out += t(372, y + 16, r, { size: 11, fill: r === selected ? '#FFFFFF' : C.text, weight: r === selected ? 600 : 400 });
  });
  out += `<rect x="530" y="250" width="74" height="26" rx="3" fill="${C.accent}"/>${t(567, 267, 'Install', { size: 12, fill: '#FFFFFF', anchor: 'middle' })}
  <rect x="448" y="250" width="74" height="26" rx="3" fill="#3C3C3C"/>${t(485, 267, 'Cancel', { size: 12, fill: C.text, anchor: 'middle' })}`;
  return out;
}

const vsixFrames = [
  { d: 2.2, svg: frame({ step: 1, caption: 'Buka Extensions (Ctrl+Shift+X), klik  ...', overlay: `<rect x="274" y="42" width="26" height="20" rx="4" fill="#3C3C3C"/><g fill="${C.text}"><circle cx="281" cy="52" r="1.6"/><circle cx="287" cy="52" r="1.6"/><circle cx="293" cy="52" r="1.6"/></g>${cursor(290, 55)}` }) },
  { d: 2.2, svg: frame({ step: 2, caption: 'Pilih "Install from VSIX..."', overlay: menu('Install from VSIX...') + cursor(300, 186) }) },
  { d: 2.4, svg: frame({ step: 3, caption: `Pilih file ${VSIX}, klik Install`, overlay: fileDialog(VSIX) + cursor(570, 266) }) },
  { d: 2.6, svg: frame({ step: 4, caption: 'Selesai! Status "Presence" muncul di bawah', sidebar: t(62, 128, 'INSTALLED', { size: 11, fill: C.text, weight: 600 }) + extItem(138, 'installed'), status: true,
    overlay: toast(['Completed installing Animated Presence', 'extension from VSIX.']) }) },
  { d: 3.4, svg: frame({ step: 5, caption: 'Presence langsung tampil di profil Discord', sidebar: t(62, 128, 'INSTALLED', { size: 11, fill: C.text, weight: 600 }) + extItem(138, 'installed'), status: true,
    editor: discordCard() }) },
];

// ---------- GIF 2: Antigravity / Cursor / Windsurf / VSCodium (Open VSX) ----------
const typed = ['Anim', 'Animated Pre', 'Animated Presence'];
const openvsxFrames = [
  { d: 0.9, svg: frame({ step: 1, caption: 'Buka Extensions, cari "Animated Presence"', search: typed[0], caret: true }) },
  { d: 0.9, svg: frame({ step: 1, caption: 'Buka Extensions, cari "Animated Presence"', search: typed[1], caret: true }) },
  { d: 1.6, svg: frame({ step: 1, caption: 'Buka Extensions, cari "Animated Presence"', search: typed[2], caret: true, sidebar: extItem(114, 'install') }) },
  { d: 2.2, svg: frame({ step: 2, caption: 'Klik Install', search: typed[2], sidebar: extItem(114, 'install'), overlay: cursor(276, 168) }) },
  { d: 2.6, svg: frame({ step: 3, caption: 'Selesai! Tidak perlu setting apa pun', search: typed[2], sidebar: extItem(114, 'installed'), status: true,
    overlay: statusHighlight() }) },
  { d: 3.4, svg: frame({ step: 4, caption: 'Presence langsung tampil di profil Discord', search: typed[2], sidebar: extItem(114, 'installed'), status: true, editor: discordCard() }) },
];

function buildGif(name, frames) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir);
  const list = [];
  frames.forEach((f, i) => {
    const svgPath = path.join(dir, `f${i}.svg`);
    const pngPath = path.join(dir, `f${i}.png`);
    fs.writeFileSync(svgPath, f.svg);
    execFileSync('rsvg-convert', ['-z', String(SCALE), '-o', pngPath, svgPath]);
    list.push(`file '${pngPath}'`, `duration ${f.d}`);
  });
  list.push(`file '${path.join(dir, `f${frames.length - 1}.png`)}'`); // concat butuh frame terakhir diulang
  const listPath = path.join(dir, 'list.txt');
  fs.writeFileSync(listPath, list.join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', 'fps=10,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none',
    '-loop', '0', path.join(MEDIA, `${name}.gif`)]);
}

fs.mkdirSync(MEDIA, { recursive: true });
buildGif('install-vsix', vsixFrames);
buildGif('install-openvsx', openvsxFrames);
fs.rmSync(TMP, { recursive: true, force: true });
console.log('Selesai: media/install-vsix.gif, media/install-openvsx.gif');
