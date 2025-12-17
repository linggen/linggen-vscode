import * as vscode from 'vscode';
import * as path from 'path';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { findResourceForPath, listResources, type Resource } from '../linggenApi';

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function joinUrl(base: string, endpointPath: string): string {
    const b = base.replace(/\/+$/, '');
    const p = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    return `${b}${p}`;
}

type MemorySemanticResult = {
    id?: string;
    title?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    file_path?: string;
    path?: string;
    snippet?: string;
    text?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    source_id?: string;
};

async function memorySearchSemanticRest(
    httpUrl: string,
    query: string,
    limit: number
): Promise<{ results: MemorySemanticResult[] } | null> {
    const base = httpUrl.replace(/\/+$/, '');
    const endpoint = `${base}/api/memory/search_semantic`;
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, limit }),
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) {
            return null;
        }
        const json = (await res.json()) as { results?: MemorySemanticResult[] };
        return { results: Array.isArray(json.results) ? json.results : [] };
    } catch {
        return null;
    }
}

function findResourceForWorkspaceHeuristic(
    resources: Resource[],
    fsPath: string,
    workspaceRoot?: string
): Resource | undefined {
    // 1) Strong match: path overlap with the actual file path.
    const strong = findResourceForPath(resources, fsPath);
    if (strong) {
        return strong;
    }

    // 2) Fallback: match by workspace folder name (helps when Linggen runs in a container
    // and indexed path is mounted differently, e.g. /tmp/<repo>).
    const folderName = path.basename(workspaceRoot ?? fsPath);
    if (!folderName) {
        return undefined;
    }

    let best: Resource | undefined;
    let bestScore = -1;
    for (const r of resources) {
        const base = path.basename(r.path);
        let score = 0;
        if (r.name === folderName) {
            score += 10;
        }
        if (base === folderName) {
            score += 8;
        }
        if (score === 0) {
            continue;
        }
        // Prefer longer paths to break ties.
        score += Math.min(5, Math.floor(r.path.length / 20));
        if (score > bestScore) {
            bestScore = score;
            best = r;
        }
    }
    return best;
}

function formatAsMarkdown(
    content: string,
   
): string {
    const lines: string[] = [];
    

    
    // Parse and format the content - remove code blocks, format nicely
    const contentLines = content.split('\n');
    let inCodeBlock = false;
    
    for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        
        // Skip code blocks entirely
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
            } else {
                inCodeBlock = false;
            }
            continue;
        }
        
        if (inCodeBlock) {
            continue; // Skip code content
        }
        
    
        if (line.trim() === 'Explain this code across projects.' || line.trim() === 'Explain the following code across projects.') {
            // Skip the explanation prompt line
            continue;
        }
        if (line.startsWith('Context sources:')) {
            lines.push('## Context Sources\n');
            continue;
        }
        if (line.trim().startsWith('- ')) {
            // Format context source - remove "unknown" file paths
            const cleanedLine = line.replace(/: unknown$/, '').replace(/: unknown_source$/, '');
            if (cleanedLine.trim() !== '-') {
                lines.push(cleanedLine);
            }
            continue;
        }
        
        // Keep other content
        if (line.trim()) {
            lines.push(line);
        } else if (lines[lines.length - 1] !== '') {
            lines.push('');
        }
    }
    
    return lines.join('\n');
}

// In-memory markdown view (no files written under .linggen/)
class ExplainDocumentProvider implements vscode.TextDocumentContentProvider {
    private contentMap = new Map<string, string>();
    private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contentMap.get(uri.toString()) || '';
    }

    setContent(uri: vscode.Uri, content: string): void {
        this.contentMap.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }
}

let explainProvider: ExplainDocumentProvider | undefined;

export function getExplainProvider(): ExplainDocumentProvider {
    if (!explainProvider) {
        explainProvider = new ExplainDocumentProvider();
    }
    return explainProvider;
}

function getExplainUri(title: string): vscode.Uri {
    return vscode.Uri.from({ scheme: 'linggen-explain', path: `/${title}.md` });
}

