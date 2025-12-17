import * as vscode from 'vscode';
import { getOutputChannel } from '../output';

/**
 * Helper: Open the Linggen website for installation instructions.
 */
export async function installLinggen(): Promise<void> {
    const outputChannel = getOutputChannel();
    const config = vscode.workspace.getConfiguration('linggen');
    const installUrl = config.get<string>('installUrl', 'https://linggen.dev');

    outputChannel.appendLine(`Opening Linggen installation page: ${installUrl}`);

    try {
        await vscode.env.openExternal(vscode.Uri.parse(installUrl));
        vscode.window.showInformationMessage(
            'Opening Linggen installation page in your browser...'
        );
    } catch (error) {
        const errorMsg = `Failed to open installation page: ${error}`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg as string);
    }
}

/**
 * Command: Linggen: Install Linggen CLI
 *
 * VS Code extensions cannot silently install software. This command asks for explicit
 * confirmation and then runs the official installer script in an integrated terminal.
 */
export async function installLinggenCli(): Promise<void> {
    const outputChannel = getOutputChannel();
    const config = vscode.workspace.getConfiguration('linggen');
    const installUrl = config.get<string>('installUrl', 'https://linggen.dev');

    const step1 = 'curl -fsSL https://linggen.dev/install-cli.sh | bash';
    const step2 = 'linggen install';
    const openWebsiteLabel = `Open ${installUrl}`;

    const choice = await vscode.window.showWarningMessage(
        'Linggen is required for this extension.\n\nThis will run the following commands in an integrated terminal:\n\n' +
            `${step1}\n${step2}`,
        { modal: true },
        'Run installer in Terminal',
        openWebsiteLabel,
        'Cancel'
    );

    if (!choice || choice === 'Cancel') {
        outputChannel.appendLine('Linggen CLI install cancelled by user.');
        return;
    }

    if (choice === openWebsiteLabel) {
        await installLinggen();
        return;
    }

    outputChannel.appendLine('Starting Linggen CLI installer in integrated terminal…');
    const terminal = vscode.window.createTerminal({
        name: 'Linggen Installer'
    });
    terminal.show(true);
    terminal.sendText(step1, true);
    terminal.sendText(step2, true);
    vscode.window.showInformationMessage(
        'Linggen install started in the Terminal. When it finishes, start Linggen with: linggen'
    );
}

