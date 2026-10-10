"""Check a root-owned path and all parents without following symlinks."""
import stat


def trusted_chain(file, directory=False):
    for parent in [*reversed(file.parents), file]:
        info = parent.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            raise ValueError("Path and every parent must be root-owned, non-writable and without symlinks")
        expected = stat.S_ISDIR if parent != file or directory else stat.S_ISREG
        if not expected(info.st_mode):
            raise ValueError("Invalid trusted path file type")
