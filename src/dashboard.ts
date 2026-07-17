import * as vscode from 'vscode';
import * as lingMem from './lingMem';
import { getOutputChannel } from './output';

const READY_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 250;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function getHost(): string {
    return vscode.workspace.getConfiguration('linggen').get<string>('dashboard.host', '127.0.0.1');
}

export function getPort(): number {
    return vscode.workspace.getConfiguration('linggen').get<number>('dashboard.port', 9528);
}

export function isLocalHost(host: string): boolean {
    const h = host.toLowerCase().replace(/[[\]]/g, '');
    return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '0.0.0.0';
}

/**
 * Activation-time helper: make sure a ling-mem daemon is running locally,
 * without overriding one the user already started on a different port.
 * No-op when the host is remote or ling-mem isn't installed.
 */
export async function ensureDaemonRunning(): Promise<void> {
    if (!isLocalHost(getHost())) {return;}
    if (!lingMem.isInstalled()) {return;}

    const output = getOutputChannel();
    const existing = await lingMem.status();
    if (existing.state === 'running') {
        output.appendLine(`ling-mem daemon already running on port ${existing.port ?? '?'}`);
        return;
    }

    try {
        await lingMem.start(getPort());
    } catch (err) {
        output.appendLine(`Failed to start ling-mem daemon during activation: ${err}`);
    }
}

export async function openDashboard(): Promise<void> {
    const output = getOutputChannel();
    const host = getHost();
    const configuredPort = getPort();

    // Remote host: never autostart, just open the configured URL.
    if (!isLocalHost(host)) {
        output.appendLine(`Opening remote dashboard at http://${host}:${configuredPort}/`);
        await vscode.env.openExternal(vscode.Uri.parse(`http://${host}:${configuredPort}/`));
        return;
    }

    if (!lingMem.isInstalled()) {
        void vscode.window.showWarningMessage(
            'Linggen: ling-mem is not installed. Reload the window to retry installation.'
        );
        return;
    }

    const port = await resolveLocalPort(configuredPort);
    if (port === undefined) {
        return;
    }

    const ready = await waitForReady();
    if (!ready) {
        void vscode.window.showWarningMessage(
            'Linggen: ling-mem daemon did not report healthy in time. Opening dashboard anyway.'
        );
    }

    await vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${port}/`));
}

async function resolveLocalPort(configuredPort: number): Promise<number | undefined> {
    const output = getOutputChannel();

    // Use the port reported by an already-running daemon, regardless of which
    // port the user configured — the user may have started ling-mem manually
    // on a different port, or another tool autostarted it.
    const existing = await lingMem.status();
    if (existing.state === 'running' && typeof existing.port === 'number') {
        output.appendLine(`ling-mem already running on port ${existing.port}; using it`);
        return existing.port;
    }

    try {
        await lingMem.start(configuredPort);
    } catch (err) {
        output.appendLine(`Failed to start ling-mem daemon: ${err}`);
        void vscode.window.showErrorMessage(
            `Linggen: failed to start ling-mem daemon. ${err instanceof Error ? err.message : String(err)}`
        );
        return undefined;
    }

    // After start, re-read status so we open the port ling-mem actually bound.
    const after = await lingMem.status();
    if (after.state === 'running' && typeof after.port === 'number') {
        return after.port;
    }
    return configuredPort;
}

async function waitForReady(): Promise<boolean> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const s = await lingMem.status();
        if (s.state === 'running' && s.health === 'ok') {return true;}
        await sleep(POLL_INTERVAL_MS);
    }
    return false;
}
