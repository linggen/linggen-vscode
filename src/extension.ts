import * as vscode from 'vscode';
import { getOutputChannel, disposeOutputChannel } from './output';
import * as install from './install';
import * as bridge from './bridge';
import * as dashboard from './dashboard';
import * as statusBar from './statusBar';
import * as telemetry from './telemetry';

const PLATFORM_SUPPORTED = process.platform === 'darwin' || process.platform === 'linux';

export function activate(context: vscode.ExtensionContext): void {
    const output = getOutputChannel();
    output.appendLine('Linggen extension activated');

    telemetry.init(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('linggen.openDashboard', async () => {
            telemetry.fireCommand('open_dashboard');
            await dashboard.openDashboard();
        }),
        vscode.commands.registerCommand('linggen.bridgeSettings', async () => {
            telemetry.fireCommand('bridge_settings');
            await bridge.promptConsent(context);
            await bridge.applyToWorkspace(context);
        })
    );

    statusBar.createStatusBar(context);

    if (!PLATFORM_SUPPORTED) {
        output.appendLine(`Platform ${process.platform} is not supported by ling-mem (macOS / Linux only).`);
        void vscode.window.showWarningMessage(
            'Linggen: ling-mem currently supports macOS and Linux only. The extension will not function on this platform.'
        );
        return;
    }

    void setupAsync(context);
}

async function setupAsync(context: vscode.ExtensionContext): Promise<void> {
    const output = getOutputChannel();
    const firstRun = !bridge.hasConsent(context);

    const installed = await install.ensureInstalled();
    if (!installed) {
        output.appendLine('ling-mem install incomplete; deferring further setup.');
        return;
    }

    if (firstRun) {
        await telemetry.recordInstallSource();
        const version = vscode.extensions.getExtension('linggen.linggen-vscode')?.packageJSON?.version ?? 'unknown';
        telemetry.fireInstall(version);
        await bridge.promptConsent(context);
    }

    await dashboard.ensureDaemonRunning();

    await bridge.applyToWorkspace(context);

    if (firstRun) {
        showFirstRunWelcome(bridge.getConsent(context));
    }
}

function showFirstRunWelcome(consent: string[]): void {
    if (consent.length === 0) {
        void vscode.window.showInformationMessage(
            'Linggen is installed. No agents were selected for bridging — run "Linggen: Bridge Settings" to choose.'
        );
        return;
    }
    const agentList = consent.join(', ');
    void vscode.window.showInformationMessage(
        `Linggen is ready. Your memory is now wired into: ${agentList}. ` +
        `Open the dashboard from the status bar (lower-left).`
    );
}

export function deactivate(): void {
    disposeOutputChannel();
}
