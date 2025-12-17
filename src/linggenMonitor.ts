import * as vscode from 'vscode';
import { checkServerHealth } from './helpers';
import { getOutputChannel } from './output';

const MCP_CONFIGURED_KEY = 'linggen.mcpConfigured';

type CursorMcpApi = {
    registerServer?: (cfg: { name: string; server: { url: string } }) => void;
    unregisterServer?: (serverName: string) => void;
};

const MCP_SERVER_NAME = 'Linggen';

async function isMcpSseEndpointResponsive(url: string): Promise<boolean> {
    try {
        // For SSE endpoints, fetch() resolves once headers arrive. We immediately
        // cancel the body to avoid keeping an open stream from background polling.
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
): void {
    const cursorMcp = (vscode as unknown as { cursor?: { mcp?: CursorMcpApi } }).cursor?.mcp;
    const registerServer = cursorMcp?.registerServer;
    const unregisterServer = cursorMcp?.unregisterServer;
    if (typeof registerServer !== 'function') {
        return;
    }

    try {
        if (mode === 'refresh' && typeof unregisterServer === 'function') {
            unregisterServer(MCP_SERVER_NAME);
        }
        registerServer({ name: MCP_SERVER_NAME, server: { url: linggenMcpUrl } });
    } catch (e) {
        // Best-effort only; avoid noisy popups from background polling.
        getOutputChannel().appendLine(
            `Failed to ${mode === 'refresh' ? 'refresh' : 'register'} Cursor MCP: ${String(e)}`
        );
    }
}

export function setMcpConfigured(context: vscode.ExtensionContext, value: boolean): void {
    void context.globalState.update(MCP_CONFIGURED_KEY, value);
}

/**
 * Background monitor that periodically checks Linggen availability via /api/status.
 * - Updates a status bar item (optional)
 * - Detects transitions (down->up / up->down)
 * - If user previously "connected" Linggen MCP, refresh registration when Linggen comes back up
 */
export function startLinggenHealthMonitor(
    context: vscode.ExtensionContext
): vscode.Disposable {
    const output = getOutputChannel();

    let timer: NodeJS.Timeout | undefined;
    let lastHealthy: boolean | undefined;
    let mcpRegisterInFlight = false;

    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBar.name = 'Linggen';
    statusBar.command = 'linggen.configureCursorMsp';
    // Visible immediately on startup so users see "loading" while the first health check runs.
    statusBar.text = 'Linggen: $(sync~spin) checking…';
    statusBar.tooltip = 'Linggen: checking server status…';

    const updateFromConfig = () => {
        const cfg = vscode.workspace.getConfiguration('linggen');
        const enabled = cfg.get<boolean>('healthPoll.enabled', true);
        const intervalMs = cfg.get<number>('healthPoll.intervalMs', 5000);
        const showStatus = cfg.get<boolean>('healthPoll.showStatusBar', true);
        const httpUrl = cfg.get<string>('backend.httpUrl', 'http://localhost:8787');
        const baseUrl = httpUrl.replace(/\/+$/, '');
        const linggenMcpUrl = `${baseUrl}/mcp/sse`;

        if (showStatus) {
            statusBar.show();
        } else {
            statusBar.hide();
        }

        if (!enabled) {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
            statusBar.text = 'Linggen: $(circle-slash) monitoring off';
            statusBar.tooltip = 'Linggen health monitoring is disabled';
            return;
        }

        // Reset to a "checking…" state whenever monitoring restarts (startup / config change).
        lastHealthy = undefined;
        statusBar.text = 'Linggen: $(sync~spin) checking…';
        statusBar.tooltip = `Linggen: checking server status… (${baseUrl})`;

        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }

        const tick = async () => {
            const ok = await checkServerHealth(baseUrl);

            if (ok) {
                statusBar.text = 'Linggen: $(check) running';
                statusBar.tooltip = `Linggen is reachable at ${baseUrl}`;
            } else {
                statusBar.text = 'Linggen: $(error) offline';
                statusBar.tooltip = `Linggen is not reachable at ${baseUrl}`;
            }

            const ensureMcpRegisteredOrRefreshed = async () => {
                if (mcpRegisterInFlight) {
                    return;
                }
                mcpRegisterInFlight = true;
                try {
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

                    if (configured) {
                        // Refresh: unregister+register. A second refresh a moment later helps some clients exit "loading tools".
                        tryRegisterOrRefreshCursorMcpRegistration(linggenMcpUrl, 'refresh');
                        await new Promise((r) => setTimeout(r, 1500));
                        tryRegisterOrRefreshCursorMcpRegistration(linggenMcpUrl, 'refresh');
                    } else {
                        // First-time register: don't unregister (can cause some clients to spin in "loading tools").
                        tryRegisterOrRefreshCursorMcpRegistration(linggenMcpUrl, 'register');
                    }

                    // Mark configured so future runs treat this as connected.
                    setMcpConfigured(context, true);
                } finally {
                    mcpRegisterInFlight = false;
                }
            };

            if (lastHealthy === undefined) {
                lastHealthy = ok;
                if (ok) {
                    void ensureMcpRegisteredOrRefreshed();
                }
                return;
            }

            if (lastHealthy !== ok) {
                // transition
                lastHealthy = ok;
                output.appendLine(`Linggen health changed: ${ok ? 'UP' : 'DOWN'} (${baseUrl})`);

                if (ok) {
                    void ensureMcpRegisteredOrRefreshed();
                }
            }
        };

        // Run once immediately, then on interval.
        void tick();
        timer = setInterval(() => void tick(), Math.max(1000, intervalMs));
    };

    updateFromConfig();

    const cfgListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (
            e.affectsConfiguration('linggen.backend.httpUrl') ||
            e.affectsConfiguration('linggen.healthPoll.enabled') ||
            e.affectsConfiguration('linggen.healthPoll.intervalMs') ||
            e.affectsConfiguration('linggen.healthPoll.showStatusBar')
        ) {
            updateFromConfig();
        }
    });

    return new vscode.Disposable(() => {
        cfgListener.dispose();
        statusBar.dispose();
        if (timer) {
            clearInterval(timer);
        }
    });
}


