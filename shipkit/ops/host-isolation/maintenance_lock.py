"""Serialize the three Shipkit units without locking or changing Docker."""
import fcntl
import os
from contextlib import contextmanager


@contextmanager
def maintenance_lock():
    fd = os.open("/run/shipkit-host-isolation.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)
