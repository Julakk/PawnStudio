/* PawnStudio - launcher Node.js: dijalankan app sebagai proses terpisah.
 * libnode.so (nodejs-mobile) cuma shared library, jadi butuh executable kecil ini
 * buat manggil node::Start(argc, argv). Dipaketkan sebagai libnodeexec.so di jniLibs. */
#include <dlfcn.h>
#include <limits.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

typedef int (*node_start_fn)(int, char **);

int main(int argc, char **argv) {
    void *h = dlopen("libnode.so", RTLD_NOW | RTLD_GLOBAL);
    if (!h) {
        /* fallback: libnode.so ada di folder yang sama dengan executable ini */
        char exe[PATH_MAX], path[PATH_MAX + 16];
        ssize_t n = readlink("/proc/self/exe", exe, sizeof(exe) - 1);
        if (n > 0) {
            exe[n] = 0;
            char *slash = strrchr(exe, '/');
            if (slash) {
                *slash = 0;
                snprintf(path, sizeof(path), "%s/libnode.so", exe);
                h = dlopen(path, RTLD_NOW | RTLD_GLOBAL);
            }
        }
    }
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
