import * as vscode from 'vscode';
import * as path from 'path';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { getGraph, getGraphStatus, listResources, type GraphResponse, type Resource } from '../linggenApi';
import { getGraphWebviewHtml } from '../graphWebview';

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

/**
 * Command: Linggen: Open Graph View
 * Opens a Linggen graph view for the selected file/folder in a VS Code webview.
 */
export async function openGraphView(uri?: vscode.Uri): Promise<void> {
    const outputChannel = getOutputChannel();
    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');

    // Check if Linggen server is running
    const isRunning = await checkServerHealth(httpUrl);
    if (!isRunning) {
        const errorMsg = `Linggen server is not reachable at ${httpUrl}.`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(
            errorMsg + '\n\nPlease start Linggen and try again.'
        );
        return;
    }

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

    // 1) Find a Linggen resource for this workspace (without auto-creating;
    //    we assume indexing already created or the project was added in Linggen)
    let resources: Resource[];
    try {
        resources = await listResources(httpUrl);
    } catch (error) {
        const errorMsg = `Failed to load Linggen resources: ${error}`;
        outputChannel.appendLine(errorMsg as string);
        vscode.window.showErrorMessage(errorMsg as string);
        return;
    }

    if (!resources || resources.length === 0) {
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
        vscode.window.showWarningMessage(
            'No Linggen source matches this workspace. Please add this folder as a source in Linggen and index it first.'
        );
        return;
    }

    outputChannel.appendLine(
        `Using Linggen source '${source.name}' (${source.id}) at path ${source.path} for graph view.`
    );

    // Create the webview panel immediately so the user sees a loading state
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

    // 2) Compute file path relative to source root (POSIX)
    let relativeToSource = targetPath;
    if (targetPath.startsWith(source.path)) {
        relativeToSource = path.relative(source.path, targetPath);
    }
    const relativePosix = relativeToSource.split(path.sep).join('/');
    const parts = relativePosix.split('/');
    const focusLabel = parts.pop() ?? relativePosix;
    const focusFolder = parts.join('/');

    // 3) Fetch graph status (optional, for logging / future UI)
    try {
        const status = await getGraphStatus(httpUrl, source.id);
        outputChannel.appendLine(
            `Graph status for source ${source.id}: ${status.status} (${status.node_count ?? 0} nodes, ${status.edge_count ?? 0} edges)`
        );
    } catch (error) {
        outputChannel.appendLine(
            `Failed to get graph status for source ${source.id}: ${error}`
        );
    }

    // 4) Fetch full graph data for this source
    let graph: GraphResponse;
    try {
        // Fetch the full graph (no server-side folder/focus filter).
        // We'll locate and focus the current file purely on the client side.
        graph = await getGraph(httpUrl, source.id);
        outputChannel.appendLine(
            `Loaded graph for project ${graph.project_id}: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`
        );
    } catch (error) {
        const errorMsg = `Failed to load Linggen graph: ${error}`;
        outputChannel.appendLine(errorMsg as string);
        vscode.window.showErrorMessage(errorMsg as string);
        return;
    }

    // 5) Determine focus node ID
    const focusNode = graph.nodes.find(
        (n) =>
            n.label === focusLabel &&
            (n.folder === focusFolder ||
                n.folder === relativePosix || // fallback
                `${n.folder}/${n.label}` === relativePosix)
    );
    const focusNodeId = focusNode?.id ?? null;

    // 5b) Optionally reduce the graph to only the focused node + its direct neighbors
    let graphForView: GraphResponse = graph;
    if (focusNodeId) {
        const neighborIds = new Set<string>();
        neighborIds.add(focusNodeId);

        // Collect neighbors from edges
        for (const edge of graph.edges) {
            if (edge.source === focusNodeId) {
                neighborIds.add(edge.target);
            } else if (edge.target === focusNodeId) {
                neighborIds.add(edge.source);
            }
        }

        // Filter nodes and edges to this neighborhood
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

    const initialData = {
        graph: graphForView,
        focusNodeId
    };

    panel.webview.html = getGraphWebviewHtml(initialData);

    // Allow the webview to request a refresh (re-fetch graph data) or open Linggen externally
    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (!message) {
                return;
            }

            if (message.type === 'refresh') {
                try {
                    outputChannel.appendLine(
                        `Webview requested graph refresh for source ${source.id}`
                    );
                    const refreshedGraph = await getGraph(httpUrl, source.id);

                    const refreshedFocusNode = refreshedGraph.nodes.find(
                        (n) =>
                            n.label === focusLabel &&
                            (n.folder === focusFolder ||
                                n.folder === relativePosix ||
                                `${n.folder}/${n.label}` === relativePosix)
                    );

                    panel.webview.postMessage({
                        type: 'graphData',
                        graph: refreshedGraph,
                        focusNodeId: refreshedFocusNode?.id ?? null
                    });
                } catch (error) {
                    const errorMsg = `Failed to refresh Linggen graph: ${error}`;
                    outputChannel.appendLine(errorMsg as string);
                    vscode.window.showErrorMessage(errorMsg as string);
                }
            } else if (message.type === 'openLinggen') {
                try {
                    outputChannel.appendLine(
                        `Webview requested to open Linggen UI at ${httpUrl}`
                    );
                    await vscode.env.openExternal(vscode.Uri.parse(httpUrl));
                } catch (error) {
                    const errorMsg = `Failed to open Linggen in browser: ${error}`;
                    outputChannel.appendLine(errorMsg as string);
                    vscode.window.showErrorMessage(errorMsg as string);
                }
            }
        },
        undefined,
        []
    );
}

