const vscode = require('vscode');
const path = require('path');
const { DiscordIPC } = require('./ipc');
const { DEFAULT_CLIENT_ID, LANGUAGE_ICONS, LANGUAGE_ALIASES } = require('./constants');
const { AgentDetector } = require('./agents');
const { repoButtonUrl, getBranch } = require('./repo');

const CFG = 'animatedPresence';
const MIN_SEND_GAP = 5000; // jeda minimum antar pengiriman ke Discord

let client = null;
let ready = false;
let connecting = false;
let timer = null;
let reconnectTimer = null;
let pendingSend = null;
let lastSent = 0;
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

  const touch = () => { lastActivity = Date.now(); };
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

  send();
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
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
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
    spinner: pick(spinnerFrames, ['⠋']),
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

  // Gambar kecil yang ikut berganti tiap frame (ikon agent ikut disisipkan, tanpa duplikat)
  let smallFrames = c.get('smallImageFrames');
  if (!Array.isArray(smallFrames) || !smallFrames.length) smallFrames = [{ key: '{langIcon}', text: '{language}' }];
  if (agent) smallFrames = [...smallFrames, { key: '{agentIcon}', text: '{agent}' }];
  const seen = new Set();
  const resolved = smallFrames
    .filter((f) => f && f.key)
    .map((f) => ({ key: fill(f.key, vars), text: fill(f.text || '', vars) }))
    .filter((f) => f.key && !f.key.includes('{') && !seen.has(f.key) && seen.add(f.key));
  const small = resolved.length ? resolved[frame % resolved.length] : null;

  const activity = {
    details: details.slice(0, 128),
    state: state.slice(0, 128),
    timestamps: { start: sessionStart },
    assets: {
      large_image: c.get('largeImageKey') || 'logo',
      large_text: idle
        ? vars.editor
        : `${vars.editor} • ${vars.language}${agent ? ` • ${agent.name}` : ''}`,
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

// advance=true: maju ke frame animasi berikutnya (dari timer)
function send(advance = true) {
  if (!ready || !client) return;
  const wsName = vscode.workspace.name || vscode.workspace.workspaceFolders?.[0]?.name || '';
  if ((cfg().get('ignoredWorkspaces') || []).includes(wsName)) {
    client.clearActivity();
  } else {
    client.setActivity(buildActivity());
  }
  const agent = cfg().get('showAgent') ? agents.current() : null;
  status.tooltip = `Animated Presence: terhubung ke Discord\nAgent: ${
    agent ? `${agent.name}${agent.working ? ' (sedang menulis kode)' : ''} • via ${agent.source}` : 'tidak terdeteksi'}`;
  lastSent = Date.now();
  if (advance) frame++;
}

function deactivate() {
  stop();
}

module.exports = { activate, deactivate, _test: { buildActivity, setFrame: (n) => { frame = n; } } };
