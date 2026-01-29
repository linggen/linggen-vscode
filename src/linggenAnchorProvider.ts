import * as vscode from 'vscode';

const ANCHOR_REGEX = /linggen anchor:\s*[^\r\n]+/g;
const ANCHOR_MARKER = 'linggen anchor:';

function uriFromRepoPath(folder: vscode.WorkspaceFolder, repoPath: string): vscode.Uri {
    const normalized = repoPath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
    const segments = normalized.split('/').filter(Boolean);
    return vscode.Uri.joinPath(folder.uri, ...segments);
}

export async function openAnchor(repoPath: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    for (const folder of workspaceFolders) {
        const target = uriFromRepoPath(folder, repoPath);
        try {
            const stat = await vscode.workspace.fs.stat(target);
            if ((stat.type & vscode.FileType.File) !== vscode.FileType.File) continue;

            const doc = await vscode.workspace.openTextDocument(target);
            await vscode.window.showTextDocument(doc);
            return;
        } catch {
            // Try next folder
        }
    }

    vscode.window.showErrorMessage(`Linggen anchor file not found: ${repoPath}`);
}

export class LinggenAnchorProvider implements vscode.CodeLensProvider, vscode.DocumentLinkProvider {
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];
        const text = document.getText();
        let match: RegExpExecArray | null;

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return lenses;

        ANCHOR_REGEX.lastIndex = 0;
        while ((match = ANCHOR_REGEX.exec(text)) !== null) {
            const matchText = match[0];
            const markerIndex = matchText.indexOf(ANCHOR_MARKER);
            if (markerIndex === -1) continue;
            let tokenStart = markerIndex + ANCHOR_MARKER.length;
            while (tokenStart < matchText.length && /\s/.test(matchText[tokenStart])) tokenStart++;
            let tokenEnd = tokenStart;
            while (tokenEnd < matchText.length && !/\s/.test(matchText[tokenEnd])) tokenEnd++;
            let repoPath = matchText.slice(tokenStart, tokenEnd).trim();
            repoPath = repoPath.replace(/(?:\*\/|-->)+$/, '');
            if (!repoPath) continue;

            const line = document.lineAt(document.positionAt(match.index).line);
            const range = new vscode.Range(line.range.start, line.range.end);

            // Only show lens if the file exists.
            try {
                const target = uriFromRepoPath(workspaceFolder, repoPath);
                await vscode.workspace.fs.stat(target);
            } catch {
                continue;
            }

            lenses.push(
                new vscode.CodeLens(range, {
                    title: `🌀 Open Linggen Anchor (${repoPath})`,
                    command: 'linggen.openAnchor',
                    arguments: [repoPath]
                })
            );
        }

        return lenses;
    }

    async provideDocumentLinks(document: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        const links: vscode.DocumentLink[] = [];
        const text = document.getText();
        let match: RegExpExecArray | null;

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return links;

        ANCHOR_REGEX.lastIndex = 0;
        while ((match = ANCHOR_REGEX.exec(text)) !== null) {
            const matchText = match[0];
            const markerIndex = matchText.indexOf(ANCHOR_MARKER);
            if (markerIndex === -1) continue;

            let tokenStart = markerIndex + ANCHOR_MARKER.length;
            while (tokenStart < matchText.length && /\s/.test(matchText[tokenStart])) tokenStart++;

            let tokenEnd = tokenStart;
            while (tokenEnd < matchText.length && !/\s/.test(matchText[tokenEnd])) tokenEnd++;

            let repoPath = matchText.slice(tokenStart, tokenEnd).trim();
            repoPath = repoPath.replace(/(?:\*\/|-->)+$/, '');
            if (!repoPath) continue;

            const target = uriFromRepoPath(workspaceFolder, repoPath);
            try {
                const stat = await vscode.workspace.fs.stat(target);
                if ((stat.type & vscode.FileType.File) !== vscode.FileType.File) continue;
            } catch {
                continue;
            }

            const start = document.positionAt(match.index + tokenStart);
            const end = document.positionAt(match.index + tokenEnd);
            const linkRange = new vscode.Range(start, end);
            const link = new vscode.DocumentLink(linkRange, target);
            link.tooltip = `Open ${repoPath}`;
            links.push(link);
        }

        return links;
    }
}
