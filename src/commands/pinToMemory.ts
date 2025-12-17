import * as vscode from 'vscode';
import * as path from 'path';

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function nowStamp(): string {
    const d = new Date();
    // Local timestamp, filesystem-friendly
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(
        d.getMinutes()
    )}${pad2(d.getSeconds())}`;
}

export async function pinToMemory(editor: vscode.TextEditor): Promise<void> {
    const doc = editor.document;
    if (doc.isUntitled) {
        vscode.window.showErrorMessage('Please save the file before pinning to memory.');
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found for this file.');
        return;
    }

    const sel = editor.selection;
    if (sel.isEmpty) {
        vscode.window.showErrorMessage('Select some code first.');
        return;
    }

    const note = await vscode.window.showInputBox({
        title: 'Linggen: Pin to Memory',
        prompt: 'Write a short note for this snippet',
        placeHolder: 'e.g. This is good code style, we should use it.',
        ignoreFocusOut: true
    });
    if (note === undefined) {
        return; // cancelled
    }

    const startLine = Math.min(sel.start.line, sel.end.line) + 1;
    const endLine = Math.max(sel.start.line, sel.end.line) + 1;

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const fsPath = doc.uri.fsPath;
    const relPath = fsPath.startsWith(workspaceRoot) ? path.relative(workspaceRoot, fsPath) : fsPath;

    const code = doc.getText(sel);

    const stamp = nowStamp();
    const baseName = path.basename(fsPath).replace(/[^\w.-]+/g, '_');
    const fileName = `${stamp}-${baseName}-L${startLine}-L${endLine}.md`;
    const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'memory');
    const fileUri = vscode.Uri.joinPath(dirUri, fileName);

    await vscode.workspace.fs.createDirectory(dirUri);

    const md = [
        `# Pin: ${baseName}`,
        '',
        `- **File**: \`${relPath}:${startLine}-${endLine}\``,
        `- **When**: ${stamp}`,
        '',
        '## Note',
        note.trim() ? note.trim() : '(empty)',
        '',
        '## Snippet',
        `\`\`\`${doc.languageId || ''}`.trimEnd(),
        code,
        '```',
        ''
    ].join('\n');

    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(md));

    vscode.window.showInformationMessage('Linggen: pinned to memory.', 'Open').then((choice) => {
        if (choice === 'Open') {
            void vscode.workspace.openTextDocument(fileUri).then((d) => vscode.window.showTextDocument(d));
        }
    });
}