async function openMarkdownDocument(content: string, title: string): Promise<void> {
    const provider = getExplainProvider();
    const uri = getExplainUri(title);
    provider.setContent(uri, content);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
}

export async function explainAcrossProjects(editor?: vscode.TextEditor): Promise<void> {
    const output = getOutputChannel();

    const activeEditor = editor ?? vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const doc = activeEditor.document;
    if (doc.isUntitled) {
        vscode.window.showErrorMessage('Please save the file before using Linggen.');
        return;
    }

    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');
    const endpointPath = config.get<string>(
        'backend.explainAcrossProjectsEndpoint',
        '/api/query'
    );

    // Ensure Linggen is reachable
    const isRunning = await checkServerHealth(httpUrl);
    if (!isRunning) {
        vscode.window.showInformationMessage('Linggen is not running. Start it: linggen');
        return;
    }

    const fsPath = doc.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    const workspaceRoot = workspaceFolder?.uri.fsPath;
    const relativePath =
        workspaceRoot && fsPath.startsWith(workspaceRoot)
            ? path.relative(workspaceRoot, fsPath)
            : undefined;

    let excludeSourceId: string | undefined;
    let sourceId: string | undefined;
    let resourcesForIdToName: Resource[] = [];
    try {
        const resources = await listResources(httpUrl);
        resourcesForIdToName = resources;
        const match = findResourceForWorkspaceHeuristic(resources, fsPath, workspaceRoot);
        sourceId = match?.id;
  
        excludeSourceId = match?.id;
        

        if (sourceId) {
            output.appendLine(
                `Explain Across Projects: source_id=${sourceId} (${match?.name}), exclude_source_id=${excludeSourceId ?? 'none'}`
            );
        } else {
            output.appendLine(
                'Explain Across Projects: could not resolve current source_id; exclude_source_id will not be applied.'
            );
        }
    } catch (e) {
        output.appendLine(
            `Explain Across Projects: failed to resolve current source_id: ${String(e)}`
        );
    }

    const sel = activeEditor.selection;
    const hasSelection = !sel.isEmpty;
    const totalLines = doc.lineCount;
    
    // If no selection, use 10 lines around cursor position
    const contextLines = hasSelection ? 0 : 10;

    const startLine0 = hasSelection
        ? Math.min(sel.start.line, sel.end.line)
        : clamp(sel.active.line - contextLines, 0, totalLines - 1);
    const endLine0 = hasSelection
        ? Math.max(sel.start.line, sel.end.line)
        : clamp(sel.active.line + contextLines, 0, totalLines - 1);

    const range = new vscode.Range(
        new vscode.Position(startLine0, 0),
        new vscode.Position(endLine0, doc.lineAt(endLine0).text.length)
    );
    const code = doc.getText(range);

    const startLine1 = startLine0 + 1;
    const endLine1 = endLine0 + 1;

    // Linggen already exposes POST /api/enhance. It expects { query, strategy?, source_id? }.
    // We'll embed the selected code + location into the query string so the backend can
    // retrieve cross-project context and generate an enhanced prompt.
    // Always include code in the query to improve retrieval quality.

    const payload = {
        query: code??relativePath??fsPath,
        limit: 3,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        exclude_source_id: excludeSourceId
    };

    const endpoint = joinUrl(httpUrl, endpointPath);
    output.appendLine(`Explain Across Projects: POST ${endpoint}`);
    output.appendLine(
        `Context: ${relativePath ?? fsPath}:${startLine1}-${endLine1} (${doc.languageId})`
    );

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Linggen: Explaining across projects…',
            cancellable: false
        },
        async () => {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(30000)
                });

                const text = await res.text();
                if (!res.ok) {
                    output.appendLine(`HTTP ${res.status}: ${text}`);
                    vscode.window.showErrorMessage(
                        `Linggen explain failed (HTTP ${res.status}). See "Linggen" output for details.`
                    );
                    return;
                }

                output.appendLine('Explain response:');
                output.appendLine(text);

                // If response is JSON from /api/query (or /api/enhance), build a copy/paste-friendly prompt.
                let displayText = text;
                try {

                    type QueryResult = {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        source_id?: string;
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        document_id?: string;
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        content?: string;
                    
                    };
                    type EnhanceResponse = {
                        results?: QueryResult[];
                    };
                    const parsed = JSON.parse(text) as EnhanceResponse;

                    const idToName = new Map<string, string>();
                    for (const r of resourcesForIdToName) {
                        idToName.set(r.id, r.name);
                    }

                    // Extract results from response
                    const results = Array.isArray(parsed.results) ? parsed.results : [];

                    // SHORT prompt (default): no code, no long excerpts.
                    const shortLines: string[] = [];
                    shortLines.push('Linggen MCP is the memory layer, indexed related projects.');
                    shortLines.push('Call Linggen MCP first, list tools of it.');
                    shortLines.push('Find out on context filels form Linggen MCP.');
                    shortLines.push('Explain the relationship between the target file and the context files.');

                    shortLines.push(`Target file: ${relativePath ?? fsPath}:${startLine1}-${endLine1}`);
                    shortLines.push(`Target code: ${code}`);
                 
                    shortLines.push('');
                    if (results.length > 0) {
                        shortLines.push('Context files:');
                        const uniq = new Set<string>();
                        for (const r of results) {
                            const p = r.document_id; // document_id is the file path
                            const sid = r.source_id ?? 'unknown_source';
                            const srcName = sid !== 'unknown_source' ? (idToName.get(sid) ?? sid) : sid;
                            const key = `${sid}::${p ?? ''}`;
                            if (uniq.has(key)) {
                                continue;
                            }
                            uniq.add(key);
                            // Only show file path if it exists, otherwise just show source name
                            if (p) {
                                shortLines.push(`- ${srcName}: ${p}`);
                            } else {
                                shortLines.push(`- ${srcName}`);
                            }
                        }
                    } else {
                        shortLines.push('Context sources: (none returned)');
                    }

                    // Related memories (semantic) via REST API
                    {
                        const memQuery = `Target file: ${relativePath ?? fsPath}\n${code}`.slice(0, 1200);
                        const mem = await memorySearchSemanticRest(httpUrl, memQuery, 5);
                        if (mem && mem.results.length > 0) {
                            shortLines.push('');
                            shortLines.push('Related memories:');
                            for (const r of mem.results.slice(0, 3)) {
                                const sid = r.source_id ?? 'unknown_source';
                                const srcName = sid !== 'unknown_source' ? (idToName.get(sid) ?? sid) : sid;
                                const fp = r.file_path ?? r.path ?? '';
                                // Keep it brief: no snippets/content, just the project/source name + memory file path.
                                if (fp) {
                                    shortLines.push(`- ${srcName}: ${fp}`);
                                } else {
                                    const label = r.title ?? r.id ?? 'memory';
                                    shortLines.push(`- ${srcName}: ${String(label)}`);
                                }
                            }
                        }
                    }

                    displayText = shortLines.join('\n');

                    // Create markdown content - use brief version (displayText) for easy copying
                    const markdownContent = formatAsMarkdown(displayText);

                    await openMarkdownDocument(markdownContent, 'Linggen Explain');
                    vscode.window.showInformationMessage('Linggen: explanation received.');
                    return;
                } catch {
                    // non-JSON response; keep raw text
                }

                // Create markdown content for raw text response
                const markdownContent = formatAsMarkdown(displayText);

                await openMarkdownDocument(markdownContent, 'Linggen Explain');
                vscode.window.showInformationMessage('Linggen: explanation received.');
            } catch (e) {
                output.appendLine(`Explain request failed: ${String(e)}`);
                vscode.window.showErrorMessage(
                    'Linggen explain request failed. See "Linggen" output.'
                );
            }
        }
    );
}


