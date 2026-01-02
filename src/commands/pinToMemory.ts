import * as vscode from 'vscode';
import { generateHash, getCommentSyntax } from '../helpers';

interface MemoryItem extends vscode.QuickPickItem {
    id?: string;
    isNew?: boolean;
}

async function listMemories(dirUri: vscode.Uri): Promise<MemoryItem[]> {
    const items: MemoryItem[] = [];
    try {
        const files = await vscode.workspace.fs.readDirectory(dirUri);
        for (const [fileName, type] of files) {
            if (type === vscode.FileType.File && fileName.endsWith('.md')) {
                const fileUri = vscode.Uri.joinPath(dirUri, fileName);
                const data = await vscode.workspace.fs.readFile(fileUri);
                const text = new TextDecoder().decode(data);
                
                const idMatch = text.match(/id:\s*([a-f0-9]+)/);
                const nameMatch = text.match(/name:\s*(.*)/);
                const summaryMatch = text.match(/summary:\s*(.*)/);
                
                if (idMatch) {
                    const name = nameMatch ? nameMatch[1].trim() : (summaryMatch ? summaryMatch[1].trim() : fileName);
                    const summary = summaryMatch ? summaryMatch[1].trim() : '';
                    
                    items.push({
                        label: `$(markdown) ${name}`,
                        description: summary,
                        detail: idMatch[1],
                        id: idMatch[1]
                    });
                }
            }
        }
    } catch {
        // Directory might not exist yet
    }
    return items;
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

    const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'memory');
    const existingMemories = await listMemories(dirUri);

    const quickPick = vscode.window.createQuickPick<MemoryItem>();
    quickPick.title = 'Linggen: Pin to Memory';
    quickPick.placeholder = 'Type a note for a new memory, or select an existing one to link';
    
    const updateItems = (value: string) => {
        const createNewItem: MemoryItem = {
            label: value.trim() ? `$(plus) Create New Memory: "${value.trim()}"` : '$(plus) Create New Memory...',
            description: 'Create a new memory file from template',
            isNew: true,
            alwaysShow: true
        };
        quickPick.items = [createNewItem, ...existingMemories];
    };

    updateItems('');

    quickPick.onDidChangeValue((value) => {
        updateItems(value);
    });

    const selected = await new Promise<MemoryItem | undefined>(resolve => {
        quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
        quickPick.onDidHide(() => resolve(undefined));
        quickPick.show();
    });

    quickPick.dispose();

    if (!selected) {
        return;
    }

    let hash: string;

    if (selected.isNew) {
        let memoryName = quickPick.value.trim();
        
        if (!memoryName) {
            memoryName = await vscode.window.showInputBox({
                title: 'Linggen: Create New Memory',
                prompt: 'Enter a name for this memory',
                placeHolder: 'e.g. DashMap usage rules',
                ignoreFocusOut: true
            }) || '';
            
            if (memoryName === '') {
                return; // cancelled
            }
        }

        const code = sel.isEmpty ? '' : doc.getText(sel);
        hash = generateHash(code + Date.now().toString());
        const fileUri = vscode.Uri.joinPath(dirUri, `${(memoryName.trim() || 'memory').replace(/[^\w.-]+/g, '_')}-${hash.substring(0, 4)}.md`);

        await vscode.workspace.fs.createDirectory(dirUri);

        const templateLines = [
            '---',
            `id: ${hash}`,
            `scope: ${doc.languageId || 'text'}`,
            `name: ${memoryName.trim() || 'Untitled'}`,
            'summary: ',
            'tags: []',
            '---',
            '',
            'Write your memory details here...',
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
        
        // Insert comment into the editor BEFORE opening the new file
        const { prefix, suffix } = getCommentSyntax(doc.languageId);
        const comment = suffix 
            ? `${prefix} linggen memory: ${hash} ${suffix}\n`
            : `${prefix} linggen memory: ${hash}\n`;
        
        await editor.edit(editBuilder => {
            const line = doc.lineAt(sel.start.line);
            const indent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
            editBuilder.insert(new vscode.Position(sel.start.line, 0), indent + comment);
        });

        // Open the newly created file for editing
        const memoryDoc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(memoryDoc, vscode.ViewColumn.Active);
        
        vscode.window.showInformationMessage(`Linggen: created and opened memory template (${hash}).`);
    } else {
        hash = selected.id!;
        
        // Insert comment for existing memory
        const { prefix, suffix } = getCommentSyntax(doc.languageId);
        const comment = suffix 
            ? `${prefix} linggen memory: ${hash} ${suffix}\n`
            : `${prefix} linggen memory: ${hash}\n`;
        
        await editor.edit(editBuilder => {
            const line = doc.lineAt(sel.start.line);
            const indent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
            editBuilder.insert(new vscode.Position(sel.start.line, 0), indent + comment);
        });
        
        vscode.window.showInformationMessage(`Linggen: linked to memory (${hash}).`);
    }
}

