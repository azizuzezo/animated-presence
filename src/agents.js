// Deteksi AI agent yang sedang dipakai.
// Sinyal (dari paling kuat):
//   1. Perintah CLI agent yang sedang berjalan di terminal (shell integration)
//   2. Tab panel agent yang sedang terlihat (mis. tab "Claude Code")
//   3. File diubah bukan dari editor yang sedang diketik -> agent sedang menulis kode
//   4. Editor turunan VS Code dengan agent bawaan (Antigravity, Cursor, Windsurf, ...)
const vscode = require('vscode');

// icon = asset key di aplikasi Discord (lihat scripts/build-icons.js)
const AGENTS = [
  { id: 'claude', name: 'Claude Code', ext: ['anthropic.claude-code'], cli: ['claude'], tab: /claude code/i },
  { id: 'codex', name: 'Codex', ext: ['openai.chatgpt'], cli: ['codex'], tab: /^codex/i },
  { id: 'copilot', name: 'GitHub Copilot', ext: ['github.copilot-chat', 'github.copilot'], cli: ['copilot'], tab: /copilot/i },
  { id: 'gemini', name: 'Gemini', ext: ['google.geminicodeassist'], cli: ['gemini'], tab: /gemini/i },
  { id: 'cline', name: 'Cline', ext: ['saoudrizwan.claude-dev'], cli: ['cline'], tab: /^cline/i },
  { id: 'roo', name: 'Roo Code', ext: ['rooveterinaryinc.roo-cline'], cli: [], tab: /^roo code/i },
  { id: 'kilo', name: 'Kilo Code', ext: ['kilocode.kilo-code'], cli: [], tab: /^kilo code/i },
  { id: 'continue', name: 'Continue', ext: ['continue.continue'], cli: ['cn'], tab: /^continue/i },
  { id: 'amazonq', name: 'Amazon Q', ext: ['amazonwebservices.amazon-q-vscode'], cli: ['q'], tab: /amazon q/i },
  { id: 'windsurf', name: 'Windsurf', ext: ['codeium.codeium', 'codeium.windsurf'], cli: [], tab: /^windsurf/i },
  { id: 'cursor', name: 'Cursor', ext: [], cli: ['cursor-agent'], tab: null },
  { id: 'qwen', name: 'Qwen Code', ext: [], cli: ['qwen'], tab: null },
  { id: 'aider', name: 'Aider', ext: [], cli: ['aider'], tab: null },
  { id: 'opencode', name: 'OpenCode', ext: [], cli: ['opencode'], tab: null },
  { id: 'antigravity', name: 'Antigravity', ext: [], cli: [], tab: null },
  { id: 'kiro', name: 'Kiro', ext: [], cli: [], tab: null },
  { id: 'trae', name: 'Trae', ext: [], cli: [], tab: null },
];
for (const a of AGENTS) a.icon = `agent-${a.id}`;
const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

// Editor turunan VS Code yang punya agent bawaan (dicocokkan dengan vscode.env.appName)
const HOST_APPS = [
  [/antigravity/i, 'antigravity'],
  [/cursor/i, 'cursor'],
  [/windsurf/i, 'windsurf'],
  [/kiro/i, 'kiro'],
  [/trae/i, 'trae'],
];

const SEEN_TTL = 2 * 60 * 1000; // agent dianggap "sedang dipakai" 2 menit setelah sinyal terakhir
const WORKING_TTL = 30 * 1000; // agent dianggap "sedang menulis kode" 30 detik setelah edit terakhir

class AgentDetector {
  constructor() {
    this.lastSeen = new Map(); // agentId -> timestamp
    this.running = new Map(); // TerminalShellExecution -> agentId
    this.lastAiEdit = 0;
    this.lastAiAgent = null;
    this.host = null;
    const app = vscode.env.appName || '';
    for (const [re, id] of HOST_APPS) if (re.test(app)) { this.host = BY_ID[id]; break; }
  }

  // onActivity: dipanggil saat agent terdeteksi aktif (agar presence tidak dianggap idle)
  register(context, onActivity) {
    const w = vscode.window;
    if (w.onDidStartTerminalShellExecution) {
      context.subscriptions.push(
        w.onDidStartTerminalShellExecution((e) => {
          const id = this._matchCommand(e.execution?.commandLine?.value);
          if (id) { this.running.set(e.execution, id); this._mark(id); onActivity(); }
        }),
        w.onDidEndTerminalShellExecution((e) => {
          const id = this.running.get(e.execution);
          if (id) { this.running.delete(e.execution); this._mark(id); }
        })
      );
    }
    this.onActivity = onActivity;
  }

