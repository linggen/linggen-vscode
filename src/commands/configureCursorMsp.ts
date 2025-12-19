import * as vscode from 'vscode';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { setMcpConfigured } from '../linggenMonitor';

// Cursor's MCP Extension API Reference:
// https://cursor.com/docs/context/mcp-extension-api#mcp-extension-api-reference
interface CursorMcpApi {
    registerServer?: (cfg: {
        name: string;
        server:
            | { url: string; headers?: Record<string, string> }
            | { command: string; args: string[]; env: Record<string, string> };
    }) => void;
    unregisterServer?: (serverName: string) => void;
}

/**
 * Command: Linggen: Connect to Linggen
 * Registers the Linggen MCP server programmatically using Cursor's MCP Extension API.
 */
export async function configureCursorMsp(context?: vscode.ExtensionContext): Promise<void> {
    const outputChannel = getOutputChannel();
    const mcpServerName = 'Linggen';

    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');
    const baseUrl = httpUrl.replace(/\/+$/, '');
    const linggenMcpUrl = `${baseUrl}/mcp/sse`;

    const cursorMcp = (vscode as unknown as { cursor?: { mcp?: CursorMcpApi } }).cursor?.mcp;
    const registerServer = cursorMcp?.registerServer;
    const unregisterServer = cursorMcp?.unregisterServer;

    if (typeof registerServer !== 'function') {
        vscode.window.showErrorMessage(
            'Cursor MCP Extension API is not available. This command only works in Cursor.'
        );
        return;
    }

    try {
        registerServer({
            name: mcpServerName,
            server: { url: linggenMcpUrl }
        });

        outputChannel.appendLine(
            `Registered Cursor MCP server "${mcpServerName}" via Cursor Extension API: ${linggenMcpUrl}`
        );

        if (context) {
            setMcpConfigured(context, true);
        }

        const isHealthyNow = await checkServerHealth(baseUrl);
        if (isHealthyNow) {
            vscode.window.showInformationMessage('Connected to Linggen.');
        } else {
            vscode.window.showInformationMessage(
                'Linggen is not running. Start it in a terminal: linggen'
            );

            // Background retry
            const runRetry = async () => {
                const maxAttempts = 24;
                const intervalMs = 5000;
                outputChannel.appendLine('Linggen not reachable; background retry started.');

                for (let i = 1; i <= maxAttempts; i++) {
                    await new Promise((r) => setTimeout(r, intervalMs));
                    const ok = await checkServerHealth(baseUrl);
                    if (ok) {
                        try {
                            if (typeof unregisterServer === 'function') {
                                unregisterServer(mcpServerName);
                            }
                            registerServer({
                                name: mcpServerName,
                                server: { url: linggenMcpUrl }
                            });
                            outputChannel.appendLine('Linggen is up; refreshed MCP registration.');
                            vscode.window.showInformationMessage('Linggen is running; MCP refreshed.');
                        } catch (e) {
                            outputChannel.appendLine(`Retry refresh failed: ${e}`);
                        }
                        return;
                    }
                }
            };
            void runRetry();
        }
    } catch (error) {
        outputChannel.appendLine(`Cursor API registration failed: ${error}`);
        vscode.window.showErrorMessage(`Failed to register Linggen MCP: ${error}`);
    }
}
