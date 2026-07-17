---
type: spec
reader: Coding agent and users
guide: |
  Product specification — describe what the system should do and why.
  Keep it brief. Aim to guide design and implementation, not document code.
  Avoid implementation details like function signatures, variable types, or code snippets.
---

# Product Spec: Linggen VS Code Extension

## Goal

Bring **ling-mem** — portable, user-owned AI memory — into VS Code and its forks (Cursor, Windsurf, Codex, etc.), so the AI agents users already chat with become aware of their preferences, decisions, and gotchas across every editor.

The extension is a thin installer and bridge. ling-mem owns the memory store, the daemon, and the dashboard. The extension's job is to make ling-mem **work automatically** for users who never touched a terminal.

## Audience

- VS Code, Cursor, Windsurf, Codex users who chat with AI in their editor
- They may or may not have Claude Code, Linggen, or any LLM API key
- They want their AI to remember them across tools

## Requirements

- macOS or Linux. `ling-mem` does not ship a Windows binary; the extension is inert on Windows.

## What it does

On install (one time):
- Downloads the `ling-mem` release pinned by `install-ling-mem.sh`
- Installs the ling-mem skill bundle for Claude Code (`~/.claude/skills/ling-mem/`)
- Asks which host agents to bridge (Cursor / Codex / Copilot / Windsurf / Zed)
- Injects ling-mem instructions into the chosen rule files (`.cursor/rules/ling-mem.md`, `AGENTS.md`, `.github/copilot-instructions.md`, etc.) inside a delimited section
- Starts the ling-mem daemon (`ling-mem start`)

On every activation:
- Ensures `ling-mem` is installed (re-runs `install-ling-mem.sh` if the binary is missing)
- Ensures the daemon is running on the host the user has configured (uses an already-running daemon's port if one exists)
- Ensures bridged rule files match the current consent: writes the delimited section into newly-consented targets, strips it from un-consented ones

At runtime:
- Status bar shows `Linggen ✓ / … / ✗`
- Palette command `Linggen: Open Dashboard` opens `http://<host>:<port>/` in the external browser
- Palette command `Linggen: Bridge Settings` re-runs the consent picker

## What it does not do

- No chat surface, no agent runs UI, no in-editor memory browser
- No anchor system, no skill marketplace, no project indexing
- Does not orchestrate or proxy host agent chats; bridged agents call ling-mem directly via their own tool use

## Bridge targets

| Target | Path | Skill / rules location |
|:-------|:-----|:-----------------------|
| Claude Code (global) | `~/.claude/CLAUDE.md` | already wired via global `@~/.linggen/memory/...` includes — extension only installs the skill |
| Claude Code (project) | project `CLAUDE.md` | inlined rules — explicit project-scope reminder alongside the global wiring |
| Cursor | project `.cursor/rules/ling-mem.md` | inlined rules |
| Codex / Codex CLI | project `AGENTS.md` | inlined rules |
| GitHub Copilot | project `.github/copilot-instructions.md` | inlined rules |
| Windsurf | project `.windsurfrules` | inlined rules |
| Zed | project `.rules` | inlined rules |

All writes are wrapped in `<!-- ling-mem:start -->...<!-- ling-mem:end -->`. Content outside the markers is never touched.

## Configuration

| Setting | Default | Description |
|:--------|:--------|:------------|
| `linggen.dashboard.host` | `127.0.0.1` | Host for the ling-mem dashboard |
| `linggen.dashboard.port` | `9528` | Port for the ling-mem dashboard |

## Telemetry

Host-side, per the multi-product telemetry spec. Two events:

- `install` — first activation; writes `~/.linggen/.linggen-vscode-install-source = marketplace`
- `command` — per dashboard open / bridge change

Default-on. Opt-out via `LING_MEM_NO_TELEMETRY=1` or `~/.linggen/no-telemetry`. The extension is the host; nothing in the ling-mem skill bundle phones home.

## Related

- ling-mem binary: `linggen-memory/` repo
- ling-mem skill bundle: `skills/ling-mem/`
- Linggen engine (upsell target): `linggen/` repo
