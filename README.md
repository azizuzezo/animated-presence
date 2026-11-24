<p align="center">
  <img src="assets/icon.png" width="128" alt="Animated Presence logo">
</p>

<h1 align="center">Animated Presence</h1>

<p align="center">
  <b>Discord Rich Presence untuk VS Code yang hidup dan bergerak.</b><br>
  Tunjukkan file yang kamu kerjakan, bahasa yang kamu pakai, dan AI agent yang sedang membantu, lengkap dengan animasi.
</p>

<p align="center">
  <img src="media/demo.gif" width="600" alt="Contoh presence Animated Presence di profil Discord">
</p>

<p align="center"><i>Contoh tampilan di profil Discord. Di Discord, setiap frame berganti tiap 15 detik.</i></p>

---

## Fitur

- **Tanpa setup.** Install, buka VS Code, dan presence langsung muncul. Tidak perlu token, login, atau Client ID.
- **Teks animatif.** Baris presence bergantian: file → workspace → bahasa → AI agent, dengan spinner dan progress bar `▰▰▰▱▱▱▱▱`.
- **Gambar kecil berganti.** Ikon bahasa (27 bahasa), status aktivitas (*typing*, *reading*, *debugging*, *idle*), dan logo AI agent tampil bergantian.
- **Deteksi AI agent.** Presence tahu saat kamu memakai Claude Code, Codex, Copilot, Gemini, Cline, Antigravity, Cursor, dan agent lain.
- **Tombol "View Repository".** Otomatis mengarah ke repo GitHub atau GitLab proyekmu, dan hanya muncul untuk repo publik.
- **Ramah privasi.** Nama file dan workspace bisa disembunyikan, dan workspace tertentu bisa diabaikan.
- **Semua versi Discord.** Discord, Canary, Flatpak, Snap, dan Vesktop di Windows, macOS, dan Linux.

## Contoh tampilan

<table>
  <tr>
    <td align="center" width="50%">
      <img src="media/card-agent.png" alt="Saat AI agent menulis kode"><br>
      <b>AI agent sedang menulis kode</b><br>
      <sub>Terdeteksi dari <code>claude</code> di terminal, logo Claude di gambar kecil.</sub>
    </td>
    <td align="center" width="50%">
      <img src="media/card-debug.png" alt="Saat debugging"><br>
      <b>Debugging</b><br>
      <sub>Ikon berubah otomatis saat sesi debug aktif.</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="media/card-idle.png" alt="Saat idle"><br>
      <b>Idle</b><br>
      <sub>Setelah 5 menit tanpa aktivitas.</sub>
    </td>
    <td align="center" width="50%">
      <img src="media/icons.png" alt="Semua ikon"><br>
      <b>50 ikon bawaan</b><br>
      <sub>Bahasa, aktivitas, dan AI agent.</sub>
    </td>
  </tr>
</table>

## Instalasi

**Dari file `.vsix`:** buka panel Extensions (`Ctrl+Shift+X`), klik menu **⋯** → **Install from VSIX…**, lalu pilih file `animated-presence-x.y.z.vsix`.

Atau lewat terminal:

```sh
code --install-extension animated-presence-0.1.0.vsix
```

Pastikan **aplikasi Discord desktop** sedang berjalan. Versi browser tidak bisa menerima presence dari aplikasi lain.
Di Discord, aktifkan **User Settings → Activity Privacy → Share your detected activities with others**.

## Deteksi AI agent

| Cara deteksi | Agent |
| --- | --- |
| Perintah di terminal VS Code | `claude`, `codex`, `gemini`, `copilot`, `qwen`, `aider`, `opencode`, `cursor-agent`, `q` |
| Tab panel agent yang terbuka | Claude Code, Codex, Copilot, Gemini, Cline, Roo Code, Kilo Code, Continue, Amazon Q |
| File berubah bukan dari ketikanmu | Diatribusikan ke agent terakhir yang terdeteksi atau ekstensi agent yang terpasang |
| Editor bawaan | Antigravity, Cursor, Windsurf, Kiro, Trae |

Agent dianggap aktif selama 2 menit setelah sinyal terakhir. Arahkan kursor ke item **Presence** di status bar untuk melihat agent yang sedang terdeteksi.

## Tombol "View Repository"

Tombol mengarah ke remote `origin` workspace. Format SSH diubah otomatis ke HTTPS, dan token di URL selalu dibuang.
Secara default tombol **hanya muncul untuk repo publik**, supaya nama repo private tidak bocor.

> Discord tidak menampilkan tombol di presence milikmu sendiri. Hanya orang lain yang bisa melihat dan mengkliknya.

