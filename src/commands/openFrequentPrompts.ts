import * as vscode from 'vscode';

export async function openFrequentPrompts(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const root = workspaceFolders[0].uri;
    const dirUri = vscode.Uri.joinPath(root, '.linggen');
    const fileUri = vscode.Uri.joinPath(dirUri, 'prompts.md');

    await vscode.workspace.fs.createDirectory(dirUri);

    // Create the file with defaults only if it doesn't exist.
    try {
        await vscode.workspace.fs.stat(fileUri);
    } catch {
        const templateUri = vscode.Uri.joinPath(context.extensionUri, 'assets', 'prompts.md');
        const templateBytes = await vscode.workspace.fs.readFile(templateUri);
        await vscode.workspace.fs.writeFile(fileUri, templateBytes);
    }

    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
}

