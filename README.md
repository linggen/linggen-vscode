## Linggen (VS Code Extension)

Linggen is your **AI Tutor and Orchestrator**. It helps you use AI easily by automating the complex parts—context management, skill configuration, and project knowledge. You don't need to care about MCP, skills, or building context manually; Linggen handles it all locally so you can start with AI in seconds.

### Prerequisite: install Linggen

This extension requires the Linggen app/CLI to be installed. You can do this automatically via the command below, or visit [https://linggen.dev](https://linggen.dev).

### Quickstart (17 seconds)

1. **Install Linggen**: run **`Linggen: Install Linggen CLI`** (Command Palette).
2. **Start Linggen** in a terminal:

```bash
linggen
```

3. In VS Code, open your project folder.
4. Run **`Linggen: Index Current Project`**.
5. Right-click any file/folder → **`Linggen: Open Graph`** (or run it from the Command Palette).

### What Linggen does for you

- **Automated Context**: No more copying and pasting code. Linggen understands your whole project and provides the right context to your AI agent.
- **Background Orchestration**: Linggen manages skills and project knowledge so you don't have to learn complex AI configurations.
- **Local & Private**: All your project data stays on your machine.
- **Memory Anchors**: Link your code directly to architectural decisions in `.linggen/memory/`.

### Commands

- **`Linggen: Install Linggen CLI`**: runs the installer steps in an integrated terminal (after confirmation).
- **`Linggen: Index Current Project`**: tells Linggen to index the current workspace.
- **`Linggen: Explain Across Projects`**: right-click in the editor to send the context to Linggen and get an editable markdown explanation with related memories.
- **`Linggen: Pin to Memory`**: anchor you code to memory (`.linggen/memory/`).
- **`Linggen: Library`**: browse and install skills or policies from your Linggen server into your project.
- **`Linggen: Show Graph`**: shows a lightweight dependency graph visualization.

### Settings

You can configure the extension in VS Code settings:

```json
{
  "linggen.backend.httpUrl": "http://localhost:8787",
  "linggen.backend.explainAcrossProjectsEndpoint": "/api/query",
  "linggen.backend.libraryListEndpoint": "/api/library/list",
  "linggen.backend.libraryReadEndpoint": "/api/library/read",
  "linggen.panel.autoReveal": true,
  "linggen.healthPoll.enabled": true,
  "linggen.healthPoll.intervalMs": 5000,
  "linggen.healthPoll.showStatusBar": true,
  "linggen.installUrl": "https://linggen.dev"
}
```

### AI Orchestration

If you're using **Cursor**, Linggen automatically orchestrates the connection in the background. You don't need to manually configure MCP servers or context files—Linggen handles the technical handshake so your AI is instantly smarter.

### Troubleshooting

- **Linggen server not reachable**: make sure you started Linggen (`linggen`) and the URL matches `linggen.backend.httpUrl`.
- **Port is different**: set `linggen.backend.httpUrl` to your Linggen server URL.
