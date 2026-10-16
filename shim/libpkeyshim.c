// Stub pkey_alloc to return -1 (ENOSYS-like) so PartitionAlloc falls back to no-PKU path cleanly.
#include <errno.h>
int pkey_alloc(int flags, unsigned access_rights) { (void)flags; (void)access_rights; errno = ENOSYS; return -1; }
int pkey_free(int pkey) { (void)pkey; return 0; }
int pkey_mprotect(void *addr, unsigned long len, int prot, int pkey) { (void)pkey; (void)addr; (void)len; (void)prot; errno = ENOSYS; return -1; }
