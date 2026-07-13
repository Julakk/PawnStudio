# PawnStudio

Mobile code editor untuk bahasa **PAWN**, dibangun khusus buat komunitas SA-MP / Open.MP yang mau ngoding langsung dari Android — gak perlu buka laptop.

Dibangun pakai HTML, CSS, dan JavaScript murni, dibungkus jadi APK Android lewat [Capacitor](https://capacitorjs.com/).

## ✨ Fitur

- **Monaco Editor** — engine editor yang sama kayak dipakai VSCode
- **Syntax highlighting PAWN** — keyword, string, comment, angka, dan function call punya warna sendiri
- **File Explorer** — bikin, buka, dan hapus file/folder langsung dari sidebar
- **Multi-tab** — buka beberapa file `.pwn` sekaligus, ada indikator unsaved changes
- **Auto build APK** — tiap push ke `main`, GitHub Actions otomatis build APK dan bikin Release

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

## 🗺️ Roadmap

- [x] Struktur editor dasar dengan Monaco
- [x] File management (explorer + multi-tab)
- [x] CI/CD build APK otomatis
- [x] Syntax highlighting PAWN
- [ ] Auto-complete / IntelliSense untuk fungsi PAWN umum
- [ ] Integrasi compiler (`pawncc`) via backend
- [ ] Output/console panel untuk hasil compile
- [ ] Git integration langsung dari app
- [ ] Custom theme & font size settings

## 👤 Author

**Julakk** — [github.com/Julakk](https://github.com/Julakk)

Bagian dari ekosistem **Ahmad Store** (hosting server game SA-MP/Open.MP, FiveM, Minecraft, VPS).

## 📄 License

Belum ditentukan.
