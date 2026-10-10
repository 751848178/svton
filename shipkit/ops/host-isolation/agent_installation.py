"""Trust only two root-owned files inside one immutable dedicated Agent release."""
import os
import re
from pathlib import Path
from root_owned_paths import trusted_chain

RELEASES = Path("/opt/shipkit-agent/releases")


def trusted_file(value):
    file = Path(value)
    if not file.is_absolute() or ".." in file.parts:
        raise ValueError("Agent paths must be absolute immutable release paths")
    try:
        relative = file.relative_to(RELEASES)
    except ValueError:
        raise ValueError("Agent runtime path is outside dedicated releases namespace") from None
    if len(relative.parts) < 2 or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,79}", relative.parts[0]):
        raise ValueError("Agent runtime path must identify an immutable release directory")
    trusted_chain(file)
    return relative.parts[0]


def trusted_installation(node, entry):
    if trusted_file(node) != trusted_file(entry):
        raise ValueError("Agent node and entry must belong to the same frozen release")
    if not os.access(node, os.X_OK) or not entry.endswith(".js"):
        raise ValueError("Agent node must be executable and entry must be compiled JavaScript")


def trusted_work_root(value):
    if value != "/srv/shipkit-agent":
        raise ValueError("Dedicated Agent work root must be /srv/shipkit-agent")
    trusted_chain(Path(value), directory=True)
