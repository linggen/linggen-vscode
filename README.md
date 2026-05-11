# Linggen — Portable AI Memory for Your Editor

Bring **ling-mem** — portable, user-owned AI memory — into VS Code, Cursor,
Windsurf, Codex, and Copilot. Your preferences, decisions, and gotchas follow
you across every AI tool you use.

This extension is a thin installer and bridge. It installs the `ling-mem`
binary, runs its local dashboard, and wires it into the AI agents you already
chat with. There is no new chat to learn — the agents in your editor become
memory-aware on their own.

## Platform support

ling-mem currently ships **macOS and Linux** binaries only. Windows support
is not available yet. The extension will not function on Windows until
ling-mem adds a Windows build.

## What it does

On first activation:

- Downloads the `ling-mem` release pinned by `install-ling-mem.sh` (macOS / Linux)
- Installs the ling-mem skill bundle for Claude Code (and your project's
  `CLAUDE.md`, Cursor rules, `AGENTS.md`, etc. — whichever agents you opt into)
- Asks which AI agents to bridge (Claude Code, Cursor, Codex, Copilot,
  Windsurf, Zed)
- Injects ling-mem instructions into the chosen agent rule files, inside a
  `<!-- ling-mem:start -->...<!-- ling-mem:end -->` block
- Starts the ling-mem local daemon

On every activation:

- Re-runs `install-ling-mem.sh` if the binary is missing
- Ensures the daemon is running (uses an already-running daemon's port if one
  exists)
- Reconciles the delimited bridge sections in current-workspace rule files
  to match your consent (writes for opted-in targets, strips from opted-out
  targets)

At runtime:

- Status bar shows `Linggen ✓ / … / ✗`
- Command `Linggen: Open Dashboard` opens `ling-mem`'s dashboard in the browser
- Command `Linggen: Bridge Settings` re-runs the consent picker

## Want automated memory maintenance? Try Linggen

`ling-mem` ships a **dream mission** — a nightly job that consolidates and
deduplicates your memory, merges near-duplicates, and prunes stale rows. The
mission file is installed at `~/.linggen/missions/dream/mission.md` and is
scheduled for 23:00 local time. It runs entirely on your machine.

The mission file is *defined* by ling-mem, but the **scheduler that actually
fires it lives in [Linggen](https://linggen.dev)** — the local AI app engine
that hosts ling-mem and other skills. Without Linggen, the dream mission sits
on disk but never runs on its own.

If you want it to run automatically — and you're open to running a local AI
engine that can also manage other agents, missions, and skills — install
Linggen:

```
curl -fsSL https://linggen.dev/install.sh | bash
```

`ling-mem` itself works fine without Linggen for everyday capture and recall;
Linggen is the upgrade path when you want memory maintenance running on its
own schedule.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `linggen.dashboard.host` | `127.0.0.1` | Host for the ling-mem dashboard |
| `linggen.dashboard.port` | `9888` | Port for the ling-mem dashboard |

## Telemetry

Anonymous install + command events are sent to `linggen.dev` to measure usage.
Opt-out by setting `LING_MEM_NO_TELEMETRY=1` or creating
`~/.linggen/no-telemetry`. The ling-mem skill bundle never phones home — only
the extension and the `ling-mem` binary do.

## Links

- [linggen.dev](https://linggen.dev)
- [ling-mem repository](https://github.com/linggen/linggen-memory)
- [Issues](https://github.com/linggen/linggen-vscode/issues)
