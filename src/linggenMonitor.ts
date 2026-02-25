import * as vscode from 'vscode';
import { isLocalServer, getAgentUrl } from './helpers';
import { getOutputChannel } from './output';
import { BackendMonitor } from './healthMonitor';

const CONTEXT_IS_LOCAL_SERVER = 'linggen.isLocalServer';

/**
 * Background monitor that checks the Linggen Agent server.
 * - Shows status bar: `Linggen: ✓` / `Linggen: ✗`
 * - Sets context key: `linggen.agentRunning`
 * - Click → QuickPick showing backend status
 */
export function startLinggenHealthMonitor(
    context: vscode.ExtensionContext
): vscode.Disposable {
    const output = getOutputChannel();

    // --- Status bar ---
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBar.name = 'Linggen';
    statusBar.text = 'Linggen: $(sync~spin) checking…';
    statusBar.tooltip = 'Linggen: checking agent status…';
    statusBar.command = 'linggen.showBackendStatus';
    statusBar.show();

    // --- Monitor ---
    const agentMonitor = new BackendMonitor(
        'Agent',
        getAgentUrl,
        '/api/health',
        'linggen.agentRunning'
    );

    // --- Status bar update ---
    function updateStatusBar(): void {
        const a = agentMonitor.healthy;
        const icon = a === undefined ? '?' : a ? '✓' : '✗';

        statusBar.text = `Linggen: ${icon}`;
        statusBar.tooltip = `Agent: ${a ? 'running' : 'offline'} (${agentMonitor.url})`;

        void vscode.commands.executeCommand(
            'setContext',
            CONTEXT_IS_LOCAL_SERVER,
            isLocalServer(agentMonitor.url)
        );
    }

    // --- Wire events ---
    const agentSub = agentMonitor.onHealthChanged(() => {
        updateStatusBar();
    });

    // --- QuickPick command ---
    const statusCmd = vscode.commands.registerCommand('linggen.showBackendStatus', async () => {
        const items: vscode.QuickPickItem[] = [
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

    // --- Start monitor ---
    agentMonitor.start();

    // Initial status bar render after a short delay
    setTimeout(updateStatusBar, 500);

    // --- Config change listener ---
    const cfgListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('linggen.agent.url')) {
            agentMonitor.start();
            updateStatusBar();
        }
    });

    return new vscode.Disposable(() => {
        cfgListener.dispose();
        agentSub.dispose();
        statusCmd.dispose();
        statusBar.dispose();
        agentMonitor.dispose();
    });
}
