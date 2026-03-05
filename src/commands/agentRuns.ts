import * as vscode from 'vscode';
import { getAgentUrl } from '../helpers';
import { getOutputChannel } from '../output';
import { listRuns, cancelRun, type AgentRun } from '../agentApi';

interface RunQuickPickItem extends vscode.QuickPickItem {
    run?: AgentRun;
}

/**
 * Command: Linggen: Agent Runs
 * Lists recent agent runs and offers cancel/details.
 */
export async function agentRuns(): Promise<void> {
    const output = getOutputChannel();
    const agentUrl = getAgentUrl();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectRoot = workspaceFolders?.[0]?.uri.fsPath ?? '';

    let runs: AgentRun[];
    try {
        runs = await listRuns(agentUrl, projectRoot);
    } catch (e) {
        output.appendLine(`Failed to list agent runs: ${e}`);
        vscode.window.showErrorMessage(`Failed to list agent runs: ${e instanceof Error ? e.message : String(e)}`);
        return;
    }

    if (runs.length === 0) {
        vscode.window.showInformationMessage('No agent runs found.');
        return;
    }

    const items: RunQuickPickItem[] = runs.map(run => {
        const statusIcon = run.status === 'running' ? '$(sync~spin)' :
            run.status === 'completed' ? '$(check)' :
            run.status === 'failed' ? '$(error)' :
            run.status === 'cancelled' ? '$(circle-slash)' : '$(question)';

        return {
            label: `${statusIcon} ${run.agent_id}`,
            description: `${run.status} | ${run.started_at}`,
            detail: run.details ?? run.run_id,
            run
        };
    });

    const selected = await vscode.window.showQuickPick(items, {
        title: 'Linggen Runs',
        placeHolder: 'Select a run to view details or cancel'
    });

    if (!selected?.run) {
        return;
    }

    const run = selected.run;

    if (run.status === 'running') {
        const action = await vscode.window.showQuickPick(
            [
                { label: '$(stop) Cancel Run', action: 'cancel' },
                { label: '$(info) View Details', action: 'details' }
            ],
            { title: `Run: ${run.run_id}`, placeHolder: 'Choose an action' }
        );

        if (action?.action === 'cancel') {
            try {
                const result = await cancelRun(agentUrl, run.run_id);
                vscode.window.showInformationMessage(
                    `Cancelled ${result.cancelled_run_ids.length} run(s).`
                );
            } catch (e) {
                output.appendLine(`Failed to cancel run: ${e}`);
                vscode.window.showErrorMessage(`Failed to cancel run: ${e instanceof Error ? e.message : String(e)}`);
            }
        } else if (action?.action === 'details') {
            showRunDetails(run);
        }
    } else {
        showRunDetails(run);
    }
}

function showRunDetails(run: AgentRun): void {
    const lines: string[] = [
        `Run ID: ${run.run_id}`,
        `Agent: ${run.agent_id}`,
        `Session: ${run.session_id}`,
        `Status: ${run.status}`,
        `Started: ${run.started_at}`,
    ];
    if (run.ended_at) {
        lines.push(`Ended: ${run.ended_at}`);
    }
    if (run.details) {
        lines.push(`Details: ${run.details}`);
    }

    const output = getOutputChannel();
    output.appendLine('--- Agent Run Details ---');
    for (const line of lines) {
        output.appendLine(line);
    }
    output.show();
}