  // Dipanggil untuk setiap onDidChangeTextDocument. true = perubahan dari agent, bukan ketikan user.
  handleEdit(e) {
    if (e.document.uri.scheme !== 'file' || !e.contentChanges.length) return false;
    if (e.reason !== undefined) return false; // undo/redo
    const w = vscode.window;
    const userEditing = w.activeTextEditor?.document === e.document && w.state.focused;
    // Saat CLI agent berjalan atau panel agent sedang fokus, editan dianggap dari agent
    const agentFocused = this.running.size > 0 || this._activeTabAgent() !== null;
    if (userEditing && !agentFocused) return false;

    const agent = this._guessEditingAgent();
    if (!agent) return false;
    this.lastAiEdit = Date.now();
    this.lastAiAgent = agent.id;
    this._mark(agent.id);
    this.onActivity?.();
    return true;
  }

  // Catat sinyal; hapus dulu agar urutan Map = urutan terbaru (penentu saat waktu sama)
  _mark(id) {
    this.lastSeen.delete(id);
    this.lastSeen.set(id, Date.now());
  }

  _tabAgent(tab) {
    if (!tab) return null;
    const viewType = (tab.input && tab.input.viewType ? String(tab.input.viewType) : '').toLowerCase();
    for (const a of AGENTS) {
      const byExt = viewType && a.ext.some((id) => viewType.includes(id));
      const byLabel = a.tab && tab.input instanceof vscode.TabInputWebview && a.tab.test(tab.label);
      if (byExt || byLabel) return a;
    }
    return null;
  }

  _activeTabAgent() {
    return this._tabAgent(vscode.window.tabGroups?.activeTabGroup?.activeTab);
  }

  _matchCommand(cmdLine) {
    if (!cmdLine) return null;
    // Lewati variabel env (FOO=bar), sudo, npx/bunx/pnpm dlx
    const tokens = cmdLine.trim().split(/\s+/);
    const skip = new Set(['sudo', 'npx', 'bunx', 'pnpx', 'env', 'exec', 'time']);
    for (let i = 0; i < tokens.length; i++) {
      let t = tokens[i];
      if (/^\w+=/.test(t) || skip.has(t) || t.startsWith('-')) continue;
      if ((t === 'pnpm' || t === 'yarn') && tokens[i + 1] === 'dlx') { i++; continue; }
      t = t.split(/[\\/]/).pop().replace(/\.(exe|cmd|ps1)$/i, '').replace(/@.*$/, '');
      if (t.startsWith('@')) t = t.split('/').pop();
      const pkgMap = { 'claude-code': 'claude', 'gemini-cli': 'gemini', 'qwen-code': 'qwen', 'aider-chat': 'aider' };
      if (pkgMap[t]) return pkgMap[t];
      const agent = AGENTS.find((a) => a.cli.includes(t));
      return agent ? agent.id : null;
    }
    return null;
  }

  _installedAgents() {
    return AGENTS.filter((a) => a.ext.some((id) => vscode.extensions.getExtension(id)));
  }

  _guessEditingAgent() {
    const now = Date.now();
    // Agent yang paling baru terlihat
    let best = null;
    for (const [id, t] of this.lastSeen) if (now - t < 10 * 60 * 1000 && (!best || t >= best.t)) best = { id, t };
    if (this.running.size) return BY_ID[[...this.running.values()].pop()];
    if (best) return BY_ID[best.id];
    if (this.host) return this.host;
    return this._installedAgents()[0] || null;
  }

  // Cek tab panel agent yang sedang terlihat di setiap grup editor
  _scanTabs() {
    const now = Date.now();
    for (const group of vscode.window.tabGroups?.all || []) {
      const a = this._tabAgent(group.activeTab);
      if (a) this._mark(a.id);
    }
  }

  // -> { name, icon, working, source } atau null
  current() {
    this._scanTabs();
    const now = Date.now();
    const working = now - this.lastAiEdit < WORKING_TTL;

    if (this.running.size) {
      const a = BY_ID[[...this.running.values()].pop()];
      return { ...a, working: true, source: 'terminal' };
    }
    let best = null;
    for (const [id, t] of this.lastSeen) if (now - t < SEEN_TTL && (!best || t >= best.t)) best = { id, t };
    if (best) {
      const a = BY_ID[best.id];
      return { ...a, working: working && this.lastAiAgent === a.id, source: 'recent' };
    }
    if (this.host) return { ...this.host, working, source: 'editor' };
    return null;
  }
}

module.exports = { AgentDetector, AGENTS };
