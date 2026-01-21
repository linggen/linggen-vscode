# Change Log

All notable changes to the "linggen-vscode" extension will be documented in this file.

## [0.6.0] - 2026-01-19

### Added

- `Linggen: Explain Across Projects` command - generates an AI prompt with context from multiple indexed projects and related memories
- `Linggen: Pin to Memory` command - anchors code to memory with interactive selection
- `Linggen: Show Graph` - dependency graph now opens in a dedicated side panel for better visibility
- `Linggen: Library` command - opens the Linggen global library of skills and policies
- Memory integration in editor:
  - CodeLens for `linggen memory: <id>` comments to quickly open memory files
  - Inlay Hints to preview memory name and summary directly in the editor
- Automatic AI rules bootstrapping for Cursor (`.cursorrules`), Windsurf (`.windsurfrules`), Zed (`.rules`), and others (`AGENTS.md`)
- Linggen server health monitoring and status indicators
- Improved project resolution heuristic for multi-root or containerized environments
- Claude Code skill bootstrapping and configuration syncing

### Changed

- Updated project indexing and search to support cross-project context retrieval
- Refined the "Explain" output format for better readability and easy copying to AI assistants
- Consolidated Linggen commands under a single `🌀 Linggen` context menu

## [0.4.0] - 2026-01-02

- added cli linggen: pin to memory, that will anchor you code to memory

## [0.1.0] - 2025-12-08

### Added

- Initial release of Linggen VS Code extension
- `Linggen: Install Linggen CLI` command - runs install steps in an integrated terminal (after confirmation)
- `Linggen: Index Current Project` command - triggers indexing of the current workspace via Linggen HTTP API
- `Linggen: Open Graph` command - shows a focused dependency graph in a VS Code webview
- `Linggen: Configure Cursor mcp.json` command - creates/updates `.cursor/mcp.json` with Linggen MCP configuration
- Right-click context menu integration for Open Graph
- Configuration options for backend HTTP URL and install URL
- Output channel for Linggen logs and debugging
- Basic test suite for extension activation and command registration
- Automatic `.cursor/mcp.json` file creation and management

### Changed

- Updated MCP configuration format to use simple SSE URL format (`url: "http://localhost:8787/mcp/sse"`)
- Configure Cursor command now automatically creates/updates the file instead of just showing a snippet
- Default port changed to 8787 (the actual Linggen server port)
- Improved HTTP indexing to use Linggen's indexing endpoint
- Added server health checks before indexing or opening files in Linggen
- When Linggen is not running, commands show actionable install/help prompts

### Notes

- HTTP indexing endpoint integration is planned for future releases
- LSP-enhanced graph overlays are planned for future releases
