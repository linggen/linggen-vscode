import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let outputChannel: vscode.OutputChannel;
let linggenProcess: child_process.ChildProcess | null = null;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Linggen');
    outputChannel.appendLine('Linggen extension activated');

    // Register all commands
    context.subscriptions.push(
        vscode.commands.registerCommand('linggen.install', installLinggen),
        vscode.commands.registerCommand('linggen.start', startLinggen),
        vscode.commands.registerCommand('linggen.indexCurrentProject', indexCurrentProject),
        vscode.commands.registerCommand('linggen.openInLinggen', openInLinggen),
        vscode.commands.registerCommand('linggen.configureCursorMsp', configureCursorMsp)
    );
}

export function deactivate() {
    if (linggenProcess) {
        outputChannel.appendLine('Stopping Linggen process...');
        linggenProcess.kill();
        linggenProcess = null;
    }
}

/**
 * Command: Linggen: Install Linggen
 * Opens the Linggen website for installation instructions
 */
async function installLinggen() {
    const config = vscode.workspace.getConfiguration('linggen');
    const installUrl = config.get<string>('installUrl', 'https://linggen.dev');
    
    outputChannel.appendLine(`Opening Linggen installation page: ${installUrl}`);
    
    try {
        await vscode.env.openExternal(vscode.Uri.parse(installUrl));
        vscode.window.showInformationMessage('Opening Linggen installation page in your browser...');
    } catch (error) {
        const errorMsg = `Failed to open installation page: ${error}`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
}

/**
 * Command: Linggen: Start Linggen
 * Starts the Linggen backend server
 */
async function startLinggen() {
    const config = vscode.workspace.getConfiguration('linggen');
    const mode = config.get<string>('backend.mode', 'http');
    const cliPath = config.get<string>('backend.cliPath', 'linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:3030');

    // Check if server is already running (HTTP mode)
    if (mode === 'http') {
        try {
            const isRunning = await checkServerHealth(httpUrl);
            if (isRunning) {
                vscode.window.showInformationMessage('Linggen server is already running');
                outputChannel.appendLine('Linggen server is already running');
                return;
            }
        } catch (error) {
            outputChannel.appendLine('Server not reachable, will attempt to start...');
        }
    }

    // Start the Linggen process
    outputChannel.appendLine(`Starting Linggen with command: ${cliPath} start`);
    
    try {
        linggenProcess = child_process.spawn(cliPath, ['start'], {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        linggenProcess.stdout?.on('data', (data) => {
            outputChannel.appendLine(`[stdout] ${data.toString()}`);
        });

        linggenProcess.stderr?.on('data', (data) => {
            outputChannel.appendLine(`[stderr] ${data.toString()}`);
        });

        linggenProcess.on('error', (error) => {
            const errorMsg = `Failed to start Linggen: ${error.message}`;
            outputChannel.appendLine(errorMsg);
            vscode.window.showErrorMessage(errorMsg + '\n\nMake sure Linggen is installed. Run "Linggen: Install Linggen" for instructions.');
        });

        linggenProcess.on('exit', (code) => {
            outputChannel.appendLine(`Linggen process exited with code ${code}`);
            linggenProcess = null;
        });

        vscode.window.showInformationMessage('Starting Linggen server...');
        outputChannel.show();
    } catch (error) {
        const errorMsg = `Failed to start Linggen: ${error}`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
}

/**
 * Command: Linggen: Index Current Project
 * Triggers indexing of the current workspace
 */
async function indexCurrentProject() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('linggen');
    const mode = config.get<string>('backend.mode', 'http');
    const cliPath = config.get<string>('backend.cliPath', 'linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:3030');

    outputChannel.appendLine(`Indexing project: ${workspacePath}`);

    if (mode === 'cli') {
        // CLI mode: run linggen index command
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing project with Linggen...',
            cancellable: false
        }, async () => {
            return new Promise<void>((resolve, reject) => {
                const indexProcess = child_process.spawn(cliPath, ['index', workspacePath], {
                    shell: true
                });

                indexProcess.stdout?.on('data', (data) => {
                    outputChannel.appendLine(`[index] ${data.toString()}`);
                });

                indexProcess.stderr?.on('data', (data) => {
                    outputChannel.appendLine(`[index error] ${data.toString()}`);
                });

                indexProcess.on('error', (error) => {
                    const errorMsg = `Failed to index project: ${error.message}`;
                    outputChannel.appendLine(errorMsg);
                    vscode.window.showErrorMessage(errorMsg);
                    reject(error);
                });

                indexProcess.on('exit', (code) => {
                    if (code === 0) {
                        outputChannel.appendLine('Project indexed successfully');
                        vscode.window.showInformationMessage('Project indexed successfully');
                        resolve();
                    } else {
                        const errorMsg = `Indexing failed with exit code ${code}`;
                        outputChannel.appendLine(errorMsg);
                        vscode.window.showErrorMessage(errorMsg);
                        reject(new Error(errorMsg));
                    }
                });
            });
        });
    } else {
        // HTTP mode: call the index endpoint
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing project with Linggen...',
            cancellable: false
        }, async () => {
            try {
                // TODO: Implement HTTP API call to index endpoint
                // For now, show a placeholder message
                const endpoint = `${httpUrl}/api/index`;
                outputChannel.appendLine(`Would call: POST ${endpoint} with path: ${workspacePath}`);
                vscode.window.showInformationMessage('HTTP indexing not yet fully implemented. Use CLI mode or trigger indexing from Linggen UI.');
            } catch (error) {
                const errorMsg = `Failed to index project: ${error}`;
                outputChannel.appendLine(errorMsg);
                vscode.window.showErrorMessage(errorMsg);
            }
        });
    }
}

