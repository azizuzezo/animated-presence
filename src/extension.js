const vscode = require('vscode');
const path = require('path');
const { DiscordIPC } = require('./ipc');
const { DEFAULT_CLIENT_ID, DEFAULT_LOGO, LANGUAGE_ICONS, LANGUAGE_ALIASES } = require('./constants');
const { AgentDetector } = require('./agents');
const { repoButtonUrl, getBranch } = require('./repo');

const CFG = 'animatedPresence';
const MIN_SEND_GAP = 4000; // jeda minimum antar update (Discord: maks 5 update per 20 detik)

let client = null;
let ready = false;
let connecting = false;
let timer = null;
let reconnectTimer = null;
let pendingSend = null;
let lastSent = 0;
let lastPayload = null;
let frame = 0;
let sessionStart = Date.now();
let lastActivity = Date.now();
let lastEdit = 0;
let lastEditor = null; // editor teks terakhir (saat fokus di panel agent/terminal, activeTextEditor kosong)
let agents;
let status;

const cfg = () => vscode.workspace.getConfiguration(CFG);

function activate(context) {
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -100);
  status.command = `${CFG}.reconnect`;
  context.subscriptions.push(status);

  // Setiap aktivitas (kursor, ketikan, agent) langsung memicu update presence (di-throttle)
  const touch = () => { lastActivity = Date.now(); requestSend(); };
  lastEditor = vscode.window.activeTextEditor || null;
  agents = new AgentDetector();
  agents.register(context, touch);

  context.subscriptions.push(
    vscode.commands.registerCommand(`${CFG}.enable`, async () => {
      await cfg().update('enabled', true, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand(`${CFG}.disable`, async () => {
      await cfg().update('enabled', false, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand(`${CFG}.reconnect`, () => { stop(); start(); }),
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed && ed.document.uri.scheme !== 'output') lastEditor = ed;
      touch();
      requestSend();
    }),
    vscode.window.onDidChangeTextEditorSelection(touch),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (agents.handleEdit(e)) return; // editan dari AI agent, bukan ketikan user
      if (e.document === vscode.window.activeTextEditor?.document) { touch(); lastEdit = Date.now(); }
    }),
    vscode.debug.onDidStartDebugSession(() => requestSend()),
    vscode.debug.onDidTerminateDebugSession(() => requestSend()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CFG)) { stop(); start(); }
    })
  );

  start();
}

// ---------- koneksi ----------

function getClientId() {
  return (cfg().get('clientId') || '').trim() || DEFAULT_CLIENT_ID;
}

function start() {
  if (!cfg().get('enabled')) return updateStatus('off');
  const clientId = getClientId();
  if (!clientId) {
    updateStatus('noid');
    return;
  }
  connect(clientId);
}

async function connect(clientId) {
  if (connecting || ready) return;
  connecting = true;
  updateStatus('connecting');

  const c = new DiscordIPC(clientId);
  client = c;
  try {
    await c.connect();
  } catch {
    if (client === c) { cleanup(); scheduleReconnect(); }
    return;
  }
  if (client !== c) return c.destroy(); // dihentikan selagi menyambung

  ready = true;
  connecting = false;
  sessionStart = Date.now();
  updateStatus('on');
  c.on('close', () => { if (client === c) { cleanup(); scheduleReconnect(); } });

  send(false); // frame pertama, tanpa memajukan animasi
  const ms = Math.max(15, cfg().get('frameInterval') || 15) * 1000;
  timer = setInterval(send, ms);
}

function scheduleReconnect() {
  if (!cfg().get('enabled') || reconnectTimer) return;
  updateStatus('waiting');
  reconnectTimer = setTimeout(() => { reconnectTimer = null; start(); }, 20000);
}

function cleanup() {
  ready = false;
  connecting = false;
  lastPayload = null; // setelah sambung ulang, kirim ulang presence
  if (timer) { clearInterval(timer); timer = null; }
  if (pendingSend) { clearTimeout(pendingSend); pendingSend = null; }
  if (client) { const c = client; client = null; c.destroy(); }
}

function stop() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (client && ready) client.clearActivity();
  cleanup();
  updateStatus('off');
}