## Pengaturan

Semua pengaturan opsional. Buka **Settings** dan cari `Animated Presence`.

| Setting | Default | Fungsi |
| --- | --- | --- |
| `animatedPresence.enabled` | `true` | Aktif atau nonaktif |
| `animatedPresence.frameInterval` | `15` | Detik antar frame (minimum 15, batas Discord) |
| `animatedPresence.detailsFrames` | `["Editing {file}", …]` | Frame baris pertama |
| `animatedPresence.stateFrames` | `["{spinner} Line {line}", …]` | Frame baris kedua |
| `animatedPresence.smallImageFrames` | ikon bahasa + aktivitas | Frame gambar kecil |
| `animatedPresence.spinnerFrames` | spinner Braille | Karakter spinner |
| `animatedPresence.showAgent` | `true` | Deteksi AI agent |
| `animatedPresence.agentFrames` | `["🤖 Coding with {agent}"]` | Frame saat agent terdeteksi |
| `animatedPresence.agentWorkingFrames` | `["⚡ {agent} is writing code"]` | Frame saat agent mengedit file |
| `animatedPresence.repoButton` | `"public"` | `public` / `always` / `off` |
| `animatedPresence.repoButtonLabel` | `"View Repository"` | Teks tombol repo |
| `animatedPresence.buttons` | `[]` | Tombol tambahan (maks 2 termasuk tombol repo) |
| `animatedPresence.showFileName` | `true` | Tampilkan nama file |
| `animatedPresence.showWorkspace` | `true` | Tampilkan nama workspace dan tombol repo |
| `animatedPresence.ignoredWorkspaces` | `[]` | Workspace yang tidak ditampilkan |
| `animatedPresence.idleTimeout` | `300` | Detik tanpa aktivitas sebelum idle (`0` = mati) |
| `animatedPresence.idleText` | `"💤 Idle..."` | Teks saat idle |

**Placeholder:** `{file}` `{workspace}` `{language}` `{line}` `{branch}` `{spinner}` `{bar}` `{percent}` `{elapsed}` `{activity}` `{agent}` `{editor}`

<details>
<summary><b>Contoh kustomisasi</b></summary>

```jsonc
{
  "animatedPresence.detailsFrames": ["Editing {file}", "🌿 {branch}", "{language} dev"],
  "animatedPresence.stateFrames": ["{spinner} Line {line}", "{bar} {percent}%"],
  "animatedPresence.spinnerFrames": ["◐", "◓", "◑", "◒"],
  "animatedPresence.agentFrames": ["🤖 Vibe coding with {agent}"],
  "animatedPresence.buttons": [{ "label": "My Portfolio", "url": "https://example.com" }],

  // Mode privasi
  "animatedPresence.showFileName": false,
  "animatedPresence.showWorkspace": false
}
```

</details>

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `Animated Presence: Enable` | Aktifkan presence |
| `Animated Presence: Disable` | Matikan dan hapus presence |
| `Animated Presence: Reconnect to Discord` | Sambungkan ulang (atau klik item **Presence** di status bar) |

## Troubleshooting

<details>
<summary><b>Presence tidak muncul</b></summary>

1. Pastikan aplikasi Discord **desktop** sedang berjalan, bukan versi browser.
2. Aktifkan **User Settings → Activity Privacy → Share your detected activities with others**.
3. Cek ikon **Presence** di status bar. Kalau muncul ikon terputus, klik untuk menyambung ulang.
4. Pengguna Flatpak atau Snap: buka Discord dulu, baru buka VS Code.

</details>

<details>
<summary><b>Tombol "View Repository" tidak terlihat</b></summary>

Discord menyembunyikan tombol di presence milikmu sendiri, jadi cek dari akun lain.
Pastikan juga repo-nya publik, atau ubah `repoButton` ke `"always"`.

</details>

<details>
<summary><b>Animasinya lambat</b></summary>

Discord membatasi update presence sekitar sekali per 15 detik, jadi setiap frame tampil selama 15 detik.
Batas ini berasal dari Discord dan tidak bisa dipercepat.

</details>

## Kredit

- Ikon bahasa: [Devicon](https://devicon.dev) (MIT)
- Logo AI agent: [Simple Icons](https://simpleicons.org) (CC0)
- Emoji di gambar contoh: [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0)

Discord, Visual Studio Code, dan nama atau logo AI agent adalah merek dagang milik pemiliknya masing-masing.
Ekstensi ini tidak berafiliasi dengan mereka.

## Lisensi

[MIT](LICENSE)
