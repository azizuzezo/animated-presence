// URL repository dari remote git, untuk tombol "View Repository".
const vscode = require('vscode');

const visibility = new Map(); // url -> true (publik) | false (private/tidak bisa diakses) | 'pending'

function gitApi() {
  try {
    return vscode.extensions.getExtension('vscode.git')?.exports?.getAPI(1) || null;
  } catch { return null; }
}

// Repo yang berisi file aktif, atau repo pertama di workspace
function currentRepo(uri) {
  const git = gitApi();
  if (!git) return null;
  return (uri && git.getRepository?.(uri)) || git.repositories?.[0] || null;
}

// git@github.com:user/repo.git, ssh://git@host:22/user/repo, https://user@host/user/repo.git -> https://host/user/repo
function toWebUrl(remote) {
  if (!remote) return null;
  let s = String(remote).trim();
  let m = s.match(/^[\w.-]+@([\w.-]+):(?!\/)(.+)$/); // scp-like ssh
  if (m) s = `https://${m[1]}/${m[2]}`;
  m = s.match(/^(?:ssh|git):\/\/(?:[^@/]+@)?([\w.-]+)(?::\d+)?\/(.+)$/);
  if (m) s = `https://${m[1]}/${m[2]}`;
  let url;
  try { url = new URL(s); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // Susun ulang hanya dari origin + path, jadi bagian user@ di URL tidak ikut
  const pathname = url.pathname.replace(/\.git\/?$/, '').replace(/\/+$/, '');
  if (pathname.split('/').filter(Boolean).length < 2) return null;
  return `${url.origin}${pathname}`;
}

function remoteUrl(repo) {
  const remotes = repo?.state?.remotes || [];
  const r = remotes.find((x) => x.name === 'origin') || remotes[0];
  return toWebUrl(r?.fetchUrl || r?.pushUrl);
}

// Cek tanpa login: repo private di GitHub/GitLab/Bitbucket mengembalikan 404/302 ke login
function checkPublic(url, onDone) {
  if (visibility.has(url)) return;
  visibility.set(url, 'pending');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'animated-presence' } })
    .then((res) => { visibility.set(url, res.status === 200); })
    .catch(() => { visibility.delete(url); }) // jaringan gagal -> coba lagi nanti
    .finally(() => { clearTimeout(t); onDone?.(); });
}

// mode: 'public' | 'always' | 'off'
function repoButtonUrl(uri, mode, onChecked) {
  if (mode === 'off') return null;
  const url = remoteUrl(currentRepo(uri));
  if (!url) return null;
  if (mode === 'always') return url;
  const v = visibility.get(url);
  if (v === undefined) checkPublic(url, onChecked);
  return v === true ? url : null;
}

function getBranch(uri) {
  return currentRepo(uri)?.state?.HEAD?.name || '';
}

module.exports = { repoButtonUrl, getBranch, toWebUrl };
