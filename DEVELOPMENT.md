# Development

Panduan untuk pengembang dan publisher ekstensi. Pengguna biasa tidak perlu membaca ini.

## Struktur

| Path | Isi |
| --- | --- |
| [src/extension.js](src/extension.js) | Logika utama: koneksi, frame animasi, status bar |
| [src/ipc.js](src/ipc.js) | Klien Discord RPC lewat IPC (tanpa dependensi) |
| [src/agents.js](src/agents.js) | Deteksi AI agent |
| [src/repo.js](src/repo.js) | URL repo untuk tombol "View Repository" |
| [src/constants.js](src/constants.js) | Application ID Discord dan daftar ikon bahasa |
| [scripts/build-icons.js](scripts/build-icons.js) | Generator ikon ke `assets/discord/` |
| [scripts/build-preview.js](scripts/build-preview.js) | Generator gambar README ke `media/` |
| `assets/brand/logo.png` | Sumber logo (dipakai untuk `logo`, App Icon, dan ikon ekstensi) |

Ekstensi ini tidak punya dependensi npm. Tekan **F5** untuk menjalankan Extension Development Host.

## Aplikasi Discord

Application ID ada di `DEFAULT_CLIENT_ID` ([src/constants.js](src/constants.js)). Nama aplikasi Discord
menjadi teks *"Playing …"* di profil pengguna.

- **General Information → App Icon:** `assets/app-icon.png`
- **Rich Presence → Art Assets:** semua file di `assets/discord/` (50 PNG). Nama file adalah key-nya.
  Upload 3–5 file per kali agar tidak kena rate limit.

Cek kelengkapan asset:

```sh
curl -s "https://discord.com/api/v10/oauth2/applications/<APP_ID>/assets?nocache=true"
```

## Membuat ulang gambar

Butuh `rsvg-convert` (librsvg) dan `ffmpeg`.

```sh
node scripts/build-icons.js     # ikon Discord + ikon ekstensi
node scripts/build-preview.js   # media/demo.gif dan gambar README
```

Menambah bahasa: tambahkan ke `LANGUAGE_ICONS` di [src/constants.js](src/constants.js) dan `DEVICON_NAME` di
`build-icons.js`. Menambah agent: tambahkan ke `AGENTS` di [src/agents.js](src/agents.js) dan `AGENT_ICONS` di
`build-icons.js`. Setelah itu jalankan ulang skrip dan upload ikon barunya ke Discord.

## Paket dan publish

```sh
npx @vscode/vsce package                     # → animated-presence-x.y.z.vsix
npx @vscode/vsce publish                     # VS Code Marketplace (butuh publisher)
npx ovsx publish *.vsix -p <token>           # Open VSX (VSCodium, Cursor, Antigravity, dll.)
```

Sebelum publish ke Marketplace, isi `"publisher"` dan `"repository"` di `package.json`.
