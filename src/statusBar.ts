import * as vscode from 'vscode';
import * as lingMem from './lingMem';

const POLL_INTERVAL_MS = 30000;

export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    item.name = 'Linggen';
    item.text = 'Linggen: $(sync~spin)';
    item.tooltip = 'Linggen — checking ling-mem status…';
    item.command = 'linggen.openDashboard';
    item.show();

    void refresh(item);
    const handle = setInterval(() => void refresh(item), POLL_INTERVAL_MS);

    context.subscriptions.push(
        item,
        new vscode.Disposable(() => clearInterval(handle))
    );

    return item;
}

async function refresh(item: vscode.StatusBarItem): Promise<void> {
    if (!lingMem.isInstalled()) {
        item.text = 'Linggen: $(warning)';
        item.tooltip = 'ling-mem not installed — reload the window to retry installation';
        return;
    }

    const s = await lingMem.status();
    if (s.state === 'running' && s.health === 'ok') {
        item.text = 'Linggen: $(check)';
        item.tooltip = `ling-mem running on port ${s.port ?? '?'} — click to open dashboard`;
    } else if (s.state === 'running') {
        item.text = 'Linggen: $(warning)';
        item.tooltip = `ling-mem running (health: ${s.health ?? 'unknown'}) — click to open dashboard`;
    } else {
        item.text = 'Linggen: $(circle-slash)';
        item.tooltip = 'ling-mem daemon not running — click to start and open dashboard';
    }
}
