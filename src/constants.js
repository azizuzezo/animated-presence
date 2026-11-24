// Application ID Discord milik pembuat ekstensi.
// Isi SEKALI sebelum publish, supaya pengguna lain tidak perlu setup apa pun.
// Dapatkan di https://discord.com/developers/applications → New Application → salin "Application ID".
// Nama aplikasi = teks setelah "Playing ..." di profil Discord (mis. "Visual Studio Code").
const DEFAULT_CLIENT_ID = '1574825884290916463';

// languageId VS Code yang punya ikon "lang-<nama>" di Art Assets aplikasi Discord.
// Bahasa lain memakai ikon "lang-file".
const LANGUAGE_ICONS = new Set([
  'javascript', 'typescript', 'react', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust',
  'php', 'ruby', 'html', 'css', 'scss', 'json', 'markdown', 'shellscript', 'lua', 'dart',
  'kotlin', 'swift', 'vue', 'svelte', 'sql', 'yaml', 'dockerfile',
]);

const LANGUAGE_ALIASES = {
  javascriptreact: 'react',
  typescriptreact: 'react',
  jsonc: 'json',
  sass: 'scss',
  less: 'css',
  bat: 'shellscript',
  powershell: 'shellscript',
};

module.exports = { DEFAULT_CLIENT_ID, LANGUAGE_ICONS, LANGUAGE_ALIASES };
