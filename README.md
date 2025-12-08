## Linggen VS Code Extension

### Overview

This VS Code extension integrates **Linggen** into your editor so you can:

- **Visualize your codebase as a graph**
- **Jump from VS Code into Linggen for deeper architecture exploration**
- **Wire Linggen into Cursor via `msp.json`**
- **Start and control the local Linggen backend** from inside VS Code

### Current Features

- **Open Graph View**

  - Command palette action to open Linggen's dependency graph for the current workspace.
  - Lets you see how files and modules depend on each other before you edit code.

- **"Open in Linggen" context menu**

  - Right–click on a file or folder in the VS Code explorer and choose **"Open in Linggen"**.
  - Focuses the Linggen graph and design workspace around that selection (file, module, or folder).

- **Cursor `msp.json` wiring**

  - Helpers to make it easy to **add Linggen as an MCP / tool source** in Cursor's `msp.json`.
  - Ensures Cursor (and other LLM tools) can call into Linggen to:
    - Look up dependency neighborhoods.
    - Fetch design notes / specs.
    - Generate implementation briefs for specific components.

- **Start Linggen backend**
  - Command palette action to **start the Linggen server** (if it's not already running).
  - Optionally shows basic status / error output if the server fails to start.

### Commands

The extension exposes these core commands in the VS Code Command Palette:

- **`Linggen: Install Linggen`**

  - Install or update the local Linggen binary / backend needed by the extension.
  - Opens https://linggen.dev in your browser with installation instructions.

- **`Linggen: Start Linggen`**

  - Start the local Linggen server (or bring it to the foreground if already running).

- **`Linggen: Index Current Project`**

  - Ask Linggen to index the currently opened project / workspace folder so the graph and specs stay in sync with your code.

- **`Linggen: Open in Linggen`**

  - Opens the selected file or folder in Linggen's UI (also available via right-click context menu).

- **`Linggen: Configure Cursor msp.json`**
  - Generates a configuration snippet for integrating Linggen with Cursor's MCP system.

### Additional Ideas for This Extension

These are **potential / planned capabilities** that fit naturally into this extension:

- **Per-file "Architecture Lens"**

  - Side panel showing, for the active file:
    - Incoming and outgoing dependencies.
    - Linked design notes and specs from Linggen.
    - Known "owners" or responsible components.

- **Neighborhood navigation**

  - Commands to:
    - "Show dependency neighborhood in Linggen" for the current file.
    - "Show what might break if I edit this file" based on the graph.

- **Design doc integration**

  - Quick links to:
    - Open the design note / spec for the current file or component in Linggen.
    - Create a new design note that is auto-linked to the active file.

- **Indexing and health controls**

  - Commands to:
    - Trigger a **re-index** of the current workspace in Linggen.
    - Show **indexing status** (in progress, complete, last updated).

- **LLM workflow helpers**

  - From VS Code, generate an **LLM-ready brief** for the current task:
    - "Generate implementation brief in Linggen for this file/folder."
    - "Open spec + graph context in Linggen, then copy a ready-to-use prompt into the clipboard."

- **LSP-enhanced graph updates**

  - When you right–click **"Open in Linggen"** on a file or symbol, the extension can:
    - Query the language server (LSP) for definitions, references, symbols, etc.
    - Send these dynamic edges to Linggen to **augment the static Tree-sitter graph** for that view.
  - The Linggen graph can then show both:
    - **Static edges** (from static analysis / indexing).
    - **Dynamic LSP edges** (session-specific overlays), visually distinguished in the UI.

- **Multi-root workspace support**
  - Map each folder in a VS Code multi-root workspace to the appropriate Linggen source.
  - Quickly switch which source / subproject Linggen is showing.

### Getting Started

#### Installation

1. **Install the extension** in VS Code (from VSIX or marketplace when published)
2. **Install Linggen** by running the command `Linggen: Install Linggen` from the Command Palette (Cmd/Ctrl+Shift+P)
   - This will open https://linggen.dev in your browser with installation instructions
3. **Start Linggen** using `Linggen: Start Linggen` command
4. **Index your project** with `Linggen: Index Current Project`

#### Configuration

The extension can be configured via VS Code settings (`Preferences: Open Settings (JSON)`):

```json
{
  "linggen.backend.mode": "http", // "cli" or "http"
  "linggen.backend.cliPath": "linggen", // Path to Linggen binary
  "linggen.backend.httpUrl": "http://localhost:3030", // Linggen server URL
  "linggen.installUrl": "https://linggen.dev" // Installation page URL
}
```

#### Usage

1. **Start Linggen**: Run `Linggen: Start Linggen` from the Command Palette
2. **Index your project**: Run `Linggen: Index Current Project` to build the dependency graph
3. **Open files in Linggen**: Right-click any file or folder in the Explorer and select `Linggen: Open in Linggen`
4. **Configure Cursor integration**: Run `Linggen: Configure Cursor msp.json` to get a configuration snippet for Cursor

#### Cursor Integration

To integrate Linggen with Cursor:

1. Run `Linggen: Configure Cursor mcp.json` command
2. The extension will automatically create or update `.cursor/mcp.json` in your workspace
3. Restart Cursor to apply the changes

The command will:

- Create `.cursor/mcp.json` if it doesn't exist
- Update the existing file if it already exists (preserving other MCP servers)
- Add the Linggen MCP server configuration

Example `mcp.json` configuration that will be created:

```json
{
  "mcpServers": {
    "linggen": {
      "url": "http://localhost:3030/mcp/sse"
    }
  }
}
```

Note: The MCP endpoint uses Server-Sent Events (SSE) at `/mcp/sse`. If your Linggen server runs on a different port, update the `linggen.backend.httpUrl` setting before running the configure command.

### Development

#### Building from source

```bash
npm install
npm run compile
```

#### Running the extension

1. Open this folder in VS Code
2. Press F5 to open a new window with the extension loaded
3. Run commands from the Command Palette

#### Testing

```bash
npm test
```

### Architecture

- **Extension layer**: TypeScript VS Code extension using the `vscode` API
- **Backend communication**: Communicates with Linggen via CLI commands or HTTP API (configurable)
- **Commands**: All commands are registered in `package.json` and implemented in `src/extension.ts`
- **Logging**: Dedicated "Linggen" output channel for debugging and status messages

### License

MIT
