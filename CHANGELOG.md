# Change Log

All notable changes to the "linggen-vscode" extension will be documented in this file.

## [0.1.0] - 2024-12-08

### Added

- Initial release of Linggen VS Code extension
- `Linggen: Install Linggen` command - opens installation page in browser
- `Linggen: Start Linggen` command - starts the local Linggen backend server
- `Linggen: Index Current Project` command - triggers indexing of the current workspace
- `Linggen: Open in Linggen` command - opens files/folders in Linggen UI
- `Linggen: Configure Cursor mcp.json` command - automatically creates/updates `.cursor/mcp.json` with Linggen MCP configuration
- Right-click context menu integration for "Open in Linggen"
- Configuration options for backend mode (CLI/HTTP), paths, and URLs
- Output channel for Linggen logs and debugging
- Basic test suite for extension activation and command registration
- Automatic `.cursor/mcp.json` file creation and management

### Changed

- Updated MCP configuration format to use simple SSE URL format (`url: "http://localhost:8787/mcp/sse"`)
- Configure Cursor command now automatically creates/updates the file instead of just showing a snippet
- Default port changed to 8787 (the actual Linggen server port)
- Improved HTTP indexing to use correct API endpoint `/api/sources/:source_id/graph/rebuild`
- Added server health checks before indexing or opening files in Linggen
- Commands now automatically start Linggen if the server is not running (no manual prompt needed)

### Notes

- HTTP indexing endpoint integration is planned for future releases
- LSP-enhanced graph overlays are planned for future releases

