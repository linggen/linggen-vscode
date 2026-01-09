## Linggen (VS Code Extension)

Linggen is your **local-first memory layer for vibe coding**. This extension connects VS Code to Linggen so you can **index your projects, documents, and notes on your own machine**, then search and chat with AI – with your data staying completely local.

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

### Commands

- **`Linggen: Install Linggen CLI`**: runs the installer steps in an integrated terminal (after confirmation).
- **`Linggen: Index Current Project`**: tells Linggen to index the current workspace.
- **`Linggen: Connect to Linggen`**: Connect Cursor to Linggen MCP server.
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

### Cursor integration

If you're using **Cursor**, run **`Linggen: Connect to Linggen`**.

- In newer Cursor versions, this command will register the Linggen MCP server **programmatically** using Cursor's MCP Extension API (no `.cursor/mcp.json` edits needed).
- If Linggen starts **after** Cursor, the extension will automatically **retry and refresh** the MCP registration once Linggen becomes reachable.
- Otherwise, it will fall back to creating/updating `.cursor/mcp.json` (you may need to restart Cursor to apply changes).

### Troubleshooting

- **Linggen server not reachable**: make sure you started Linggen (`linggen`) and the URL matches `linggen.backend.httpUrl`.
- **Port is different**: set `linggen.backend.httpUrl` to your Linggen server URL.
