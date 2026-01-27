import * as vscode from 'vscode';
import { getCommentSyntax } from '../helpers';

interface MemoryItem extends vscode.QuickPickItem {
    id?: string;
    isNew?: boolean;
}

async function listMemories(workspaceFolder: vscode.WorkspaceFolder): Promise<MemoryItem[]> {
    const items: MemoryItem[] = [];
    try {
        const pattern = new vscode.RelativePattern(workspaceFolder, '.linggen/memory/**/*.md');
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

    const existingMemories = await listMemories(workspaceFolder);

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
        const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.linggen', 'memory');
        
        // Use user input as filename directly, sanitized.
        let baseName = (memoryName.trim() || 'memory').replace(/[^\w.-]+/g, '_');
        if (!baseName.toLowerCase().endsWith('.md')) {
            baseName += '.md';
        }
        
        const fileUri = vscode.Uri.joinPath(dirUri, baseName);
        const referenceId = baseName;

        await vscode.workspace.fs.createDirectory(dirUri);

        const templateLines = [
            '---',
            `name: ${memoryName.trim() || 'Untitled'}`,
            `scope: ${doc.languageId || 'text'}`,
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
        const commentBase = `linggen memory: ${referenceId}`;
        const comment = suffix 
            ? `${prefix} ${commentBase} ${suffix}`
            : `${prefix} ${commentBase}`;
        
        await editor.edit(editBuilder => {
            const line = doc.lineAt(sel.start.line);
            const isLineEmpty = line.text.trim() === '';
            const indent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
            
            if (isLineEmpty) {
                // Replace the empty line or insert at the beginning
                editBuilder.replace(line.range, indent + comment);
            } else {
                // Insert a new line above
                editBuilder.insert(new vscode.Position(sel.start.line, 0), indent + comment + '\n');
            }
        });

        // Open the newly created file for editing
        const memoryDoc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(memoryDoc, vscode.ViewColumn.Active);
        
        vscode.window.showInformationMessage(`Linggen: created and opened memory template (${referenceId}).`);
    } else {
        const referenceId = selected.id!;
        
        // Insert comment for existing memory
        const { prefix, suffix } = getCommentSyntax(doc.languageId);
        const commentBase = `linggen memory: ${referenceId}`;
        const comment = suffix 
            ? `${prefix} ${commentBase} ${suffix}`
            : `${prefix} ${commentBase}`;
        
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
        
        vscode.window.showInformationMessage(`Linggen: linked to memory (${referenceId}).`);
    }
}

