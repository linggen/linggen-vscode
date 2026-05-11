# Change Log

All notable changes to the "linggen-vscode" extension will be documented in this file.

## [1.0.1] - 2026-05-11

- Replace 128×128 icon with 512×512 render from `assets/logo.svg` so the icon
  renders correctly on Open VSX and at retina resolution on the VS Code
  Marketplace.

## [1.0.0] - 2026-05-11

Full rebuild. The extension is now a thin installer and bridge for
[ling-mem](https://github.com/linggen/linggen-memory) — it brings portable
AI memory into Cursor, Copilot, Codex, Windsurf, and Zed without adding
yet another chat surface.

### Added

- **Auto-install** — on first activation, downloads and installs the
  `ling-mem` binary via `linggen.dev/install-ling-mem.sh` (macOS / Linux only)
- **Bridge consent picker** — choose which AI agents should read your memory;
  preference saved globally, applied silently to every workspace afterwards
- **Rule file injection** — writes a `<!-- ling-mem:start -->...<!-- ling-mem:end -->`
  block into `.cursor/rules/ling-mem.md`, `AGENTS.md`,
  `.github/copilot-instructions.md`, `.windsurfrules`, and `.rules`; content
  read from the installed ling-mem skill bundle so it stays in sync with
  ling-mem releases
- **Dashboard launcher** — `Linggen: Open Dashboard` ensures the `ling-mem`
  daemon is running and opens the local dashboard at the configured host/port
- **Status bar** — `Linggen: ✓ / ⚠ / ⊘` reflecting daemon state; click to
  open the dashboard
- **Telemetry (host-side)** — anonymous `install` and `command` events to
  `linggen.dev/api/track`; opt-out via `LING_MEM_NO_TELEMETRY=1` or
  `~/.linggen/no-telemetry`

### Removed

Everything from the 0.x line. The extension no longer provides:

- Agent chat sidebar / iframe
- Anchor system (`// linggen anchor:` comments, CodeLens, document links)
- AI rules bootstrap (CLAUDE.md / AGENTS.md / .cursorrules generation)
- Skills marketplace browser
- Agent runs management
- Health monitoring for the Linggen engine

If you relied on these, stay on 0.7.0 or use the Linggen web UI directly.

### Configuration changes

- Removed: `linggen.agent.url`
- Added: `linggen.dashboard.host` (default `127.0.0.1`),
  `linggen.dashboard.port` (default `9888`)

## [0.7.0] - 2026-03-11

Linggen has evolved from a memory/indexing tool into a full multi-agent AI coding assistant. This release aligns the VS Code extension with the new direction.

### Added

- **Agent Chat sidebar** — embeds the full Linggen web UI in the VS Code sidebar via iframe, with streaming responses, multi-agent delegation, plan mode, and tool execution
- **Anchor system** — replaces the old memory system. `// linggen anchor: <path>` comments link code to structured Markdown context under `.linggen/anchor/`
  - CodeLens to open anchor files
  - Document links for Ctrl/Cmd-click navigation
  - `Pin to Anchor` command to create or link anchors from selected code
- **Agent Runs** command — view and cancel active agent runs from the command palette
- **Health monitoring** — status bar indicator for server connectivity; agent commands auto-hide when server is down
- **Clipboard bridge** — Ctrl+C/V/X/A shortcuts work inside the embedded web UI iframe

### Changed

- **Default server port** changed from 6666 to 9898
- **AI rules bootstrap** updated — generates `CLAUDE.md` and `AGENTS.md` with anchor system awareness (replaces old memory skill references)
- **Skills browsing** now uses the Linggen registry with fallback to skills.sh
- Removed stale features from the memory/indexing era:
  - Removed `Explain Across Projects` command
  - Removed `Show Graph` command
  - Removed `Library` command
  - Removed memory CodeLens (`linggen memory: <id>`) and InlayHints
  - Removed MCP configuration commands
  - Removed project indexing

## [0.6.5] - 2026-01-29

- Enhanced pin to anchor; link to any doc

## [0.6.4] - 2026-01-28

- Browse online skills

## [0.6.0] - 2026-01-19

### Added

- `Linggen: Explain Across Projects` command
- `Linggen: Pin to Memory` command
- `Linggen: Show Graph` in dedicated side panel
- `Linggen: Library` command
- Memory integration (CodeLens, InlayHints)
- AI rules bootstrapping for Cursor, Windsurf, Zed, AGENTS.md
- Server health monitoring
- Claude Code skill bootstrapping

### Changed

- Consolidated commands under `🌀 Linggen` context menu

## [0.4.0] - 2026-01-02

- Added pin to memory command

## [0.1.0] - 2025-12-08

- Initial release
