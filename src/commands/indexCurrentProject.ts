import * as vscode from 'vscode';
import { getOutputChannel } from '../output';
import { checkServerHealth } from '../helpers';
import { installLinggen, installLinggenCli } from './install';
import {
    getOrCreateLocalResourceForWorkspace,
    listJobs,
    type Job
} from '../linggenApi';

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
        const action = await vscode.window.showErrorMessage(
            errorMsg + '\n\nLinggen is required. Install/start Linggen and try again.',
            'Install Linggen CLI',
            'Open install website'
        );
        if (action === 'Install Linggen CLI') {
            await installLinggenCli();
        } else if (action === 'Open install website') {
            await installLinggen();
        }
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing project with Linggen...',
            cancellable: false
        },
        async (progress) => {
            try {
                progress.report({ message: 'Locating Linggen source…' });
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
                progress.report({ message: 'Starting indexing job…' });
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

                const indexResult = (await indexResponse.json()) as {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    job_id: string;
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    files_indexed?: number;
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    chunks_created?: number;
                };

                const jobId = indexResult.job_id;
                outputChannel.appendLine(
                    `Indexing job started: id=${jobId}, files=${indexResult.files_indexed}, chunks=${indexResult.chunks_created}`
                );
                vscode.window.showInformationMessage(
                    `Started indexing job for Linggen resource: ${matching.name}`
                );

                // 3) Poll job status until completion
                progress.report({ message: 'Indexing in progress…' });
                const pollIntervalMs = 2000;
                let lastStatus: string | undefined;
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
                    let jobs: Job[];
                    try {
                        jobs = await listJobs(httpUrl);
                    } catch (e) {
                        outputChannel.appendLine(
                            `Failed to fetch job list while monitoring indexing job: ${String(
                                e
                            )}`
                        );
                        break;
                    }

                    const job = jobs.find((j) => j.id === jobId);
                    if (!job) {
                        outputChannel.appendLine(
                            `Indexing job ${jobId} not found in job list; stopping polling.`
                        );
                        break;
                    }

                    if (job.status !== lastStatus) {
                        lastStatus = job.status;
                        const progressMsg =
                            job.status === 'Running'
                                ? `Indexing ${matching.name}… ${job.files_indexed ?? 0} files, ${
                                      job.chunks_created ?? 0
                                  } chunks`
                                : `Job ${job.status}${
                                      job.error ? ` – ${job.error}` : ''
                                  }`;
                        outputChannel.appendLine(`Job ${job.id} status: ${progressMsg}`);
                        progress.report({ message: progressMsg });
                    }

                    if (job.status === 'Completed' || job.status === 'Failed') {
                        break;
                    }
                }
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

