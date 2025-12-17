import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { setMcpConfigured } from '../linggenMonitor';

/**
 * Command: Linggen: Configure Cursor mcp.json
 * Creates or updates .cursor/mcp.json with Linggen configuration.
 */
export async function configureCursorMsp(context?: vscode.ExtensionContext): Promise<void> {
    const outputChannel = getOutputChannel();
    const mcpServerName = 'Linggen';
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
            'No workspace folder open. Please open a workspace first.'
        );
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const mcpJsonPath = path.join(cursorDir, 'mcp.json');

    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');

    const linggenMcpUrl = `${httpUrl.replace(/\/+$/, '')}/mcp/sse`;

    // Prefer Cursor's MCP Extension API when available (avoids editing mcp.json).
    // Ref: https://cursor.com/docs/context/mcp-extension-api#mcp-extension-api-reference
    type CursorMcpApi = {
        registerServer?: (cfg: {
            name: string;
            server:
                | { url: string; headers?: Record<string, string> }
                | { command: string; args: string[]; env: Record<string, string> };
        }) => void;
        unregisterServer?: (serverName: string) => void;
    };

    const cursorMcp = (vscode as unknown as { cursor?: { mcp?: CursorMcpApi } }).cursor?.mcp;
    const registerServer = cursorMcp?.registerServer;
    const unregisterServer = cursorMcp?.unregisterServer;

    if (typeof registerServer === 'function') {
        try {
            registerServer({
                name: mcpServerName,
                server: {
                    url: linggenMcpUrl
                }
            });

            outputChannel.appendLine(
                `Registered Cursor MCP server "${mcpServerName}" via Cursor Extension API: ${linggenMcpUrl}`
            );
            // Mark configured so the background monitor can refresh MCP when Linggen restarts.
            if (context) {
                setMcpConfigured(context, true);
            }

            // If Linggen isn't running yet, Cursor may show the server as unavailable until it retries.
            // We'll poll the Linggen backend and re-register once it becomes reachable to trigger a retry.
            void (async () => {
                const baseUrl = httpUrl.replace(/\/+$/, '');
                const isHealthyNow = await checkServerHealth(baseUrl);
                if (isHealthyNow) {
                    return;
                }

                const maxAttempts = 24; // ~2 minutes at 5s interval
                const intervalMs = 5000;
                outputChannel.appendLine(
                    `Linggen backend not reachable yet; will retry for up to ${Math.round(
                        (maxAttempts * intervalMs) / 1000
                    )}s and refresh MCP registration when it's up.`
                );

                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    await new Promise((r) => setTimeout(r, intervalMs));
                    const ok = await checkServerHealth(baseUrl);
                    if (!ok) {
                        continue;
                    }

                    try {
                        // Nudge Cursor to re-evaluate availability.
                        if (typeof unregisterServer === 'function') {
                            unregisterServer(mcpServerName);
                        }
                        registerServer({
                            name: mcpServerName,
                            server: { url: linggenMcpUrl }
                        });

                        outputChannel.appendLine(
                            `Linggen backend is up; refreshed Cursor MCP server registration for "${mcpServerName}".`
                        );
                        vscode.window.showInformationMessage(
                            'Linggen is running; refreshed Cursor MCP registration (server should become available).'
                        );
                    } catch (refreshError) {
                        outputChannel.appendLine(
                            `Linggen backend is up, but refreshing MCP registration failed: ${refreshError}`
                        );
                    }
                    return;
                }

                outputChannel.appendLine(
                    'Linggen backend still not reachable after retries; MCP may remain unavailable until Linggen starts.'
                );
            })();

            {
                const baseUrl = httpUrl.replace(/\/+$/, '');
                const isHealthyNow = await checkServerHealth(baseUrl);
                if (isHealthyNow) {
                    vscode.window.showInformationMessage('Connected to Linggen.');
                } else {
                    vscode.window.showInformationMessage(
                        'Linggen is not running. Start it in a terminal: linggen'
                    );
                }
            }
            return;
        } catch (error) {
            // If Cursor API exists but fails, fall back to file-based configuration.
            outputChannel.appendLine(
                `Cursor MCP Extension API registration failed, falling back to .cursor/mcp.json. Error: ${error}`
            );
        }
    }

    // Fallback: file-based configuration for non-Cursor environments or older Cursor versions.
    const linggenConfig = { url: linggenMcpUrl };

    try {
        let mcpConfig: { mcpServers?: Record<string, unknown> };
        let isNewFile = false;

        // Check if .cursor/mcp.json exists
        if (fs.existsSync(mcpJsonPath)) {
            // Read existing file
            const existingContent = fs.readFileSync(mcpJsonPath, 'utf8');
            mcpConfig = JSON.parse(existingContent);
            outputChannel.appendLine(`Found existing mcp.json at: ${mcpJsonPath}`);

            // If a linggen server is already configured, do nothing
            const existingServers = (mcpConfig.mcpServers ?? {}) as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(existingServers, mcpServerName)) {
                outputChannel.appendLine(
                    'Linggen MCP server already configured in mcp.json, skipping changes.'
                );
                vscode.window.showInformationMessage(
                    'Linggen MCP server is already configured in .cursor/mcp.json.'
                );
                return;
            }
        } else {
            // Create new configuration
            mcpConfig = { mcpServers: {} };
            isNewFile = true;
            outputChannel.appendLine(`Will create new mcp.json at: ${mcpJsonPath}`);
        }

        // Ensure mcpServers exists
        if (!mcpConfig.mcpServers) {
            mcpConfig.mcpServers = {};
        }

        (mcpConfig.mcpServers as Record<string, unknown>)[mcpServerName] = linggenConfig;

        // Create .cursor directory if it doesn't exist
        if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
            outputChannel.appendLine(`Created directory: ${cursorDir}`);
        }

        // Write the configuration
        fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf8');

        if (isNewFile) {
            outputChannel.appendLine('Created new mcp.json with Linggen configuration');
            vscode.window
                .showInformationMessage(
                    `Created .cursor/mcp.json with Linggen configuration. Restart Cursor to apply changes.`,
                    'Open File'
                )
                .then((selection) => {
                    if (selection === 'Open File') {
                        vscode.workspace.openTextDocument(mcpJsonPath).then((doc) => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
        } else {
            outputChannel.appendLine(
                'Updated existing mcp.json with Linggen configuration'
            );
            vscode.window
                .showInformationMessage(
                    `Updated .cursor/mcp.json with Linggen configuration. Restart Cursor to apply changes.`,
                    'Open File'
                )
                .then((selection) => {
                    if (selection === 'Open File') {
                        vscode.workspace.openTextDocument(mcpJsonPath).then((doc) => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
        }
    } catch (error) {
        const errorMsg = `Failed to configure mcp.json: ${error}`;
        outputChannel.appendLine(errorMsg as string);
        vscode.window.showErrorMessage(errorMsg as string);
    }
}

