import * as vscode from 'vscode';
import { getCommentSyntax } from '../helpers';

interface AnchorItem extends vscode.QuickPickItem {
    id?: string;
}

async function listAnchors(workspaceFolder: vscode.WorkspaceFolder): Promise<AnchorItem[]> {
    const items: AnchorItem[] = [];
    try {
        const pattern = new vscode.RelativePattern(workspaceFolder, '.linggen/anchor/**/*.md');
        const files = await vscode.workspace.findFiles(pattern);

        for (const fileUri of files) {
            const data = await vscode.workspace.fs.readFile(fileUri);
            const text = new TextDecoder().decode(data);

            const nameMatch = text.match(/name:\s*(.*)/);
            const summaryMatch = text.match(/summary:\s*(.*)/);

            // Extract identifier for the comment.
            // We now prefer using the filename (e.g. test.md) as the reference.
            const fileName = fileUri.path.split('/').pop() || '';
            const id = fileName;

            const nameWithoutExt = fileName.replace(/\.md$/, '');
            const name = nameMatch ? nameMatch[1].trim() : (summaryMatch ? summaryMatch[1].trim() : nameWithoutExt);
            const summary = summaryMatch ? summaryMatch[1].trim() : '';

            items.push({
                label: `$(markdown) ${name}`,
                description: summary,
                detail: id,
                id: id
            });
        }
    } catch {
        // Directory might not exist yet
    }
    return items;
}

type PinAction =
    | 'createAnchor'
    | 'linkAnchor'
    | 'anchorInput'
    | 'anchorFile'
    | 'anchorFolder'
    | 'separator';

interface PinItem extends vscode.QuickPickItem {
    action: PinAction;
    anchorId?: string;
    repoPath?: string;
}

function normalizeRepoRelativePath(input: string): string | undefined {
    let value = input.trim();
    if (!value) return undefined;

    value = value.replace(/\\/g, '/');
    value = value.replace(/^\.\/+/, '');
    value = value.replace(/^\/+/, '');
    value = value.replace(/\/{2,}/g, '/');

    // Disallow traversal and absolute-ish paths.
    if (value.includes('..')) return undefined;
    if (/^[a-zA-Z]:\//.test(value)) return undefined;

    return value;
}

function uriFromRepoRelativePath(workspaceFolder: vscode.WorkspaceFolder, repoPath: string): vscode.Uri {
    const segments = repoPath.split('/').filter(Boolean);
    return vscode.Uri.joinPath(workspaceFolder.uri, ...segments);
}

async function isFile(workspaceFolder: vscode.WorkspaceFolder, repoPath: string): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uriFromRepoRelativePath(workspaceFolder, repoPath));
        return (stat.type & vscode.FileType.File) === vscode.FileType.File;
    } catch {
        return false;
    }
}

async function getAnchorSuggestions(
    workspaceFolder: vscode.WorkspaceFolder,
    rawValue: string,
    limit: number
): Promise<PinItem[]> {
    const normalized = normalizeRepoRelativePath(rawValue);
    if (!normalized) return [];

    const value = normalized;
    const endsWithSlash = value.endsWith('/');
    const lastSlash = value.lastIndexOf('/');

    // Only offer folder/file suggestions once the user indicates a folder context.
    if (!endsWithSlash && lastSlash === -1) return [];

    const dirPath = endsWithSlash ? value : value.slice(0, lastSlash + 1);
    const namePrefix = endsWithSlash ? '' : value.slice(lastSlash + 1);

    try {
        const dirUri = uriFromRepoRelativePath(workspaceFolder, dirPath);
        const entries = await vscode.workspace.fs.readDirectory(dirUri);

        const items: PinItem[] = [];
        for (const [name, type] of entries) {
            if (namePrefix && !name.toLowerCase().startsWith(namePrefix.toLowerCase())) continue;

            if ((type & vscode.FileType.Directory) === vscode.FileType.Directory) {
                items.push({
                    label: `$(folder) ${dirPath}${name}/`,
                    description: 'Browse folder',
                    action: 'anchorFolder',
                    repoPath: `${dirPath}${name}/`
                });
            } else if ((type & vscode.FileType.File) === vscode.FileType.File) {
                items.push({
                    label: `$(file) ${dirPath}${name}`,
                    description: 'Anchor file',
                    action: 'anchorFile',
                    repoPath: `${dirPath}${name}`
                });
            }

            if (items.length >= limit) break;
        }

        return items;
    } catch {
        return [];
    }
}

async function insertLinggenComment(editor: vscode.TextEditor, commentBase: string): Promise<void> {
    const doc = editor.document;
    const sel = editor.selection;
    const { prefix, suffix } = getCommentSyntax(doc.languageId);
    const comment = suffix ? `${prefix} ${commentBase} ${suffix}` : `${prefix} ${commentBase}`;

    await editor.edit(editBuilder => {
        const line = doc.lineAt(sel.start.line);
        const isLineEmpty = line.text.trim() === '';
        const indent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);

        if (isLineEmpty) {
            editBuilder.replace(line.range, indent + comment);
        } else {
            editBuilder.insert(new vscode.Position(sel.start.line, 0), indent + comment + '\n');
        }
    });
}

