import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
    if (!channel) {
        channel = vscode.window.createOutputChannel('Linggen');
    }
    return channel;
}

export function disposeOutputChannel(): void {
    if (channel) {
        channel.dispose();
        channel = undefined;
    }
}

