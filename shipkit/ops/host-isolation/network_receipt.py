"""Freeze ownership of a conflict-checked control network before firewall mutation."""
import json
import os
import re
import secrets
from pathlib import Path
from root_owned_paths import trusted_chain

RECEIPT = Path("/etc/shipkit-isolation/network.json")


def read_receipt(config, required=True):
    trusted_chain(RECEIPT.parent, directory=True)
    if not os.path.lexists(str(RECEIPT)):
        if required:
            raise ValueError("Frozen network receipt missing; install/verify dedicated network first")
        return None
    trusted_chain(RECEIPT)
    if RECEIPT.lstat().st_mode & 0o777 != 0o600:
        raise ValueError("Frozen network receipt must have mode 0600")
    record = json.loads(RECEIPT.read_text())
    expected = dict(config._asdict())
    network_id = record.get("networkId")
    if record != {**expected, "networkId": network_id} or not isinstance(network_id, str) or not re.fullmatch(r"[0-9a-f]{64}", network_id):
        raise ValueError("Frozen network receipt differs from installation configuration")
    return record


def freeze_receipt(config, network_id):
    if not re.fullmatch(r"[0-9a-f]{64}", network_id):
        raise ValueError("Docker control network ID is invalid")
    if read_receipt(config, required=False):
        raise ValueError("Refuses to replace a frozen network receipt")
    temporary = RECEIPT.with_name(".network-" + secrets.token_hex(12))
    fd = os.open(str(temporary), os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump({**dict(config._asdict()), "networkId": network_id}, stream)
            stream.flush()
            os.fsync(stream.fileno())
        # Link creates the frozen name exclusively instead of replacing it.
        os.link(str(temporary), str(RECEIPT), follow_symlinks=False)
    finally:
        temporary.unlink()