function updateStatus(s) {
  const map = {
    on: ['$(broadcast) Presence', 'Animated Presence: terhubung ke Discord'],
    connecting: ['$(sync~spin) Presence', 'Menghubungkan ke Discord...'],
    waiting: ['$(debug-disconnect) Presence', 'Discord tidak ditemukan, mencoba lagi tiap 20 detik (klik untuk coba sekarang)'],
    noid: ['$(warning) Presence', 'Client ID belum diatur. Isi animatedPresence.clientId'],
    off: ['$(circle-slash) Presence', 'Nonaktif'],
  };
  const [text, tip] = map[s];
  status.text = text;
  status.tooltip = tip;
  status.show();
}

// Kirim segera, tapi jaga jarak minimum agar tidak kena rate limit Discord.
function requestSend() {
  if (!ready || pendingSend) return;
  const wait = Math.max(0, MIN_SEND_GAP - (Date.now() - lastSent));
  pendingSend = setTimeout(() => { pendingSend = null; send(false); }, wait);
}

// ---------- animasi ----------

function formatElapsed(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function progressBar(pct, len = 8) {
  const filled = Math.round((pct / 100) * len);
  return '\u25b0'.repeat(filled) + '\u25b1'.repeat(len - filled);
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

function frameList(arr, fallback) {
  return Array.isArray(arr) && arr.length ? arr : fallback;
}

// Isi placeholder, buang yang kosong/duplikat, lalu ambil frame saat ini (melewati `avoid`)
function pickImage(list, vars, avoid) {
  const seen = new Set();
  const resolved = list
    .filter((f) => f && f.key)
    .map((f) => ({ key: fill(f.key, vars), text: fill(f.text || '', vars) }))
    .filter((f) => f.key && !f.key.includes('{') && !seen.has(f.key) && seen.add(f.key));
  if (!resolved.length) return null;
  const start = frame % resolved.length;
  for (let i = 0; i < resolved.length; i++) {
    const f = resolved[(start + i) % resolved.length];
    if (f.key !== avoid) return f;
  }
  return null;
}

function pick(arr, fallback = ['']) {
  const list = Array.isArray(arr) && arr.length ? arr : fallback;
  return list[frame % list.length];
}


function langIcon(languageId) {
  const id = LANGUAGE_ALIASES[languageId] || languageId;
  return LANGUAGE_ICONS.has(id) ? `lang-${id}` : 'lang-file';
}

// typing / reading / debugging / idle / agent bekerja
function currentActivity(idle, agent) {
  if (vscode.debug.activeDebugSession) return { key: 'debugging', label: 'Debugging' };
  if (agent && agent.working) return { key: agent.icon, label: `${agent.name} working` };
  if (idle) return { key: 'idle', label: 'Idle' };
  if (Date.now() - lastEdit < 30000) return { key: 'typing', label: 'Typing' };
  return { key: 'reading', label: 'Reading' };
}

function buildActivity() {
  const c = cfg();
  const editor = vscode.window.activeTextEditor
    || (lastEditor && !lastEditor.document.isClosed ? lastEditor : undefined);
  const wsName = vscode.workspace.name || vscode.workspace.workspaceFolders?.[0]?.name || '';
  const idleTimeout = c.get('idleTimeout') || 0;
  const agent = c.get('showAgent') ? agents.current() : null;
  const idle = !editor || (!(agent && agent.working)
    && idleTimeout > 0 && Date.now() - lastActivity > idleTimeout * 1000);
  const act = currentActivity(idle, agent);
  const spinnerFrames = c.get('spinnerFrames');

  const vars = {
    workspace: c.get('showWorkspace') ? wsName || 'No workspace' : 'a project',
    elapsed: formatElapsed(Date.now() - sessionStart),
    spinner: pick(spinnerFrames, ['\u280b']),
    activity: act.label,
    activityIcon: act.key,
    branch: getBranch(editor?.document.uri) || 'no-branch',
    agent: agent ? agent.name : '',
    agentIcon: agent ? agent.icon : '',
    editor: vscode.env.appName || 'VS Code',
  };

  let details;
  let state;
  if (idle) {
    details = c.get('idleText');
    state = wsName && c.get('showWorkspace') ? wsName : `${vars.elapsed} session`;
    vars.language = 'idle';
    vars.langIcon = 'idle';
  } else {
    const doc = editor.document;
    const total = Math.max(1, doc.lineCount);
    const line = editor.selection.active.line + 1;
    const pct = Math.min(100, Math.round((line / total) * 100));
    Object.assign(vars, {
      file: c.get('showFileName') ? path.basename(doc.fileName) : 'a file',
      language: doc.languageId,
      langIcon: langIcon(doc.languageId),
      line: String(line),
      bar: progressBar(pct),
      percent: String(pct),
    });
    let detailsFrames = c.get('detailsFrames');
    if (!Array.isArray(detailsFrames) || !detailsFrames.length) detailsFrames = ['Editing {file}'];
    // Frame agent disisipkan ke putaran animasi
    if (agent) {
      const extra = agent.working ? c.get('agentWorkingFrames') : c.get('agentFrames');
      if (Array.isArray(extra)) detailsFrames = [...detailsFrames, ...extra];
    }
    details = fill(pick(detailsFrames), vars);
    state = fill(pick(c.get('stateFrames'), ['{spinner} Line {line}']), vars);
  }

  // Gambar besar & kecil berganti tiap frame.
  // Default: besar = ikon bahasa (+ ikon agent), kecil = logo aplikasi <-> ikon aktivitas. Saat idle: besar = logo, kecil = idle.
  vars.logo = (c.get('largeImageKey') || '').trim() || DEFAULT_LOGO;
  const largeList = idle
    ? [{ key: '{logo}', text: '{editor}' }]
    : [...frameList(c.get('largeImageFrames'), [{ key: '{langIcon}', text: '{language}' }]),
      ...(agent ? [{ key: '{agentIcon}', text: '{agent}' }] : [])];
  const smallList = idle
    ? [{ key: 'idle', text: 'Idle' }]
    : frameList(c.get('smallImageFrames'), [{ key: '{logo}', text: '{editor}' }]);
  const large = pickImage(largeList, vars) || { key: vars.logo, text: vars.editor };
  // Jangan tampilkan gambar yang sama di besar & kecil sekaligus
  const small = pickImage(smallList, vars, large.key);

  const activity = {
    details: details.slice(0, 128),
    state: state.slice(0, 128),
    timestamps: { start: sessionStart },
    assets: {
      large_image: large.key,
      large_text: large.text.slice(0, 128) || undefined,
    },
    instance: false,
  };
  if (small) {
    activity.assets.small_image = small.key;
    activity.assets.small_text = small.text.slice(0, 128) || undefined;
  }

  // Tombol "View Repository" otomatis dari remote git, lalu tombol kustom (Discord: maks 2)
  const buttons = [];
  // Mode privasi (showWorkspace: false) juga menyembunyikan repo
  const repoUrl = c.get('showWorkspace')
    ? repoButtonUrl(editor?.document.uri, c.get('repoButton'), requestSend)
    : null;
  if (repoUrl) buttons.push({ label: c.get('repoButtonLabel') || 'View Repository', url: repoUrl });
  for (const b of c.get('buttons') || []) {
    if (b && b.label && /^https?:\/\//.test(b.url)) buttons.push({ label: b.label, url: b.url });
  }
  if (buttons.length) {
    activity.buttons = buttons.slice(0, 2).map((b) => ({ label: String(b.label).slice(0, 32), url: b.url.slice(0, 512) }));
  }

  return activity;
}

// advance=true: maju ke frame animasi berikutnya (dari timer).
// advance=false: update langsung karena ada perubahan (kursor, ketikan, pindah file), frame tetap.
function send(advance = true) {
  if (!ready || !client) return;
  if (advance) frame++;
  const wsName = vscode.workspace.name || vscode.workspace.workspaceFolders?.[0]?.name || '';
  if ((cfg().get('ignoredWorkspaces') || []).includes(wsName)) {
    if (lastPayload !== 'cleared') client.clearActivity();
    lastPayload = 'cleared';
  } else {
    const activity = buildActivity();
    const payload = JSON.stringify(activity);
    if (!advance && payload === lastPayload) return; // tidak ada yang berubah, hemat jatah update
    client.setActivity(activity);
    lastPayload = payload;
  }
  const agent = cfg().get('showAgent') ? agents.current() : null;
  status.tooltip = `Animated Presence: terhubung ke Discord\nAgent: ${
    agent ? `${agent.name}${agent.working ? ' (sedang menulis kode)' : ''} \u2022 via ${agent.source}` : 'tidak terdeteksi'}`;
  lastSent = Date.now();
}

function deactivate() {
  stop();
}

module.exports = {
  activate,
  deactivate,
  // Hanya untuk pengujian
  _test: { buildActivity, send, setFrame: (n) => { frame = n; }, attach: (c) => { client = c; ready = true; } },
};
