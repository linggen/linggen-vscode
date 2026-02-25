import * as vscode from 'vscode';
import { getOutputChannel } from './output';

// ── Types ────────────────────────────────────────────────────────────

export interface ChatRequest {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_root: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    agent_id: string;
    message: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    session_id?: string;
}

export interface AgentRun {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    run_id: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    agent_id: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    session_id: string;
    status: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    started_at: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ended_at?: string;
    details?: string;
}

export interface SseEvent {
    id?: string;
    seq?: number;
    kind: string;
    phase?: string;
    text?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    agent_id?: string;
    data?: unknown;
}

export interface Agent {
    id: string;
    name: string;
    description?: string;
}

// ── API Functions ────────────────────────────────────────────────────

export async function sendChat(
    agentUrl: string,
    req: ChatRequest
): Promise<{ status: string; session_id?: string }> {
    const base = agentUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /api/chat returned ${res.status}: ${text}`);
    }
    return (await res.json()) as { status: string; session_id?: string };
}

export async function listRuns(
    agentUrl: string,
    projectRoot: string,
    sessionId?: string
): Promise<AgentRun[]> {
    const base = agentUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({ project_root: projectRoot });
    if (sessionId) {
        params.set('session_id', sessionId);
    }
    const res = await fetch(`${base}/api/agent-runs?${params}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
        throw new Error(`GET /api/agent-runs returned ${res.status}`);
    }
    const json = (await res.json()) as { runs?: AgentRun[] };
    return json.runs ?? [];
}

export async function cancelRun(
    agentUrl: string,
    runId: string
): Promise<{ cancelled_run_ids: string[] }> {
    const base = agentUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/agent-runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
        throw new Error(`POST cancel returned ${res.status}`);
    }
    return (await res.json()) as { cancelled_run_ids: string[] };
}

export async function listAgents(
    agentUrl: string,
    projectRoot?: string
): Promise<Agent[]> {
    const base = agentUrl.replace(/\/+$/, '');
    const params = projectRoot ? `?project_root=${encodeURIComponent(projectRoot)}` : '';
    const res = await fetch(`${base}/api/agents${params}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
        throw new Error(`GET /api/agents returned ${res.status}`);
    }
    const json = (await res.json()) as { agents?: Agent[] };
    return json.agents ?? [];
}

// ── SSE Event Stream ─────────────────────────────────────────────────

/**
 * Connects to the agent SSE event stream using fetch() + ReadableStream.
 * No npm dependencies required.
 */
export class AgentEventStream implements vscode.Disposable {
    private abortController: AbortController | undefined;
    private readonly _onEvent = new vscode.EventEmitter<SseEvent>();
    readonly onEvent = this._onEvent.event;
    private readonly _onError = new vscode.EventEmitter<Error>();
    readonly onError = this._onError.event;
    private readonly _onClose = new vscode.EventEmitter<void>();
    readonly onClose = this._onClose.event;

    async connect(agentUrl: string, sessionId?: string): Promise<void> {
        this.disconnect();
        const output = getOutputChannel();
        const base = agentUrl.replace(/\/+$/, '');
        const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
        const url = `${base}/api/events${params}`;

        this.abortController = new AbortController();
        output.appendLine(`AgentEventStream: connecting to ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'text/event-stream' },
                signal: this.abortController.signal
            });

            if (!response.ok) {
                throw new Error(`SSE connect failed: HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('SSE: no readable body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Keep incomplete last line in buffer
                buffer = lines.pop() ?? '';

                let currentData = '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        currentData += line.slice(6);
                    } else if (line.trim() === '' && currentData) {
                        // End of SSE event block
                        try {
                            const event = JSON.parse(currentData) as SseEvent;
                            this._onEvent.fire(event);
                        } catch (e) {
                            output.appendLine(`AgentEventStream: failed to parse SSE data: ${currentData}`);
                        }
                        currentData = '';
                    }
                }
            }
        } catch (error) {
            if (this.abortController?.signal.aborted) {
                // Expected disconnection
                return;
            }
            const err = error instanceof Error ? error : new Error(String(error));
            output.appendLine(`AgentEventStream error: ${err.message}`);
            this._onError.fire(err);
        } finally {
            this._onClose.fire();
        }
    }

    disconnect(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }

    dispose(): void {
        this.disconnect();
        this._onEvent.dispose();
        this._onError.dispose();
        this._onClose.dispose();
    }
}
