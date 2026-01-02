import * as vscode from 'vscode';
import { getOutputChannel, disposeOutputChannel } from './output';
import { installLinggenCli } from './commands/install';
import { indexCurrentProject } from './commands/indexCurrentProject';
import { configureCursorMsp } from './commands/configureCursorMsp';
import { startLinggenHealthMonitor } from './linggenMonitor';
import { explainAcrossProjects, getExplainProvider } from './commands/explainAcrossProjects';
import { showGraphInPanel } from './commands/showGraphInPanel';
import { openFrequentPrompts } from './commands/openFrequentPrompts';
import { pinToMemory } from './commands/pinToMemory';
import { LinggenMemoryProvider, openMemory } from './linggenMemoryProvider';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine('Linggen extension activated');

    const memoryProvider = new LinggenMemoryProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, memoryProvider),
        vscode.languages.registerInlayHintsProvider({ scheme: 'file' }, memoryProvider)
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
        vscode.commands.registerCommand('linggen.configureCursorMsp', () =>
            configureCursorMsp(context)
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
        vscode.commands.registerCommand('linggen.showGraphInPanel', (uri?: vscode.Uri) =>
            showGraphInPanel(uri)
        ),
        vscode.commands.registerCommand('linggen.openFrequentPrompts', () =>
            openFrequentPrompts(context)
        ),
        startLinggenHealthMonitor(context)
    );
}

export function deactivate(): void {
    disposeOutputChannel();
}
