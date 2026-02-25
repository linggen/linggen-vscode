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
