import * as vscode from 'vscode';

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getExplainHtml(result: {
    text: string;
    fullText?: string;
    meta?: {
        file_path?: string;
        start_line?: number;
        end_line?: number;
    };
}, webview: vscode.Webview): string {
    const displayText = result.fullText ?? result.text;
    const meta = result.meta;
    const fileInfo = meta?.file_path
        ? `${meta.file_path}${meta.start_line ? `:${meta.start_line}` : ''}${meta.end_line && meta.end_line !== meta.start_line ? `-${meta.end_line}` : ''}`
        : '';
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}' ${cspSource}; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    body {
      background: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      margin: 0;
      line-height: 1.5;
    }
    .header { 
      border-bottom: 1px solid #333; 
      padding-bottom: 8px; 
      margin-bottom: 12px; 
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      flex: 1;
    }
    h2 { margin: 0 0 4px 0; font-size: 14px; }
    .file-info { color: #888; font-size: 12px; }
    .content {
      white-space: pre-wrap;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 12px;
      background: #252526;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      user-select: text;
      -webkit-user-select: text;
      cursor: text;
    }
    .copy-btn {
      background: #0e639c;
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 3px;
      font-size: 11px;
      cursor: pointer;
      margin-left: 8px;
    }
    .copy-btn:hover {
      background: #1177bb;
    }
    .copy-btn:active {
      background: #0a4d73;
    }
  </style>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      
      function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('copy-btn');
          if (btn) {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
              btn.textContent = original;
            }, 2000);
          }
        }).catch(err => {
          console.error('Failed to copy:', err);
        });
      }
      
      document.addEventListener('DOMContentLoaded', function() {
        const copyBtn = document.getElementById('copy-btn');
        if (copyBtn) {
          copyBtn.addEventListener('click', function() {
            const content = document.querySelector('.content');
            if (content) {
              copyToClipboard(content.textContent || '');
            }
          });
        }
        
        // Enable text selection context menu
        document.addEventListener('contextmenu', function(e) {
          // Allow default context menu for text selection
          return true;
        });
      });
    })();
  </script>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h2>Explain Across Projects</h2>
      ${fileInfo ? `<div class="file-info">${escapeHtml(fileInfo)}</div>` : ''}
    </div>
    <button id="copy-btn" class="copy-btn" title="Copy all text">Copy</button>
  </div>
  <div class="content">${escapeHtml(displayText)}</div>
</body>
</html>`;
}

export function getGraphHtml(payload: {
    graph: {
        nodes: Array<{ id: string; label: string; folder?: string }>;
        edges: Array<{ source: string; target: string }>;
    };
    focusNodeId?: string | null;
    title?: string;
}, webview: vscode.Webview): string {
    const { graph, focusNodeId, title } = payload;
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}' ${cspSource};">
  <style nonce="${nonce}">
    body {
      background: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      margin: 0;
    }
    .header { border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
    h2 { margin: 0 0 4px 0; font-size: 14px; }
    .stats { color: #888; font-size: 12px; }
    .node-list { margin-top: 12px; }
    .node {
      padding: 4px 8px;
      font-size: 12px;
      border-bottom: 1px solid #333;
    }
    .node:last-child { border-bottom: none; }
    .node.focus { background: #264f78; border-radius: 3px; }
    .folder { color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${escapeHtml(title ?? 'Graph')}</h2>
    <div class="stats">${graph.nodes.length} nodes, ${graph.edges.length} edges</div>
  </div>
  <div class="node-list">
    ${graph.nodes.map((node) =>
        `<div class="node${node.id === focusNodeId ? ' focus' : ''}">${escapeHtml(node.label)}${node.folder ? ` <span class="folder">(${escapeHtml(node.folder)})</span>` : ''}</div>`
    ).join('')}
  </div>
</body>
</html>`;
}

export function getMessageHtml(title: string, message: string, webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}' ${cspSource};">
  <style nonce="${nonce}">
    body {
      background: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      margin: 0;
    }
    h2 { margin: 0 0 8px 0; font-size: 14px; }
    p { margin: 0; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <h2>${escapeHtml(title)}</h2>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}
