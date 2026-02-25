import * as vscode from 'vscode';
import { getOutputChannel, disposeOutputChannel } from './output';
import { installLinggenCli } from './commands/install';
import { startLinggenHealthMonitor } from './linggenMonitor';
import { bootstrapRules } from './commands/bootstrapRules';
import { browseOnlineSkills } from './commands/browseOnlineSkills';
import { pinToMemory } from './commands/pinToMemory';
import { LinggenMemoryProvider, openMemory } from './linggenMemoryProvider';
import { LinggenAnchorProvider, openAnchor } from './linggenAnchorProvider';
import { agentChat } from './commands/agentChat';
import { agentRuns } from './commands/agentRuns';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine('Linggen extension activated');

    // Bootstrap rules automatically on project open
    void bootstrapRules(context);

    const memoryProvider = new LinggenMemoryProvider();
    const anchorProvider = new LinggenAnchorProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, memoryProvider),
        vscode.languages.registerInlayHintsProvider({ scheme: 'file' }, memoryProvider),
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, anchorProvider),
        vscode.languages.registerDocumentLinkProvider({ scheme: 'file' }, anchorProvider)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('linggen.installCli', () => installLinggenCli()),
        vscode.commands.registerTextEditorCommand('linggen.pinToMemory', (editor) =>
            pinToMemory(editor)
        ),
        vscode.commands.registerCommand('linggen.openMemory', (hash: string) =>
            openMemory(hash)
        ),
        vscode.commands.registerCommand('linggen.openAnchor', (repoPath: string) =>
            openAnchor(repoPath)
        ),
        vscode.commands.registerCommand('linggen.browseOnlineSkills', () =>
            browseOnlineSkills(context)
        ),
        vscode.commands.registerCommand('linggen.agentChat', () => agentChat()),
        vscode.commands.registerCommand('linggen.agentListRuns', () => agentRuns()),
        startLinggenHealthMonitor(context)
    );
}

export function deactivate(): void {
    disposeOutputChannel();
}
