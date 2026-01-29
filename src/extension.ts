import * as vscode from 'vscode';
import { getOutputChannel, disposeOutputChannel } from './output';
import { installLinggenCli } from './commands/install';
import { indexCurrentProject } from './commands/indexCurrentProject';
import { startLinggenHealthMonitor } from './linggenMonitor';
import { bootstrapRules } from './commands/bootstrapRules';
import { explainAcrossProjects, getExplainProvider } from './commands/explainAcrossProjects';
import { showGraphInPanel } from './commands/showGraphInPanel';
import { openLibrary } from './commands/openLibrary';
import { browseOnlineSkills } from './commands/browseOnlineSkills';
import { pinToMemory } from './commands/pinToMemory';
import { LinggenMemoryProvider, openMemory } from './linggenMemoryProvider';
import { LinggenAnchorProvider, openAnchor } from './linggenAnchorProvider';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine('Linggen extension activated');

    // Bootstrap Cursor Rules automatically on project open
    void bootstrapRules(context);

    const memoryProvider = new LinggenMemoryProvider();
    const anchorProvider = new LinggenAnchorProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, memoryProvider),
        vscode.languages.registerInlayHintsProvider({ scheme: 'file' }, memoryProvider),
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, anchorProvider),
        vscode.languages.registerDocumentLinkProvider({ scheme: 'file' }, anchorProvider)
    );

    // In-memory provider for explain results (does not write .linggen files)
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('linggen-explain', getExplainProvider())
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('linggen.installCli', () => installLinggenCli()),
        vscode.commands.registerCommand('linggen.indexCurrentProject', () =>
            indexCurrentProject()
        ),
        vscode.commands.registerTextEditorCommand('linggen.explainAcrossProjects', (editor) =>
            explainAcrossProjects(editor)
        ),
        vscode.commands.registerTextEditorCommand('linggen.pinToMemory', (editor) =>
            pinToMemory(editor)
        ),
        vscode.commands.registerCommand('linggen.openMemory', (hash: string) =>
            openMemory(hash)
        ),
        vscode.commands.registerCommand('linggen.openAnchor', (repoPath: string) =>
            openAnchor(repoPath)
        ),
        vscode.commands.registerCommand('linggen.showGraphInPanel', (uri?: vscode.Uri) =>
            showGraphInPanel(uri)
        ),
        vscode.commands.registerCommand('linggen.openLibrary', () =>
            openLibrary()
        ),
        vscode.commands.registerCommand('linggen.browseOnlineSkills', () =>
            browseOnlineSkills(context)
        ),
        startLinggenHealthMonitor(context)
    );
}

export function deactivate(): void {
    disposeOutputChannel();
}