export async function pinToAnchor(editor: vscode.TextEditor): Promise<void> {
    const doc = editor.document;
    if (doc.isUntitled) {
        vscode.window.showErrorMessage('Please save the file before pinning an anchor.');
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found for this file.');
        return;
    }

    const sel = editor.selection;

    const existingAnchors = await listAnchors(workspaceFolder);

    const quickPick = vscode.window.createQuickPick<PinItem>();
    quickPick.title = 'Linggen: Pin to Anchor';
    quickPick.placeholder = 'Type a note to create an anchor, type a repo path to anchor, or select an existing anchor';

    let refreshToken = 0;
    const updateItems = async () => {
        const token = ++refreshToken;
        const value = quickPick.value;
        const trimmed = value.trim();

        const anchorInputItem: PinItem = {
            label: trimmed ? `$(link) Anchor path: "${trimmed}"` : '$(link) Anchor path...',
            description: 'Insert a // linggen anchor: <repo/path> comment',
            action: 'anchorInput',
            alwaysShow: true
        };

        const suggestions = await getAnchorSuggestions(workspaceFolder, value, 50);
        if (token !== refreshToken) return;

        const createNewAnchorItem: PinItem = {
            label: trimmed ? `$(plus) Create New Anchor: "${trimmed}"` : '$(plus) Create New Anchor...',
            description: 'Create a new anchor file from template',
            action: 'createAnchor',
            alwaysShow: true
        };

        const anchorItems: PinItem[] = existingAnchors.map(m => ({
            ...m,
            action: 'linkAnchor',
            anchorId: (m as AnchorItem).id
        }));

        quickPick.items = [
            { label: 'Anchor', action: 'separator', kind: vscode.QuickPickItemKind.Separator },
            anchorInputItem,
            ...suggestions,
            { label: 'Anchors', action: 'separator', kind: vscode.QuickPickItemKind.Separator },
            createNewAnchorItem,
            ...anchorItems
        ];
    };

    quickPick.onDidChangeValue(() => {
        void updateItems();
    });

    await updateItems();

    const selected = await new Promise<PinItem | undefined>(resolve => {
        quickPick.onDidAccept(async () => {
            const item = quickPick.selectedItems[0];
            if (!item) return;

            if (item.action === 'anchorFolder' && item.repoPath) {
                quickPick.value = item.repoPath;
                await updateItems();
                return;
            }

            resolve(item);
        });
        quickPick.onDidHide(() => resolve(undefined));
        quickPick.show();
    });

    quickPick.dispose();

    if (!selected) {
        return;
    }

    if (selected.action === 'createAnchor') {
        let anchorName = quickPick.value.trim();

        if (!anchorName) {
            anchorName = await vscode.window.showInputBox({
                title: 'Linggen: Create New Anchor',
                prompt: 'Enter a name for this anchor',
                placeHolder: 'e.g. DashMap usage rules',
                ignoreFocusOut: true
            }) || '';

            if (anchorName === '') {
                return; // cancelled
            }
        }

        const code = sel.isEmpty ? '' : doc.getText(sel);
        const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'anchor');

        // Use user input as filename directly, sanitized.
        let baseName = (anchorName.trim() || 'anchor').replace(/[^\w.-]+/g, '_');
        if (!baseName.toLowerCase().endsWith('.md')) {
            baseName += '.md';
        }

        const fileUri = vscode.Uri.joinPath(dirUri, baseName);
        const referenceId = baseName;

        await vscode.workspace.fs.createDirectory(dirUri);

        const templateLines = [
            '---',
            `name: ${anchorName.trim() || 'Untitled'}`,
            `scope: ${doc.languageId || 'text'}`,
            'summary: ',
            'tags: []',
            '---',
            '',
            'Write your anchor details here...',
            ''
        ];

        if (code) {
            templateLines.push(
                '## Snippet',
                `\`\`\`${doc.languageId || ''}`.trimEnd(),
                code,
                '```',
                ''
            );
        }

        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(templateLines.join('\n')));

        await insertLinggenComment(editor, `linggen anchor: ${referenceId}`);

        // Open the newly created file for editing
        const anchorDoc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(anchorDoc, vscode.ViewColumn.Active);

        vscode.window.showInformationMessage(`Linggen: created and opened anchor template (${referenceId}).`);
        return;
    }

    if (selected.action === 'linkAnchor') {
        const referenceId = selected.anchorId;
        if (!referenceId) return;

        await insertLinggenComment(editor, `linggen anchor: ${referenceId}`);
        vscode.window.showInformationMessage(`Linggen: linked to anchor (${referenceId}).`);
        return;
    }

    if (selected.action === 'anchorInput' || selected.action === 'anchorFile') {
        const candidatePath = selected.action === 'anchorFile' ? selected.repoPath : quickPick.value;
        const normalized = normalizeRepoRelativePath(candidatePath || '');
        if (!normalized) {
            vscode.window.showErrorMessage('Linggen: please provide a workspace-relative path like "doc/architecture.md".');
            return;
        }

        if (!(await isFile(workspaceFolder, normalized))) {
            vscode.window.showErrorMessage(`Linggen: file not found: ${normalized}`);
            return;
        }

        await insertLinggenComment(editor, `linggen anchor: ${normalized}`);
        vscode.window.showInformationMessage(`Linggen: anchored (${normalized}).`);
        return;
    }
}
