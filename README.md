## Linggen (VS Code Extension)

Linggen is the **Alignment Layer for AI Coding**. You define the intent; Linggen makes it stay. It anchors your design decisions directly into your codebase so humans and AI can evolve it without losing its original shape.

### Why Linggen?

In a world of "vibe coding" and fast AI iteration, codebases often lose their architectural integrity. Linggen solves the "context limit" and "lack of long-term memory" problems by providing the primitives needed for professional AI engineering: **Design Anchors** and **Skills & Policy**.

### Quickstart (17 seconds)

1. **Install Linggen**: run **`🌀 Linggen: Install/Update Linggen (Local)`** (Command Palette).
2. **Start Linggen** in a terminal:

```bash
linggen
```

3. In VS Code, open your project folder.
4. Run **`🌀 Linggen: Index Current Project`**.
5. Right-click any file/folder → **`🌀 Linggen: Show Graph`** (or run it from the Command Palette).

### What Linggen does for you

- **Design Anchors (Memory)**: Stop "vibe coding" and start engineering. Link your code directly to architectural decisions in `.linggen/memory/`. Linggen provides **CodeLens** and **Inlay Hints** to preview these "Design Anchors" directly in your code.
- **Skills & Policy**: Teach your AI "how we build here." Manage shared coding standards and library-specific policies that persist across projects.
- **Automated Context**: Linggen understands your whole project (and related projects) and provides the right context to your AI agent automatically.
- **AI Orchestration**: Seamlessly connects to tools like **Cursor** or **Claude Code**, handling the technical setup (MCP, skills) in the background.
- **Local & Private**: All your project data and architectural knowledge stay on your machine.

### Commands

- **`🌀 Linggen: Install/Update Linggen (Local)`**: runs the installer steps in an integrated terminal (after confirmation).
- **`🌀 Linggen: Index Current Project`**: tells Linggen to index the current workspace for cross-project context.
- **`🌀 Linggen: Explain Across Projects`**: right-click in the editor to send context to Linggen and get an editable markdown explanation with related memories and design anchors.
- **`🌀 Linggen: Pin to Memory`**: anchor your code to a design decision or architectural pattern (`.linggen/memory/`).
- **`🌀 Linggen: Library`**: browse and install skills or policies from your Linggen server into your project.
- **`🌀 Linggen: Show Graph`**: shows a lightweight dependency graph visualization in a side panel.

### Wiki & Documentation

For a deep dive into the philosophy of Design Intent and how Linggen helps you move from implementer to architect, visit our [Wiki](https://linggen.dev/wiki/2026-01-19-wiki-design-intent).

### Settings

You can configure the extension in VS Code settings:

```json
{
  "linggen.backend.httpUrl": "http://localhost:8787",
  "linggen.backend.explainAcrossProjectsEndpoint": "/api/query",
  "linggen.backend.libraryListEndpoint": "/api/library",
  "linggen.backend.libraryReadEndpoint": "/api/library/packs",
  "linggen.panel.autoReveal": true,
  "linggen.healthPoll.enabled": true,
  "linggen.healthPoll.intervalMs": 5000,
  "linggen.healthPoll.showStatusBar": true,
  "linggen.installUrl": "https://linggen.dev"
}
```

### AI Orchestration

Linggen automatically orchestrates the connection between your codebase and AI agents (like **Cursor** or **Claude Code**). It manages the "technical handshake" in the background—configuring MCP servers, syncing skills, and injecting design intent—so your AI is instantly smarter without manual setup.

### Troubleshooting

- **Linggen server not reachable**: make sure you started Linggen (`linggen`) and the URL matches `linggen.backend.httpUrl`.
- **Port is different**: set `linggen.backend.httpUrl` to your Linggen server URL.

### Feedback & Issues

We welcome any feedback or bug reports! Please visit our GitHub repository to open an issue or start a discussion:

[https://github.com/linggen/linggen-vscode](https://github.com/linggen/linggen-vscode)
