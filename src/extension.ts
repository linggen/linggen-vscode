import * as vscode from 'vscode';
import { getOutputChannel, disposeOutputChannel } from './output';
import { installLinggen } from './commands/install';
import { indexCurrentProject } from './commands/indexCurrentProject';
import { openGraphView } from './commands/openGraphView';
import { configureCursorMsp } from './commands/configureCursorMsp';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine('Linggen extension activated');

    context.subscriptions.push(
        vscode.commands.registerCommand('linggen.install', () => installLinggen()),
        vscode.commands.registerCommand('linggen.indexCurrentProject', () =>
            indexCurrentProject()
        ),
        vscode.commands.registerCommand('linggen.openGraphView', (uri?: vscode.Uri) =>
            openGraphView(uri)
        ),
        vscode.commands.registerCommand('linggen.configureCursorMsp', () =>
            configureCursorMsp()
        )
    );
}

export function deactivate(): void {
    disposeOutputChannel();
}
