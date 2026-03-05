import type { Agent, ModelInfo } from './agentApi';

/**
 * Returns self-contained HTML/CSS/JS for the Agent Chat webview panel.
 */
export function getAgentChatWebviewHtml(agents: Agent[], defaultAgentId: string, models?: ModelInfo[], defaultModelId?: string): string {
    const agentOptions = agents
        .map(a => `<option value="${escapeHtml(a.id)}"${a.id === defaultAgentId ? ' selected' : ''}>${escapeHtml(a.name || a.id)}</option>`)
        .join('\n');

    const modelOptions = (models ?? [])
        .map(m => `<option value="${escapeHtml(m.id)}"${m.id === defaultModelId ? ' selected' : ''}>${escapeHtml(m.id)}</option>`)
        .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Linggen Chat</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #1e1e1e; color: #d4d4d4;
      overflow: hidden;
    }
    #app {
      display: flex; flex-direction: column;
      height: 100%;
    }
    /* Toolbar */
    #toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px;
      background: #252526;
      border-bottom: 1px solid #3c3c3c;
      flex-shrink: 0;
    }
    #toolbar select {
      background: #3c3c3c; color: #d4d4d4;
      border: 1px solid #555; border-radius: 4px;
      padding: 4px 8px; font-size: 12px;
      outline: none;
    }
    #toolbar .label { font-size: 12px; color: #9ca3af; }
    #activity-status {
      margin-left: auto; font-size: 11px; color: #9ca3af;
      font-style: italic;
    }
    /* Messages area */
    #messages {
      flex: 1; overflow-y: auto;
      padding: 12px 16px;
    }
    .msg {
      margin-bottom: 12px;
      max-width: 85%;
      line-height: 1.5;
    }
    .msg.user {
      margin-left: auto;
      background: #264f78; color: #fff;
      border-radius: 12px 12px 4px 12px;
      padding: 8px 14px;
    }
    .msg.agent {
      margin-right: auto;
      background: #2d2d2d;
      border-radius: 12px 12px 12px 4px;
      padding: 8px 14px;
    }
    .msg.agent .sender {
      font-size: 11px; color: #9ca3af; margin-bottom: 2px;
    }
    .msg.agent .body {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg.agent .body code {
      background: #1a1a1a; padding: 1px 4px; border-radius: 3px;
      font-family: "Cascadia Code", Menlo, Monaco, "Courier New", monospace;
      font-size: 0.9em;
    }
    .msg.agent .body pre {
      background: #1a1a1a; padding: 8px 10px; border-radius: 6px;
      overflow-x: auto; margin: 6px 0;
      font-family: "Cascadia Code", Menlo, Monaco, "Courier New", monospace;
      font-size: 0.88em;
    }
    .msg.agent .body pre code {
      background: none; padding: 0;
    }
    .msg.agent .body a { color: #569cd6; }
    .msg.agent .body strong { color: #e5e7eb; }
    /* Input area */
    #input-area {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 10px 12px;
      background: #252526;
      border-top: 1px solid #3c3c3c;
      flex-shrink: 0;
    }
    #input-area textarea {
      flex: 1; resize: none;
      background: #3c3c3c; color: #d4d4d4;
      border: 1px solid #555; border-radius: 6px;
      padding: 8px 10px; font-size: 13px;
      font-family: inherit; line-height: 1.4;
      max-height: 120px; min-height: 36px;
      outline: none;
    }
    #input-area textarea:focus { border-color: #569cd6; }
    #input-area button {
      background: #0e639c; color: #fff;
      border: none; border-radius: 6px;
      padding: 8px 16px; cursor: pointer;
      font-size: 13px; font-weight: 500;
      white-space: nowrap;
    }
    #input-area button:hover { background: #1177bb; }
    #input-area button:disabled { opacity: 0.5; cursor: default; }
  </style>
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <span class="label">Agent:</span>
      <select id="agent-select">
        ${agentOptions}
      </select>
      <span class="label">Model:</span>
      <select id="model-select">
        ${modelOptions}
      </select>
      <span id="activity-status"></span>
    </div>
    <div id="messages"></div>
    <div id="input-area">
      <textarea id="msg-input" rows="1" placeholder="Type a message…"></textarea>
      <button id="send-btn">Send</button>
    </div>
  </div>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const messagesEl = document.getElementById('messages');
      const inputEl = document.getElementById('msg-input');
      const sendBtn = document.getElementById('send-btn');
      const agentSelect = document.getElementById('agent-select');
      const modelSelect = document.getElementById('model-select');
      const activityEl = document.getElementById('activity-status');

      let currentAgentBubble = null;
      let sending = false;

      function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
      }

      function renderSimpleMarkdown(text) {
        // Input is already HTML-escaped, so do NOT re-escape inside replacements.
        // Code blocks
        let html = text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, function(_, code) {
          return '<pre><code>' + code.trim() + '</code></pre>';
        });
        // Inline code
        html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
        // Links
        html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
        return html;
      }

      function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'msg user';
        div.textContent = text;
        messagesEl.appendChild(div);
        scrollToBottom();
      }

      function startAgentMessage(agentId) {
        const div = document.createElement('div');
        div.className = 'msg agent';
        div.innerHTML = '<div class="sender">' + escapeHtml(agentId) + '</div><div class="body"></div>';
        messagesEl.appendChild(div);
        currentAgentBubble = div.querySelector('.body');
        scrollToBottom();
      }

      function appendToAgentMessage(text) {
        if (!currentAgentBubble) return;
        // Accumulate raw text, then re-render with markdown
        const raw = (currentAgentBubble.dataset.raw || '') + text;
        currentAgentBubble.dataset.raw = raw;
        currentAgentBubble.innerHTML = renderSimpleMarkdown(escapeHtml(raw));
        scrollToBottom();
      }

      function finishAgentMessage() {
        currentAgentBubble = null;
      }

      function setActivity(text) {
        activityEl.textContent = text || '';
      }

      function setSending(v) {
        sending = v;
        sendBtn.disabled = v;
        inputEl.disabled = v;
        if (!v) {
          // Re-focus input when done sending
          setTimeout(function() { inputEl.focus(); }, 0);
        }
      }

      function doSend() {
        const text = inputEl.value.trim();
        if (!text || sending) return;
        addUserMessage(text);
        setSending(true);
        vscode.postMessage({
          type: 'chat',
          message: text,
          agentId: agentSelect.value
        });
        inputEl.value = '';
        inputEl.style.height = 'auto';
        setTimeout(function() { inputEl.focus(); }, 0);
      }

      sendBtn.addEventListener('click', doSend);
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      });
      // Auto-grow textarea
      inputEl.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });

      // Notify extension when model selection changes
      modelSelect.addEventListener('change', function() {
        vscode.postMessage({ type: 'modelChange', modelId: modelSelect.value });
      });

      // Messages from extension
      window.addEventListener('message', function(event) {
        const msg = event.data;
        if (!msg) return;
        switch (msg.type) {
          case 'agentStart':
            startAgentMessage(msg.agentId || 'agent');
            setActivity('');
            break;
          case 'token':
            appendToAgentMessage(msg.text || '');
            break;
          case 'activity':
            setActivity(msg.text || '');
            break;
          case 'agentDone':
            finishAgentMessage();
            setActivity(msg.text || '');
            setSending(false);
            break;
          case 'error':
            finishAgentMessage();
            setActivity('');
            setSending(false);
            const errDiv = document.createElement('div');
            errDiv.className = 'msg agent';
            errDiv.innerHTML = '<div class="sender">system</div><div class="body" style="color:#f87171;">' + escapeHtml(msg.text || 'Unknown error') + '</div>';
            messagesEl.appendChild(errDiv);
            scrollToBottom();
            break;
        }
      });

      inputEl.focus();
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
