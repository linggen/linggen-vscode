import * as vscode from 'vscode';
import { getOutputChannel, disposeOutputChannel } from './output';
import { installLinggenCli } from './commands/install';
import { startLinggenHealthMonitor } from './linggenMonitor';
import { bootstrapRules } from './commands/bootstrapRules';
import { browseOnlineSkills } from './commands/browseOnlineSkills';
import { pinToAnchor } from './commands/pinToAnchor';
import { LinggenAnchorProvider, openAnchor } from './linggenAnchorProvider';
import { ChatViewProvider } from './chatViewProvider';
import { agentRuns } from './commands/agentRuns';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine('Linggen extension activated');

    // Bootstrap rules automatically on project open
    void bootstrapRules(context);

    const anchorProvider = new LinggenAnchorProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, anchorProvider),
        vscode.languages.registerDocumentLinkProvider({ scheme: 'file' }, anchorProvider)
    );

    // Register chat view and move to secondary sidebar on first activation
    const chatProvider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );


    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('linggen.installCli', () => installLinggenCli()),
        vscode.commands.registerTextEditorCommand('linggen.pinToAnchor', (editor) =>
            pinToAnchor(editor)
        ),
        vscode.commands.registerCommand('linggen.openAnchor', (repoPath: string) =>
            openAnchor(repoPath)
        ),
        vscode.commands.registerCommand('linggen.browseOnlineSkills', () =>
            browseOnlineSkills(context)
        ),
        vscode.commands.registerCommand('linggen.agentChat', () => {
            void vscode.commands.executeCommand('linggen.chatView.focus');
        }),
        vscode.commands.registerCommand('linggen.agentListRuns', () => agentRuns()),
        startLinggenHealthMonitor(context)
    );
}

export function deactivate(): void {
    disposeOutputChannel();
}
