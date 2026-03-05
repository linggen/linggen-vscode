import * as vscode from 'vscode';
import { getAgentUrl } from '../helpers';
import { getOutputChannel } from '../output';
import { sendChat, listAgents, AgentEventStream, type SseEvent } from '../agentApi';
import { getAgentChatWebviewHtml } from '../agentChatWebview';

/**
 * Command: Linggen: Chat with Agent
 * Opens a webview panel for chatting with the Linggen server.
 */
export async function agentChat(): Promise<void> {
    const output = getOutputChannel();
    const agentUrl = getAgentUrl();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectRoot = workspaceFolders?.[0]?.uri.fsPath ?? '';

    // Fetch available agents
    let agents: { id: string; name: string; description?: string }[];
    try {
        agents = await listAgents(agentUrl, projectRoot);
    } catch (e) {
        output.appendLine(`Failed to list agents: ${e}`);
        agents = [{ id: 'ling', name: 'ling' }];
    }
    if (agents.length === 0) {
        agents = [{ id: 'ling', name: 'ling' }];
    }

    const defaultAgent = agents[0].id;

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
        'linggenAgentChat',
        'Linggen Chat',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getAgentChatWebviewHtml(agents, defaultAgent);

    // Session tracking
    let sessionId: string | undefined;
    let eventStream: AgentEventStream | undefined;
    let streamConnected = false;

    function connectEventStream(): void {
        if (eventStream) {
            eventStream.dispose();
        }
        eventStream = new AgentEventStream();
        streamConnected = true;

        eventStream.onEvent((event: SseEvent) => {
            switch (event.kind) {
                case 'token':
                    panel.webview.postMessage({
                        type: 'token',
                        text: event.text ?? ''
                    });
                    break;
                case 'activity':
                    if (event.phase === 'done') {
                        panel.webview.postMessage({
                            type: 'agentDone',
                            text: 'Done'
                        });
                    } else {
                        panel.webview.postMessage({
                            type: 'activity',
                            text: event.phase ?? event.text ?? ''
                        });
                    }
                    break;
                case 'run_complete':
                    panel.webview.postMessage({
                        type: 'agentDone',
                        text: 'Done'
                    });
                    break;
                case 'error':
                    panel.webview.postMessage({
                        type: 'error',
                        text: String(event.text ?? event.data ?? 'Agent error')
                    });
                    break;
            }
        });

        eventStream.onError((err: Error) => {
            output.appendLine(`Agent SSE stream error: ${err.message}`);
            streamConnected = false;
        });

        eventStream.onClose(() => {
            streamConnected = false;
        });

        void eventStream.connect(agentUrl, sessionId);
    }

    // Listen for messages from webview
    panel.webview.onDidReceiveMessage(async (msg: { type: string; message?: string; agentId?: string }) => {
        if (msg.type !== 'chat' || !msg.message) {
            return;
        }

        const agentId = msg.agentId || defaultAgent;
        const message = msg.message;

        output.appendLine(`Agent chat: sending message to ${agentId}`);

        try {
            // Send the chat request
            const chatResult = await sendChat(agentUrl, {
                project_root: projectRoot,
                agent_id: agentId,
                message,
                session_id: sessionId
            });

            // Track session
            if (chatResult.session_id) {
                sessionId = chatResult.session_id;
            }

            // Tell webview an agent message is starting
            panel.webview.postMessage({ type: 'agentStart', agentId });

            // Connect or reconnect SSE stream
            if (!streamConnected) {
                connectEventStream();
            }
        } catch (e) {
            output.appendLine(`Agent chat error: ${e}`);
            panel.webview.postMessage({
                type: 'error',
                text: `Failed to send message: ${e instanceof Error ? e.message : String(e)}`
            });
        }
    });

    // Clean up on panel close
    panel.onDidDispose(() => {
        if (eventStream) {
            eventStream.dispose();
            eventStream = undefined;
        }
    });
}
