#!/usr/bin/env python3
"""Render local private install candidates; no administrative commands are executed."""
import json
import os
from pathlib import Path
import sys
from ingress_config import LISTEN_PORT, config_dict, parse_config

TEMPLATES = Path(__file__).resolve().parent / "templates"
UNITS = ("shipkit-public-ingress.socket", "shipkit-public-ingress.service", "shipkit-public-ingress-guard.service")


def render_units(config):
    values = {"@NPM_GATEWAY@": config.npm_gateway, "@LISTEN_PORT@": str(LISTEN_PORT)}
    result = {}
    for name in UNITS:
        text = (TEMPLATES / (name + ".in")).read_text()
        for key, value in values.items():
            text = text.replace(key, value)
        if "@" in text:
            raise ValueError("Unresolved ingress unit placeholder")
        result[name] = text
    return result


def main():
    if len(sys.argv) != 3:
        raise ValueError("Usage: render_candidate.py private-config.json new-private-directory")
    file = Path(sys.argv[1])
    if file.stat().st_size > 4096:
        raise ValueError("Candidate config exceeded budget")
    config = parse_config(json.loads(file.read_text()))
    destination = Path(sys.argv[2])
    destination.mkdir(mode=0o700)
    for name, content in dict(render_units(config), **{"config.json": json.dumps(config_dict(config), indent=2) + "\n"}).items():
        descriptor = os.open(str(destination / name), os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write(content)


if __name__ == "__main__":
    main()
