# PawnStudio

![Versi](https://img.shields.io/badge/versi-1.5.0-9b6bd6) ![Platform](https://img.shields.io/badge/platform-Android-3ddc84)

Mobile code editor untuk bahasa **PAWN**, dibangun khusus buat komunitas SA-MP / Open.MP yang mau ngoding langsung dari Android — gak perlu buka laptop.

Dibangun pakai HTML, CSS, dan JavaScript murni, dibungkus jadi APK Android lewat [Capacitor](https://capacitorjs.com/).

## ✨ Fitur

- **Monaco Editor** — engine editor yang sama kayak dipakai VSCode
- **Syntax highlighting PAWN** — keyword, string, comment, angka, dan function call punya warna sendiri
- **File Explorer** — bikin, buka, dan hapus file/folder langsung dari sidebar
- **Multi-tab** — buka beberapa file `.pwn` sekaligus, ada indikator unsaved changes
- **Compiler PAWN bawaan** — tekan tombol Run, hasil compile tampil di Output Panel (error/warning bisa diketuk buat lompat ke baris)
- **Status bar informatif** — status compile, badge error/warning, posisi kursor, dan tombol toggle Word Wrap
- **Bar simbol di atas keyboard** — `{ } ; ( ) [ ] # < >` dan Tab, tinggal ketuk tanpa gonta-ganti layout keyboard
- **Explorer rapi** — ikon per tipe file, file binary (`.dll`/`.exe`/`.so`) diredupkan
- **Auto build APK** — tiap push ke `main`, GitHub Actions otomatis build APK dan bikin Release
- **Compiler pawncc native** — compile `.pwn` langsung di HP, hasil `.amx` ke folder `compiled/`, plus diagnosa include dan auto-fix beda huruf besar/kecil path
- **Panel output** — error dan warning compile tampil di app
- **Pengaturan lanjutan** — tema, font, tab size, auto-save, minimap, sticky scope, dan lainnya
- **Bar simbol** — tombol `{ } ; ( ) [ ]` dkk di atas keyboard (insert saat tap, aman waktu digeser)
- **Integrasi Git** — init, commit, push, dan pull dari dalam app lewat JGit (token GitHub disimpan di perangkat)

## 📦 Struktur Proyek
## 🚀 Development

Proyek ini dikembangkan langsung dari **Termux** di Android, tanpa laptop.

### Jalankan di browser (testing cepat)

Buka `www/index.html` langsung di browser HP, atau host lokal pakai:

```bash
cd www
python -m http.server 8080
```

### Build APK

APK di-build otomatis lewat GitHub Actions tiap kali push ke branch `main`. Hasil build bisa didownload dari:

- Tab **Actions** → pilih run terbaru → bagian **Artifacts**
- Tab **Releases** (dibuat otomatis tiap build sukses)

Lihat [CHANGELOG.md](CHANGELOG.md) untuk riwayat perubahan lengkap.

## 🗺️ Roadmap

- [x] Struktur editor dasar dengan Monaco
- [x] File management (explorer + multi-tab)
- [x] CI/CD build APK otomatis
- [x] Syntax highlighting PAWN
- [ ] Auto-complete / IntelliSense untuk fungsi PAWN umum
- [x] Integrasi compiler (`pawncc`) langsung di perangkat
- [x] Output/console panel untuk hasil compile
- [x] Bar simbol keyboard & toggle Word Wrap (v1.5.0)
- [x] Pengecekan pra-compile (kurung seimbang, karakter nyasar)
- [x] Git integration dasar (init, commit, push, pull) langsung dari app
- [x] Pengaturan tema & ukuran font
- [ ] Custom theme tambahan

## 👤 Author

**Julakk** — [github.com/Julakk](https://github.com/Julakk)

Bagian dari ekosistem **Ahmad Store** (hosting server game SA-MP/Open.MP, FiveM, Minecraft, VPS).

## 📄 License

Belum ditentukan.