/**
 * Command: Linggen: Open in Linggen
 * Opens the selected file/folder in Linggen's UI
 */
async function openInLinggen(uri?: vscode.Uri) {
    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:3030');

    // Determine the file/folder to open
    let targetPath: string;
    if (uri) {
        targetPath = uri.fsPath;
    } else if (vscode.window.activeTextEditor) {
        targetPath = vscode.window.activeTextEditor.document.uri.fsPath;
    } else {
        vscode.window.showErrorMessage('No file or folder selected');
        return;
    }

    // Get workspace folder for relative path calculation
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let relativePath = targetPath;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        if (targetPath.startsWith(workspaceRoot)) {
            relativePath = path.relative(workspaceRoot, targetPath);
        }
    }

    // Build Linggen URL with file parameter
    const linggenUrl = `${httpUrl}/?file=${encodeURIComponent(relativePath)}`;
    
    outputChannel.appendLine(`Opening in Linggen: ${targetPath}`);
    outputChannel.appendLine(`URL: ${linggenUrl}`);

    try {
        await vscode.env.openExternal(vscode.Uri.parse(linggenUrl));
        vscode.window.showInformationMessage(`Opening ${path.basename(targetPath)} in Linggen...`);
    } catch (error) {
        const errorMsg = `Failed to open Linggen: ${error}`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg + '\n\nMake sure Linggen server is running. Use "Linggen: Start Linggen" to start it.');
    }
}

/**
 * Command: Linggen: Configure Cursor msp.json
 * Creates or updates .cursor/mcp.json with Linggen configuration
 */
async function configureCursorMsp() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const mcpJsonPath = path.join(cursorDir, 'mcp.json');

    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:3030');
    
    // Extract base URL and construct SSE endpoint
    const baseUrl = httpUrl.replace(/\/$/, ''); // Remove trailing slash if present
    const mcpUrl = `${baseUrl}/mcp/sse`;

    const linggenConfig = {
        "url": mcpUrl
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

        // Add or update linggen entry
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
            vscode.window.showInformationMessage(
                `Created .cursor/mcp.json with Linggen configuration. Restart Cursor to apply changes.`,
                'Open File'
            ).then(selection => {
                if (selection === 'Open File') {
                    vscode.workspace.openTextDocument(mcpJsonPath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                }
            });
        } else {
            outputChannel.appendLine('Updated existing mcp.json with Linggen configuration');
            vscode.window.showInformationMessage(
                `Updated .cursor/mcp.json with Linggen configuration. Restart Cursor to apply changes.`,
                'Open File'
            ).then(selection => {
                if (selection === 'Open File') {
                    vscode.workspace.openTextDocument(mcpJsonPath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                }
            });
        }
    } catch (error) {
        const errorMsg = `Failed to configure mcp.json: ${error}`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
}

/**
 * Helper: Check if Linggen server is healthy
 */
async function checkServerHealth(httpUrl: string): Promise<boolean> {
    // Simple health check - in a real implementation, you'd use an HTTP library
    // For now, this is a placeholder that always returns false
    // TODO: Implement actual HTTP health check
    return false;
}

