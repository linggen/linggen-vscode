## Linggen (VS Code Extension)

This extension connects VS Code to **Linggen** so you can **index your repo** and **view a focused dependency graph** right inside the editor.

### Prerequisite: install Linggen

This extension requires the Linggen app/CLI to be installed.

- Website: `https://linggen.dev`
- Install:

```bash
curl -fsSL https://linggen.dev/install-cli.sh | bash
linggen install
```

### Quickstart (2 minutes)

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
- **`Linggen: Explain Across Projects`**: right-click in the editor to send the selected code (or cursor ±N lines) + file path to Linggen.
- **`Linggen: Show Graph in Panel`**: shows a lightweight graph preview in the **Linggen panel** (bottom tab next to Terminal).

### Settings

You can configure the extension in VS Code settings:

```json
{
  "linggen.backend.httpUrl": "http://localhost:8787",
  "linggen.backend.explainAcrossProjectsEndpoint": "/api/query",
  "linggen.explain.contextLines": 20,
  "linggen.explain.excludeCurrentSource": true,
  "linggen.explain.includeCodeInPrompt": false,
  "linggen.explain.includeContextExcerpts": false,
  "linggen.panel.autoReveal": true,
  "linggen.healthPoll.enabled": true,
  "linggen.healthPoll.intervalMs": 5000,
  "linggen.healthPoll.showStatusBar": true,
  "linggen.installUrl": "https://linggen.dev"
}
```

### Cursor integration

If you're using **Cursor**, run **`Linggen: Connect to Linggen`**.

- In newer Cursor versions, this command will register the Linggen MCP server **programmatically** using Cursor's MCP Extension API (no `.cursor/mcp.json` edits needed). See: [Cursor MCP Extension API Reference](https://cursor.com/docs/context/mcp-extension-api#mcp-extension-api-reference).
- If Linggen starts **after** Cursor, the extension will automatically **retry and refresh** the MCP registration once Linggen becomes reachable, so the server can flip from “unavailable” → “available” without restarting.
- Otherwise, it will fall back to creating/updating `.cursor/mcp.json` (you may need to restart Cursor to apply changes).

The file-based fallback creates/updates `.cursor/mcp.json` like:

```json
{
  "mcpServers": {
    "linggen": {
      "url": "http://localhost:8787/mcp/sse"
    }
  }
}
```

### Troubleshooting

- **Linggen server not reachable**: make sure you started Linggen (`linggen`) and the URL matches `linggen.backend.httpUrl`.
- **Port is different**: set `linggen.backend.httpUrl` to your Linggen server URL.

### License

MIT
