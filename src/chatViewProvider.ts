import * as vscode from 'vscode';
import { getAgentUrl } from './helpers';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'linggen.chatView';

    private view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.view = webviewView;
        const agentUrl = getAgentUrl();

        let serverPort = 9898;
        try {
            serverPort = parseInt(new URL(agentUrl).port, 10) || 9898;
        } catch { /* use default */ }

        webviewView.webview.options = {
            enableScripts: true,
            enableForms: true,
            portMapping: [{ webviewPort: serverPort, extensionHostPort: serverPort }],
        };

        const externalUri = await vscode.env.asExternalUri(
            vscode.Uri.parse(`${agentUrl}?mode=compact`)
        );
        const src = externalUri.toString();
        const nonce = getNonce();
        const cspSource = webviewView.webview.cspSource;

        webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src * http: https:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; color: #ccc; font-family: system-ui, sans-serif; font-size: 13px; }
    iframe { width: 100%; height: 100%; border: none; }
    #debug { padding: 12px; }
    #debug.hidden { display: none; }
    code { color: #7cc; font-size: 11px; }
  </style>
</head>
<body>
  <div id="debug">
    Loading iframe...<br/>
    <code>src: ${src}</code>
  </div>
  <iframe id="frame"
    sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"
    src="${src}"
    style="display:none"
  ></iframe>
  <script nonce="${nonce}">
    const frame = document.getElementById('frame');
    const debug = document.getElementById('debug');
    frame.onload = () => {
      debug.classList.add('hidden');
      frame.style.display = 'block';
    };
    frame.onerror = (e) => {
      debug.innerHTML = 'iframe error: ' + e;
    };
    setTimeout(() => {
      if (!debug.classList.contains('hidden')) {
        debug.innerHTML += '<br/><br/>iframe did not fire onload after 5s. Showing it anyway...';
        frame.style.display = 'block';
      }
    }, 5000);
  </script>
</body>
</html>`;

        webviewView.onDidDispose(() => {
            this.view = undefined;
        });
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
