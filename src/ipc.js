// Klien Discord RPC minimal lewat IPC (tanpa dependensi).
// Protokol: header 8 byte [opcode int32LE, length int32LE] + payload JSON.
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function candidatePaths() {
  if (process.platform === 'win32') {
    return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  }
  const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env;
  const bases = [...new Set([XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP, '/tmp'].filter(Boolean))];
  // Lokasi Discord biasa, Flatpak, Snap, dan Vesktop
  const subdirs = ['', 'app/com.discordapp.Discord', 'app/com.discordapp.DiscordCanary', 'snap.discord', 'snap.discord-canary', 'app/dev.vencord.Vesktop', '.flatpak/dev.vencord.Vesktop/xdg-run'];
  const out = [];
  for (let i = 0; i < 10; i++) {
    for (const base of bases) {
      for (const sub of subdirs) out.push(path.join(base, sub, `discord-ipc-${i}`));
    }
  }
  return out;
}

function tryConnect(p) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(p);
    const onErr = (e) => { sock.destroy(); reject(e); };
    sock.once('error', onErr);
    sock.once('connect', () => { sock.off('error', onErr); resolve(sock); });
  });
}

class DiscordIPC extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.sock = null;
    this.buf = Buffer.alloc(0);
  }

  async connect() {
    let sock = null;
    for (const p of candidatePaths()) {
      try { sock = await tryConnect(p); break; } catch { /* coba path berikutnya */ }
    }
    if (!sock) throw new Error('Discord tidak ditemukan');
    this.sock = sock;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Handshake timeout')), 10000);
      sock.on('data', (d) => this._onData(d));
      sock.on('close', () => { this.sock = null; this.emit('close'); });
      sock.on('error', () => {});
      this.once('ready', () => { clearTimeout(timeout); resolve(); });
      this.once('close', () => { clearTimeout(timeout); reject(new Error('Koneksi ditutup Discord')); });
      this._send(OP.HANDSHAKE, { v: 1, client_id: this.clientId });
    });
  }

  _send(op, data) {
    if (!this.sock) return;
    const json = Buffer.from(JSON.stringify(data), 'utf8');
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(json.length, 4);
    this.sock.write(Buffer.concat([header, json]));
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0);
      const len = this.buf.readInt32LE(4);
      if (this.buf.length < 8 + len) break;
      let msg = {};
      try { msg = JSON.parse(this.buf.subarray(8, 8 + len).toString('utf8')); } catch { /* abaikan */ }
      this.buf = this.buf.subarray(8 + len);
      this.emit('message', op, msg);

      if (op === OP.PING) this._send(OP.PONG, msg);
      else if (op === OP.CLOSE) this.destroy();
      else if (op === OP.FRAME) {
        if (msg.evt === 'READY') this.emit('ready', msg.data);
        else if (msg.evt === 'ERROR') this.emit('rpcError', msg.data);
      }
    }
  }

  setActivity(activity) {
    this._send(OP.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: activity || undefined },
      nonce: crypto.randomUUID(),
    });
  }

  clearActivity() {
    this.setActivity(null);
  }

  destroy() {
    if (this.sock) {
      const s = this.sock;
      this.sock = null;
      s.destroy();
    }
    this.removeAllListeners();
  }
}

module.exports = { DiscordIPC };
