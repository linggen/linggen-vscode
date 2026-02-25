import * as vscode from 'vscode';
import { getOutputChannel } from './output';

/**
 * Generic backend health monitor.
 * Polls a health endpoint and sets a VS Code context key.
 */
export class BackendMonitor implements vscode.Disposable {
    private timer: NodeJS.Timeout | undefined;
    private _healthy: boolean | undefined;
    private readonly _onHealthChanged = new vscode.EventEmitter<boolean>();
    readonly onHealthChanged = this._onHealthChanged.event;

    constructor(
        readonly name: string,
        private readonly getUrl: () => string,
        private readonly healthPath: string,
        private readonly contextKey: string,
        private readonly intervalMs = 5000
    ) {}

    get healthy(): boolean | undefined {
        return this._healthy;
    }

    get url(): string {
        return this.getUrl();
    }

    start(): void {
        this.stop();
        this._healthy = undefined;
        void this.tick();
        this.timer = setInterval(() => void this.tick(), Math.max(1000, this.intervalMs));
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private async tick(): Promise<void> {
        const output = getOutputChannel();
        const url = this.getUrl();
        let ok = false;
        try {
            const response = await fetch(`${url}${this.healthPath}`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            ok = response.ok;
        } catch {
            ok = false;
        }

        void vscode.commands.executeCommand('setContext', this.contextKey, ok);

        const prev = this._healthy;
        this._healthy = ok;

        if (prev !== ok) {
            output.appendLine(`${this.name} health changed: ${ok ? 'UP' : 'DOWN'} (${url})`);
            this._onHealthChanged.fire(ok);
        }
    }

    dispose(): void {
        this.stop();
        this._onHealthChanged.dispose();
    }
}
