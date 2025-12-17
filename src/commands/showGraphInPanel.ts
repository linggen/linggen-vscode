import * as vscode from 'vscode';
import * as path from 'path';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { getGraphWithStatus, listResources, type GraphResponse, type Resource } from '../linggenApi';
import { getGraphWebviewHtml } from '../graphWebview';
import { getMessageHtml } from '../linggenWebviewHelper';

// In-memory cache of graphs per source for this VS Code session.
const graphCache: Map<string, GraphResponse> = new Map();

function buildFocusedGraph(
    graph: GraphResponse,
    focusPath: string,
    focusLabel: string,
    focusFolder: string,
    relativePosix: string
): { graphForView: GraphResponse; focusNodeId: string | null } {
    const focusNode = graph.nodes.find(
        (n) =>
            n.label === focusLabel &&
            (n.folder === focusFolder ||
                n.folder === relativePosix || // fallback
                `${n.folder}/${n.label}` === focusPath)
    );
    const focusNodeId = focusNode?.id ?? null;

    let graphForView: GraphResponse = graph;
    if (focusNodeId) {
        const neighborIds = new Set<string>();
        neighborIds.add(focusNodeId);

        for (const edge of graph.edges) {
            if (edge.source === focusNodeId) {
                neighborIds.add(edge.target);
            } else if (edge.target === focusNodeId) {
                neighborIds.add(edge.source);
            }
        }

        const filteredNodes = graph.nodes.filter((n) => neighborIds.has(n.id));
        const filteredEdges = graph.edges.filter(
            (e) => neighborIds.has(e.source) && neighborIds.has(e.target)
        );

        graphForView = {
            ...graph,
            nodes: filteredNodes,
            edges: filteredEdges
        };
    }

    return { graphForView, focusNodeId };
}

function getLoadingHtml(fileName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Linggen Graph: ${fileName}</title>
  <style>
    :root { color-scheme: dark; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #020617;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e5e7eb;
    }
    .card {
      padding: 16px 20px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.5);
      background: radial-gradient(circle at top, #0f172a 0, #020617 65%);
      box-shadow: 0 18px 55px rgba(15,23,42,0.8);
      min-width: 260px;
      text-align: center;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 12px;
      color: #9ca3af;
    }
    .spinner {
      margin: 16px auto 10px;
      width: 20px;
      height: 20px;
      border-radius: 999px;
      border: 2px solid rgba(148, 163, 184, 0.4);
      border-top-color: #38bdf8;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Loading Linggen Graph…</div>
    <div class="spinner"></div>
    <div class="subtitle">${fileName}</div>
  </div>
 </body>
 </html>`;
}

export async function showGraphInPanel(uri?: vscode.Uri): Promise<void> {
    const outputChannel = getOutputChannel();
    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');

    // Determine the file/folder to focus
    let targetPath: string;
    if (uri) {
        targetPath = uri.fsPath;
    } else if (vscode.window.activeTextEditor) {
        targetPath = vscode.window.activeTextEditor.document.uri.fsPath;
    } else {
        vscode.window.showErrorMessage('No file or folder selected');
        return;
    }

    // Get workspace folder for relative path calculation
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Create webview panel (editor tab) to display the graph
    const panel = vscode.window.createWebviewPanel(
        'linggenGraphView',
        `Linggen Graph: ${path.basename(targetPath)}`,
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getLoadingHtml(path.basename(targetPath));

    // Check if Linggen server is running
    const isRunning = await checkServerHealth(httpUrl);
    if (!isRunning) {
        panel.webview.html = getMessageHtml('Graph', 'Linggen is not running. Start it in a terminal: linggen', panel.webview);
        vscode.window.showInformationMessage('Linggen is not running. Start it: linggen');
        return;
    }

    // Find a Linggen resource for this workspace (without auto-creating)
    let resources: Resource[];
    try {
        resources = await listResources(httpUrl);
    } catch (error) {
        panel.webview.html = getMessageHtml('Graph', `Failed to load Linggen resources: ${String(error)}`, panel.webview);
        vscode.window.showErrorMessage(`Failed to load Linggen resources: ${String(error)}`);
        return;
    }

    if (!resources || resources.length === 0) {
        panel.webview.html = getMessageHtml('Graph', 'No Linggen sources found. Add this project as a source in Linggen and index it first.', panel.webview);
        vscode.window.showWarningMessage(
            'No Linggen sources found. Please add this project as a source in Linggen and index it first.'
        );
        return;
    }

    // Prefer resource whose path matches workspaceRoot best
    const source = resources.reduce<Resource | undefined>((best, current) => {
        if (!workspaceRoot.startsWith(current.path) && !current.path.startsWith(workspaceRoot)) {
            return best;
        }
        if (!best) {
            return current;
        }
        return current.path.length > best.path.length ? current : best;
    }, undefined);

    if (!source) {
        panel.webview.html = getMessageHtml('Graph', 'No Linggen source matches this workspace. Add this folder as a source in Linggen and index it first.', panel.webview);
        vscode.window.showWarningMessage(
            'No Linggen source matches this workspace. Please add this folder as a source in Linggen and index it first.'
        );
        return;
    }

    // Compute file path relative to source root (POSIX)
    let relativeToSource = targetPath;
    if (targetPath.startsWith(source.path)) {
        relativeToSource = path.relative(source.path, targetPath);
    }
    const relativePosix = relativeToSource.split(path.sep).join('/');
    const focusPath = relativePosix;
    const focusLabel = path.basename(focusPath);
    const lastSlash = focusPath.lastIndexOf('/');
    const focusFolder = lastSlash > 0 ? focusPath.slice(0, lastSlash) : '';

    let graph: GraphResponse;
    try {
        const cached = graphCache.get(source.id);
        if (cached) {
            graph = cached;
        } else {
            const full = await getGraphWithStatus(httpUrl, source.id);
            graph = full;
            graphCache.set(source.id, full);
        }
    } catch (error) {
        panel.webview.html = getMessageHtml('Graph', `Failed to load graph for source ${source.id}: ${String(error)}\n\nIf this keeps happening, try indexing the project again.`, panel.webview);
        vscode.window.showErrorMessage(`Failed to load Linggen graph: ${String(error)}`);
        return;
    }

    const { graphForView, focusNodeId } = buildFocusedGraph(
        graph,
        focusPath,
        focusLabel,
        focusFolder,
        relativePosix
    );

    outputChannel.appendLine(
        `Graph: source=${source.id}, nodes=${graphForView.nodes.length}, edges=${graphForView.edges.length}`
    );

    // Use the full graph webview HTML for better visualization
    panel.webview.html = getGraphWebviewHtml({
        graph: graphForView,
        fullGraph: graph,
        focusNodeId
    });
}


