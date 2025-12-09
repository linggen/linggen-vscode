import * as vscode from 'vscode';
import { getOutputChannel } from '../output';

/**
 * Command: Linggen: Install Linggen
 * Opens the Linggen website for installation instructions.
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

