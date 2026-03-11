import * as vscode from 'vscode';
import { getOutputChannel } from '../output';

/**
 * Helper: Open the Linggen website for installation instructions.
 */
export async function installLinggen(): Promise<void> {
    const outputChannel = getOutputChannel();
    const installUrl = 'https://linggen.dev';

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
 * Command: Linggen: Install/Update
 *
 * Offers to install Linggen (ling) or open the website.
 */
export async function installLinggenCli(): Promise<void> {
    const outputChannel = getOutputChannel();

    const pick = await vscode.window.showQuickPick(
        [
            {
                label: '$(rocket) Install Linggen (ling)',
                description: 'Autonomous coding agent',
                id: 'agent'
            },
            {
                label: '$(globe) Open website',
                description: 'https://linggen.dev',
                id: 'website'
            }
        ],
        {
            title: 'Install Linggen',
            placeHolder: 'Choose what to install'
        }
    );

    if (!pick) {
        return;
    }

    if (pick.id === 'website') {
        await installLinggen();
        return;
    }

    const binaryName = 'Linggen (ling)';
    const installScript = 'curl -fsSL https://linggen.dev/install.sh | bash';
    const startCmd = 'ling';

    const choice = await vscode.window.showWarningMessage(
        `${binaryName} will be installed by running:\n\n${installScript}`,
        { modal: true },
        'Run installer in Terminal',
        'Cancel'
    );

    if (!choice || choice === 'Cancel') {
        outputChannel.appendLine(`${binaryName} install cancelled by user.`);
        return;
    }

    outputChannel.appendLine(`Starting ${binaryName} installer in integrated terminal…`);
    const terminal = vscode.window.createTerminal({
        name: `${binaryName} Installer`
    });
    terminal.show(true);
    terminal.sendText(installScript, true);
    vscode.window.showInformationMessage(
        `${binaryName} install started in the Terminal. When it finishes, run "${startCmd}" to start the server.`
    );
}
