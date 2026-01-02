import * as vscode from 'vscode';

const MEMORY_REGEX = /linggen memory: ([\w-]+)/g;

/**
 * Finds a memory file by its internal ID in the frontmatter.
 */
async function findFileById(workspaceFolder: vscode.WorkspaceFolder, id: string): Promise<vscode.Uri | undefined> {
    const memoryDir = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'memory');
    try {
        const files = await vscode.workspace.fs.readDirectory(memoryDir);
        for (const [name, type] of files) {
            if (type === vscode.FileType.File && name.endsWith('.md')) {
                const fileUri = vscode.Uri.joinPath(memoryDir, name);
                const data = await vscode.workspace.fs.readFile(fileUri);
                const text = new TextDecoder().decode(data);
                if (text.includes(`id: ${id}`)) {
                    return fileUri;
                }
            }
        }
    } catch {
        // Directory doesn't exist or error reading
    }
    return undefined;
}

export async function openMemory(hash: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    for (const folder of workspaceFolders) {
        // 1. Try direct filename match first (fastest)
        const directUri = vscode.Uri.joinPath(folder.uri, '.linggen', 'memory', `${hash}.md`);
        try {
            await vscode.workspace.fs.stat(directUri);
            const doc = await vscode.workspace.openTextDocument(directUri);
            await vscode.window.showTextDocument(doc);
            return;
        } catch {
            // Not found by filename, try searching by content ID
            const foundUri = await findFileById(folder, hash);
            if (foundUri) {
                const doc = await vscode.workspace.openTextDocument(foundUri);
                await vscode.window.showTextDocument(doc);
                return;
            }
        }
    }

    vscode.window.showErrorMessage(`Linggen memory for ID ${hash} not found.`);
}

export class LinggenMemoryProvider implements vscode.CodeLensProvider, vscode.InlayHintsProvider {
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];
        const text = document.getText();
        let match;

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

        MEMORY_REGEX.lastIndex = 0;
        while ((match = MEMORY_REGEX.exec(text)) !== null) {
            const line = document.lineAt(document.positionAt(match.index).line);
            const hash = match[1];
            
            const range = new vscode.Range(
                line.range.start,
                line.range.end
            );

            let title = `🌀 Open Linggen Memory (${hash})`;
            
            // Try to find the name for a better title
            if (workspaceFolder) {
                let fileUri: vscode.Uri | undefined = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'memory', `${hash}.md`);
                try {
                    try {
                        await vscode.workspace.fs.stat(fileUri);
                    } catch {
                        fileUri = await findFileById(workspaceFolder, hash);
                    }
                    if (fileUri) {
                        const data = await vscode.workspace.fs.readFile(fileUri);
                        const content = new TextDecoder().decode(data);
                        const nameMatch = content.match(/name:\s*(.*)/);
                        if (nameMatch && nameMatch[1].trim()) {
                            title = `🌀 Open Linggen Memory: ${nameMatch[1].trim()}`;
                        }
                    }
                } catch {
                    // Fallback to default title
                }
            }

            lenses.push(new vscode.CodeLens(range, {
                title: title,
                command: 'linggen.openMemory',
                arguments: [hash]
            }));
        }

        return lenses;
    }

    async provideInlayHints(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.InlayHint[]> {
        const hints: vscode.InlayHint[] = [];
        const text = document.getText(range);
        let match;

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return hints;
        }

        MEMORY_REGEX.lastIndex = 0;
        while ((match = MEMORY_REGEX.exec(text)) !== null) {
            const hash = match[1];
            const pos = document.positionAt(document.offsetAt(range.start) + match.index + match[0].length);
            const lineEnd = document.lineAt(pos.line).range.end;

            let fileUri: vscode.Uri | undefined = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'memory', `${hash}.md`);
            try {
                // Check if file exists by name, if not, find by ID
                try {
                    await vscode.workspace.fs.stat(fileUri);
                } catch {
                    fileUri = await findFileById(workspaceFolder, hash);
                }

                if (!fileUri) {
                    continue;
                }

                const data = await vscode.workspace.fs.readFile(fileUri);
                const content = new TextDecoder().decode(data);
                
                const nameMatch = content.match(/name:\s*(.*)/);
                const summaryMatch = content.match(/summary:\s*(.*)/);
                
                let label = '';
                const name = nameMatch ? nameMatch[1].trim() : '';
                const summary = summaryMatch ? summaryMatch[1].trim() : '';

                if (name && summary) {
                    const truncatedSummary = summary.length > 40 ? summary.substring(0, 40) + '...' : summary;
                    label = ` | ${name}: ${truncatedSummary}`;
                } else if (name) {
                    label = ` | ${name}`;
                } else if (summary) {
                    const truncatedSummary = summary.length > 50 ? summary.substring(0, 50) + '...' : summary;
                    label = ` | ${truncatedSummary}`;
                }

                if (label) {
                    const hint = new vscode.InlayHint(lineEnd, label, vscode.InlayHintKind.Parameter);
                    hint.tooltip = 'Linggen Memory Preview';
                    hint.paddingLeft = true;
                    hints.push(hint);
                }
            } catch {
                // File might not exist yet or error reading
            }
        }

        return hints;
    }
}

