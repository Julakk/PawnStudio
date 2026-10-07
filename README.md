# PawnStudio

Mobile code editor untuk bahasa **PAWN**, dibangun khusus buat komunitas SA-MP / open.mp yang mau ngoding langsung dari Android, gak perlu buka laptop.

Dibangun pakai HTML, CSS, dan JavaScript murni, dibungkus jadi APK Android lewat [Capacitor](https://capacitorjs.com/).

## ✨ Fitur

- **Monaco Editor**: engine editor yang sama kayak dipakai VS Code
- **Syntax highlighting PAWN**: keyword, string, comment, angka, dan function call punya warna sendiri
- **File Explorer**: bikin, buka, dan hapus file/folder langsung dari sidebar
- **Multi-tab**: buka beberapa file `.pwn` sekaligus, ada indikator unsaved changes
- **Compile langsung di HP**: pakai `pawncc` native (arm64-v8a), hasilnya tampil di panel output
- **Auto build APK**: tiap push ke `main`, GitHub Actions otomatis build APK dan bikin Release

## 📦 Struktur Proyek

```
PawnStudio/
├── www/                    # Source web app (HTML, CSS, JS, Monaco)
├── android/                # Project Android (hasil Capacitor + plugin native)
├── .github/workflows/      # CI/CD: build APK & build pawncc
├── capacitor.config.json
├── package.json
├── CHANGELOG.md
└── LICENSE.md
```

## 🚀 Development

Proyek ini dikembangkan langsung dari **Termux** di Android, tanpa laptop.

### Jalankan di browser (testing cepat)

Buka `www/index.html` langsung di browser HP, atau host lokal pakai:

```bash
cd www
python -m http.server 8080
```

Catatan: fitur compile cuma jalan di APK, karena `pawncc` adalah binary native Android.

### Sinkronisasi ke Android

```bash
npx cap sync android
```

### Build APK

APK di-build otomatis lewat GitHub Actions tiap kali push ke branch `main`. Hasil build bisa didownload dari:

- Tab **Actions**, pilih run terbaru, bagian **Artifacts**
- Tab **Releases** (dibuat otomatis tiap build sukses)

> Saat ini compiler cuma tersedia untuk **arm64-v8a**. Binary `pawncc` dibuild lewat workflow `build-pawncc-arm64.yml`.

## 🗺️ Roadmap

- [x] Struktur editor dasar
- [x] File management (explorer + multi-tab)
- [x] Syntax highlighting PAWN
- [x] CI/CD build APK otomatis
- [x] Compiler `pawncc` native + panel output
- [x] Preflight sebelum compile (kurung seimbang, karakter nyasar)
- [x] Perbaikan bar simbol
- [x] Folder picker native (SAF)
- [x] Auto-complete / IntelliSense untuk fungsi PAWN umum
- [x] Custom theme & font size settings
- [ ] Manajemen file include
- [ ] Multi-file compile

## 👤 Author

**Julakk**: [github.com/Julakk](https://github.com/Julakk)

Bagian dari ekosistem **Ahmad Store** (hosting server game SA-MP/open.mp, FiveM, Minecraft, VPS).

## 📄 License

Dirilis dengan lisensi MIT. Lihat [LICENSE.md](LICENSE.md).
