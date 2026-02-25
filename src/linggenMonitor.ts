import * as vscode from 'vscode';
import { isLocalServer, getMemoryUrl, getAgentUrl } from './helpers';
import { getOutputChannel } from './output';
import { BackendMonitor } from './healthMonitor';

const MCP_CONFIGURED_KEY = 'linggen.mcpConfigured';
const CONTEXT_IS_LOCAL_SERVER = 'linggen.isLocalServer';

type CursorMcpApi = {
    registerServer?: (cfg: { name: string; server: { url: string } }) => void;
    unregisterServer?: (serverName: string) => void;
};

const MCP_SERVER_NAME = 'Linggen';

async function isMcpSseEndpointResponsive(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(1500)
        });
        try {
            res.body?.cancel();
        } catch {
            // ignore
        }
        return res.ok;
    } catch {
        return false;
    }
}

async function waitForMcpReady(url: string, attempts: number, intervalMs: number): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
        const ok = await isMcpSseEndpointResponsive(url);
        if (ok) {
            return true;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
}

function tryRegisterOrRefreshCursorMcpRegistration(
    linggenMcpUrl: string,
    mode: 'register' | 'refresh'
): boolean {
    const cursorMcp = (vscode as unknown as { cursor?: { mcp?: CursorMcpApi } }).cursor?.mcp;
    const registerServer = cursorMcp?.registerServer;
    const unregisterServer = cursorMcp?.unregisterServer;
    if (typeof registerServer !== 'function') {
        return false;
    }

    try {
        if (mode === 'refresh' && typeof unregisterServer === 'function') {
            unregisterServer(MCP_SERVER_NAME);
        }
        registerServer({ name: MCP_SERVER_NAME, server: { url: linggenMcpUrl } });
        return true;
    } catch (e) {
        getOutputChannel().appendLine(
            `Failed to ${mode === 'refresh' ? 'refresh' : 'register'} Cursor MCP: ${String(e)}`
        );
        return false;
    }
}

export function setMcpConfigured(context: vscode.ExtensionContext, value: boolean): void {
    void context.globalState.update(MCP_CONFIGURED_KEY, value);
}

/**
 * Background monitor that checks both Linggen Memory and Linggen Agent servers.
 * - Shows a combined status bar: `Linggen: M✓ A✓` / `M✓ A✗` / etc.
 * - Sets context keys: `linggen.memoryRunning`, `linggen.agentRunning`
 * - MCP registration reacts to memory monitor's onHealthChanged
 * - Click → QuickPick showing both backends
 */
