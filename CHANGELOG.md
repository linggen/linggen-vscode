# Change Log

All notable changes to the "linggen-vscode" extension will be documented in this file.

## [0.1.0] - 2024-12-08

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
