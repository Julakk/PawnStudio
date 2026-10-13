# Ekstensi PawnStudio

Ekstensi adalah file JSON berisi **data** (snippet, tema editor, daftar include). Tidak ada kode yang dijalankan.

Pasang lewat ikon puzzle di activity bar: **Impor file .json**, atau **GitHub** `owner/repo`
(app mengambil `pawnstudio-extension.json` dari root repo).

```json
{
  "id": "contoh-saya",
  "name": "Ekstensi Contoh",
  "version": "1.0.0",
  "author": "nama",
  "description": "Snippet dan tema contoh",
  "snippets": [
    { "prefix": "ocon", "description": "OnPlayerConnect",
      "body": ["public OnPlayerConnect(playerid)", "{", "\t$0", "\treturn 1;", "}"] }
  ],
  "themes": [
    { "id": "gelap-saya", "name": "Gelap Saya", "base": "vs-dark",
      "colors": { "editor.background": "#101820", "editor.foreground": "#e0e0e0" },
      "rules": [
        { "token": "comment", "foreground": "#6a8a6a", "fontStyle": "italic" },
        { "token": "keyword", "foreground": "#ff8c42" }
      ] }
  ],
  "includes": [
    { "id": "contoh-lib", "name": "Contoh Library", "repo": "owner/repo", "mode": "release" }
  ]
}
```

Aturan:
- `id`: huruf kecil, angka, `.` `_` `-` (maks 40). Id yang sama dengan ekstensi bawaan ditolak.
- `snippets`: maks 300. `body` boleh teks atau array baris; mendukung placeholder Monaco (`${1:nama}`, `$0`).
- `themes`: maks 20. Warna wajib `#rrggbb` (`colors` boleh `#rrggbbaa`). `base`: `vs-dark`, `vs`, atau `hc-black`.
- `includes`: maks 8. `repo` format `owner/repo`; `mode`: `release` atau `head`. Diunduh ke `pawno/include` proyek.
- Ukuran file maksimal 500 KB.
