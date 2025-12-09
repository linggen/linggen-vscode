import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOutputChannel } from '../output';

/**
 * Command: Linggen: Configure Cursor msp.json
 * Creates or updates .cursor/mcp.json with Linggen configuration.
 */
export async function configureCursorMsp(): Promise<void> {
    const outputChannel = getOutputChannel();
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

    const linggenConfig = {
        url: `${httpUrl.replace(/\/+$/, '')}/mcp/sse`
    };

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
            if (Object.prototype.hasOwnProperty.call(existingServers, 'linggen')) {
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

        // Add linggen entry only if it doesn't exist yet
        mcpConfig.mcpServers.linggen = linggenConfig;

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

