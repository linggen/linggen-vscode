import * as vscode from 'vscode';
import * as lingMem from './lingMem';
import { getOutputChannel } from './output';

const INSTALL_SCRIPT_URL = 'https://linggen.dev/install-shared-memory.sh';
// LING_MEM_SOURCE flows into ling-mem's own install-source marker so its
// telemetry can attribute installs that came through this extension. See
// install.sh: write_install_source_marker() reads $LING_MEM_SOURCE.
const INSTALL_CMD = `curl -fsSL ${INSTALL_SCRIPT_URL} | LING_MEM_SOURCE=vscode-extension bash`;
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function ensureInstalled(): Promise<boolean> {
    if (lingMem.isInstalled()) {
        getOutputChannel().appendLine(
            `ling-mem already installed at ${lingMem.binaryPath()} — skipping install`
        );
        return true;
    }
    return runInstallInTerminal();
}

async function runInstallInTerminal(): Promise<boolean> {
    const output = getOutputChannel();
    output.appendLine(`Installing ling-mem via ${INSTALL_SCRIPT_URL}`);

    const terminal = vscode.window.createTerminal({ name: 'Linggen Setup' });
    terminal.show(true);
    terminal.sendText(INSTALL_CMD, true);

    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Installing ling-mem',
            cancellable: true
        },
        async (progress, token) => {
            progress.report({ message: 'Waiting for install-shared-memory.sh to finish…' });
            const deadline = Date.now() + TIMEOUT_MS;
            while (Date.now() < deadline) {
                if (token.isCancellationRequested) {
                    output.appendLine('Install wait cancelled by user.');
                    return false;
                }
                await sleep(POLL_INTERVAL_MS);
                if (lingMem.isInstalled()) {
                    output.appendLine(`ling-mem installed at ${lingMem.binaryPath()}`);
                    return true;
                }
            }
            output.appendLine('Timed out waiting for ling-mem installation.');
            void vscode.window.showWarningMessage(
                'Linggen: ling-mem install did not complete within 5 minutes. Check the Linggen Setup terminal for errors.'
            );
            return false;
        }
    );
}
