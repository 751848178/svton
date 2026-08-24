#!/usr/bin/env python3
"""Enable the OpenPencil live MCP server for installed agent CLIs.

Mirrors exactly what the OpenPencil desktop app's Agent Settings -> MCP tab
writes when a CLI is toggled on (see crates/op-host-desktop/src/mcp_integrations.rs):
  - streamable HTTP shape {type: http, url} for Claude Code / OpenCode / Kiro /
    Copilot / Gemini CLI / Cursor / ZCode
  - {httpUrl} for Qwen Code
  - {url, transport: http} for Kimi
  - [mcp_servers.openpencil] url=... for Codex and Grok (TOML)
Only additive: existing settings are preserved. Every touched file is backed
up to <path>.openpencil-bak first.
"""
import json
import os
import shutil
import sys

ENDPOINT = "http://127.0.0.1:3100/mcp"
HOME = os.path.expanduser("~")
STREAMABLE = {"type": "http", "url": ENDPOINT}

TARGETS = [
    # (config path, key-path under which to add the server, server value)
    (os.path.join(HOME, ".claude.json"), ["mcpServers", "openpencil"], STREAMABLE),
    (os.path.join(HOME, ".gemini", "settings.json"), ["mcpServers", "openpencil"], STREAMABLE),
    (os.path.join(HOME, ".kiro", "settings.json"), ["mcpServers", "openpencil"], STREAMABLE),
    (os.path.join(HOME, ".cursor", "mcp.json"), ["mcpServers", "openpencil"], STREAMABLE),
    (os.path.join(HOME, ".opencode", "config.json"), ["mcpServers", "openpencil"], STREAMABLE),
    (os.path.join(HOME, ".zcode", "cli", "config.json"), ["mcp", "servers", "openpencil"], STREAMABLE),
    (os.path.join(HOME, ".kimi-code", "mcp.json"), ["mcpServers", "openpencil"], {"url": ENDPOINT, "transport": "http"}),
]

TOML_TARGETS = [
    os.path.join(HOME, ".codex", "config.toml"),
    os.path.join(HOME, ".grok", "config.toml"),
]

TOML_BLOCK = '[mcp_servers.openpencil]\nurl = "{}"\n'.format(ENDPOINT)


def read_json(path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(obj, indent=2) + "\n")


def remove_toml_server_block(text):
    """Remove an existing [mcp_servers.openpencil] section, like remove_codex_server_block."""
    lines = text.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("[mcp_servers.openpencil]"):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("["):
                i += 1
            continue
        out.append(line)
        i += 1
    return "".join(out)


def enable_toml(path):
    existed = os.path.exists(path)
    if existed:
        shutil.copy2(path, path + ".openpencil-bak")
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = ""
    stripped = remove_toml_server_block(text).rstrip()
    new_text = stripped + ("\n\n" if stripped else "") + TOML_BLOCK
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_text)
    return existed


results = []
for path, keys, value in TARGETS:
    existed = os.path.exists(path)
    if existed:
        shutil.copy2(path, path + ".openpencil-bak")
        obj = read_json(path)
    else:
        obj = {}
    cur = obj
    for k in keys[:-1]:
        cur = cur.setdefault(k, {})
    cur[keys[-1]] = value
    write_json(path, obj)
    results.append((path, "updated" if existed else "created"))

for path in TOML_TARGETS:
    existed = enable_toml(path)
    results.append((path, "updated" if existed else "created"))

print("openpencil MCP endpoint:", ENDPOINT)
for path, status in results:
    print(f"  [{status}] {path}")
