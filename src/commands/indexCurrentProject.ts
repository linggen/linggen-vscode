import * as vscode from 'vscode';
import * as path from 'path';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { getOrCreateLocalResourceForWorkspace } from '../linggenApi';

/**
 * Command: Linggen: Index Current Project
 * Triggers indexing of the current workspace via Linggen HTTP API.
 */
export async function indexCurrentProject(): Promise<void> {
    const outputChannel = getOutputChannel();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('linggen');
    const httpUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');

    outputChannel.appendLine(`Indexing project via Linggen HTTP API: ${workspacePath}`);

    // Ensure server is reachable
    const isRunning = await checkServerHealth(httpUrl);
    if (!isRunning) {
        const errorMsg = `Linggen server is not reachable at ${httpUrl}. Cannot index project.`;
        outputChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(
            errorMsg + '\n\nPlease start Linggen and try again.'
        );
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing project with Linggen...',
            cancellable: false
        },
        async () => {
            try {
                // 1) Find or create a resource for this workspace
                outputChannel.appendLine(
                    `Locating Linggen resource for workspace: ${workspacePath}`
                );
                const matching = await getOrCreateLocalResourceForWorkspace(
                    httpUrl,
                    workspacePath
                );
                outputChannel.appendLine(
                    `Using Linggen resource '${matching.name}' (${matching.id}) at path ${matching.path}`
                );

                // 2) Trigger indexing for the resource (incremental by default)
                const indexEndpoint = `${httpUrl}/api/index_source`;
                outputChannel.appendLine(
                    `Triggering indexing: POST ${indexEndpoint} (source_id=${matching.id})`
                );

                const indexResponse = await fetch(indexEndpoint, {
                    method: 'POST',
                    headers: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        // Use snake_case keys to match backend API
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        source_id: matching.id,
                        mode: 'incremental'
                    })
                });

                if (!indexResponse.ok) {
                    const errorText = await indexResponse.text();
                    throw new Error(`HTTP ${indexResponse.status}: ${errorText}`);
                }

                const indexResult = await indexResponse.json();
                outputChannel.appendLine(
                    `Indexing job started: ${JSON.stringify(indexResult)}`
                );
                vscode.window.showInformationMessage(
                    `Started indexing job for Linggen resource: ${matching.name}`
                );
            } catch (error) {
                const errorMsg = `Failed to index project via Linggen HTTP API: ${error}`;
                outputChannel.appendLine(errorMsg as string);
                vscode.window.showErrorMessage(
                    (errorMsg as string) +
                        '\n\nMake sure Linggen server is running on ' +
                        httpUrl
                );
            }
        }
    );
}

