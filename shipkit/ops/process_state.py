"""Keep host PID checks and explicit container stop proof in separate namespaces."""
import json
import os
import re
import stat
from container_safety import container_record, verify_stopped_container


def runtime_record(root):
    filename = root / "runtime.json"
    try:
        descriptor = os.open(filename, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    except OSError:
        raise ValueError("Runtime PID record cannot be a symlink or unreadable file") from None
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > 32768:
            raise ValueError("Invalid runtime PID record")
        content = os.read(descriptor, 32769)
        if len(content) > 32768:
            raise ValueError("Invalid runtime PID record")
        record = json.loads(content)
    finally:
        os.close(descriptor)
    if not isinstance(record, dict):
        raise ValueError("Invalid runtime PID record")
    return record


def pid_namespace():
    try:
        return os.readlink("/proc/self/ns/pid")
    except OSError:
        return None


def stopped(root, stopped_container=None):
    record = runtime_record(root)
    if record is None:
        if stopped_container:
            raise ValueError("Stopped container proof requires a container runtime record")
        return
    pids = [record[key] for key in ("supervisorPid", "apiPid", "webPid") if record.get(key) is not None]
    if any(type(pid) is not int or pid <= 0 for pid in pids):
        raise ValueError("Invalid runtime PID record")
    namespace = record.get("pidNamespace")
    if namespace is not None and (not isinstance(namespace, str) or not re.fullmatch(r"pid:\[\d+\]", namespace)):
        raise ValueError("Invalid runtime PID namespace")
    if "containerId" in record or "containerDataRoot" in record:
        container_record(record)
    if stopped_container or (namespace is not None and namespace != pid_namespace()):
        verify_stopped_container(root, record, stopped_container)
        return
    for pid in pids:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        except PermissionError:
            pass
        raise ValueError("A recorded platform PID is running; stop the service first")
