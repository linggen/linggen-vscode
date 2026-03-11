# Linggen — Your Personal AI OS

Linggen is a local-first, multi-agent AI coding assistant. It runs on your machine, connects to any LLM (local or cloud), and gives you autonomous agents, skills, and scheduled missions — all from VS Code.

This extension connects VS Code to your running [Linggen](https://linggen.dev) server, embedding the full agent UI in the sidebar and providing editor-level features like anchored context and skill management.

## Features

### Agent Chat (Sidebar)

Chat with Linggen agents directly in VS Code. The sidebar embeds the full Linggen web UI — multi-agent delegation, plan mode, tool execution, and streaming responses all work inside the editor.

### Anchor System

Anchor code to structured context using `// linggen anchor: <path>` comments. The extension provides:

- **CodeLens** — click to open the referenced anchor file
- **Document Links** — Ctrl/Cmd-click anchor paths to navigate
- **Pin to Anchor** — right-click any code selection to create or link an anchor

Anchors are Markdown files under `.linggen/anchor/` that provide persistent, structured context for AI tools.

### Skills Marketplace

Browse and install skills from the Linggen skills registry directly in VS Code. Skills are cross-compatible with Claude Code and Codex — install once, use everywhere.

### Agent Runs

View and cancel active agent runs from the command palette.

### AI Rules Bootstrap

On project open, the extension auto-generates AI rule files for your editor:

- `CLAUDE.md` / `AGENTS.md` — Claude Code and Codex
- `.cursor/rules/` — Cursor
- `.windsurfrules` — Windsurf

These files teach AI tools about the anchor system so they read your context automatically.

### Health Monitoring

Status bar indicator shows whether the Linggen server is running. Commands like "Chat with Agent" and "Agent Runs" appear only when the server is healthy.

## Getting Started

1. **Install Linggen** — run `Linggen: Install/Update (ling)` from the command palette, or visit [linggen.dev](https://linggen.dev)
2. **Start the server** — run `ling` in your terminal (starts server + TUI) or `ling --web` (server only)
3. **Open the sidebar** — click the Linggen icon in the activity bar to start chatting

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `linggen.agent.url` | `http://localhost:9898` | Base URL of the Linggen server |

## Commands

| Command | Description |
|---------|-------------|
| `Linggen: Install/Update (ling)` | Install or update the Linggen CLI |
| `Linggen: Pin to Anchor` | Anchor selected code to a context file |
| `Linggen: Browse Online Skills` | Search and install skills from the registry |
| `Linggen: Chat with Agent` | Focus the agent chat sidebar |
| `Linggen: Agent Runs` | View and cancel active runs |

## Links

- [linggen.dev](https://linggen.dev)
- [GitHub](https://github.com/linggen/linggen-vscode)
- [Skills repository](https://github.com/linggen/skills)