export function startLinggenHealthMonitor(
    context: vscode.ExtensionContext
): vscode.Disposable {
    const output = getOutputChannel();
    let mcpRegisterInFlight = false;

    // --- Status bar ---
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBar.name = 'Linggen';
    statusBar.text = 'Linggen: $(sync~spin) checking…';
    statusBar.tooltip = 'Linggen: checking server status…';
    statusBar.command = 'linggen.showBackendStatus';
    statusBar.show();

    // --- Monitors ---
    const memoryMonitor = new BackendMonitor(
        'Memory',
        getMemoryUrl,
        '/api/status',
        'linggen.memoryRunning'
    );

    const agentMonitor = new BackendMonitor(
        'Agent',
        getAgentUrl,
        '/api/health',
        'linggen.agentRunning'
    );

    // --- Combined status bar update ---
    function updateStatusBar(): void {
        const m = memoryMonitor.healthy;
        const a = agentMonitor.healthy;

        const mIcon = m === undefined ? '?' : m ? '✓' : '✗';
        const aIcon = a === undefined ? '?' : a ? '✓' : '✗';

        statusBar.text = `Linggen: M${mIcon} A${aIcon}`;

        const lines: string[] = [];
        lines.push(`Memory: ${m ? 'running' : 'offline'} (${memoryMonitor.url})`);
        lines.push(`Agent: ${a ? 'running' : 'offline'} (${agentMonitor.url})`);
        statusBar.tooltip = lines.join('\n');

        // Backward compat: set isLocalServer from memory URL
        void vscode.commands.executeCommand(
            'setContext',
            CONTEXT_IS_LOCAL_SERVER,
            isLocalServer(memoryMonitor.url)
        );
    }

    // --- MCP registration (reacts to Memory monitor) ---
    async function ensureMcpRegisteredOrRefreshed(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration('linggen');
        const mcpEnabled = cfg.get<boolean>('mcp.enabled', false);
        if (!mcpEnabled) {
            return;
        }
        if (mcpRegisterInFlight) {
            return;
        }
        mcpRegisterInFlight = true;
        try {
            const baseUrl = getMemoryUrl();
            const linggenMcpUrl = `${baseUrl}/mcp/sse`;
            const configured = context.globalState.get<boolean>(MCP_CONFIGURED_KEY, false);

            output.appendLine(
                configured
                    ? `Linggen is up, refreshing Cursor MCP registration: ${linggenMcpUrl}`
                    : `Linggen is up, registering Cursor MCP server: ${linggenMcpUrl}`
            );

            const ready = await waitForMcpReady(linggenMcpUrl, 10, 1000);
            if (!ready) {
                output.appendLine(
                    `Linggen is up, but MCP endpoint still not responsive: ${linggenMcpUrl}`
                );
                return;
            }

            let success = false;
            if (configured) {
                success = tryRegisterOrRefreshCursorMcpRegistration(linggenMcpUrl, 'refresh');
                if (success) {
                    await new Promise((r) => setTimeout(r, 1500));
                    tryRegisterOrRefreshCursorMcpRegistration(linggenMcpUrl, 'refresh');
                }
            } else {
                success = tryRegisterOrRefreshCursorMcpRegistration(linggenMcpUrl, 'register');
            }

            if (success) {
                setMcpConfigured(context, true);
            } else {
                output.appendLine(
                    'Cursor MCP Extension API not available; programmatic registration skipped.'
                );
            }
        } finally {
            mcpRegisterInFlight = false;
        }
    }

    // --- Wire events ---
    const memSub = memoryMonitor.onHealthChanged((healthy) => {
        updateStatusBar();
        if (healthy) {
            void ensureMcpRegisteredOrRefreshed();
        }
    });
    const agentSub = agentMonitor.onHealthChanged(() => {
        updateStatusBar();
    });

    // --- QuickPick command ---
    const statusCmd = vscode.commands.registerCommand('linggen.showBackendStatus', async () => {
        const items: vscode.QuickPickItem[] = [
            {
                label: `$(server) Memory: ${memoryMonitor.healthy ? 'running' : 'offline'}`,
                description: memoryMonitor.url,
                detail: 'Linggen Memory server (ling-mem)'
            },
            {
                label: `$(server) Agent: ${agentMonitor.healthy ? 'running' : 'offline'}`,
                description: agentMonitor.url,
                detail: 'Linggen Agent server (ling)'
            }
        ];
        await vscode.window.showQuickPick(items, {
            title: 'Linggen Backend Status',
            placeHolder: 'Backend servers'
        });
    });

    // --- Start monitors ---
    memoryMonitor.start();
    agentMonitor.start();

    // Initial status bar render after a short delay to let first ticks complete
    setTimeout(updateStatusBar, 500);

    // --- Config change listener ---
    const cfgListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (
            e.affectsConfiguration('linggen.memory.url') ||
            e.affectsConfiguration('linggen.agent.url') ||
            e.affectsConfiguration('linggen.backend.httpUrl') ||
            e.affectsConfiguration('linggen.mcp.enabled')
        ) {
            memoryMonitor.start();
            agentMonitor.start();
            updateStatusBar();
        }
    });

    return new vscode.Disposable(() => {
        cfgListener.dispose();
        memSub.dispose();
        agentSub.dispose();
        statusCmd.dispose();
        statusBar.dispose();
        memoryMonitor.dispose();
        agentMonitor.dispose();
    });
}
