/* PawnStudio - launcher Node.js: dijalankan app sebagai proses terpisah.
 * libnode.so (nodejs-mobile) cuma shared library, jadi butuh executable kecil ini
 * buat manggil node::Start(argc, argv). Dipaketkan sebagai libnodeexec.so di jniLibs. */
#include <dlfcn.h>
#include <stdio.h>

typedef int (*node_start_fn)(int, char **);

int main(int argc, char **argv) {
    void *h = dlopen("libnode.so", RTLD_NOW | RTLD_GLOBAL);
    if (!h) {
        fprintf(stderr, "nodeexec: gagal load libnode.so: %s\n", dlerror());
        return 127;
    }
    node_start_fn start = (node_start_fn)dlsym(h, "_ZN4node5StartEiPPc");
    if (!start) {
        fprintf(stderr, "nodeexec: simbol node::Start tidak ketemu di libnode.so\n");
        return 127;
    }
    return start(argc, argv);
}
