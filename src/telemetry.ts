// Property names in this module mirror the wire format of /api/track and the
// HTTP header contract — snake_case and PascalCase are intentional.
/* eslint-disable @typescript-eslint/naming-convention */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getOutputChannel } from './output';

const TRACK_URL = 'https://linggen.dev/api/track';
const PRODUCT = 'linggen-vscode';
const INSTALL_ID_KEY = 'linggen.installationId';
const INSTALL_SOURCE_MARKER = path.join(os.homedir(), '.linggen', '.linggen-vscode-install-source');
const NO_TELEMETRY_FILE = path.join(os.homedir(), '.linggen', 'no-telemetry');

let context: vscode.ExtensionContext | undefined;

export function init(ctx: vscode.ExtensionContext): void {
    context = ctx;
}

export function isOptedOut(): boolean {
    if (process.env.LING_MEM_NO_TELEMETRY === '1') {return true;}
    try {
        fs.statSync(NO_TELEMETRY_FILE);
        return true;
    } catch {
        return false;
    }
}

export function installationId(): string {
    if (!context) {return '';}
    let id = context.globalState.get<string>(INSTALL_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        void context.globalState.update(INSTALL_ID_KEY, id);
    }
    return id;
}

export async function recordInstallSource(): Promise<void> {
    try {
        await fsp.mkdir(path.dirname(INSTALL_SOURCE_MARKER), { recursive: true });
        await fsp.writeFile(INSTALL_SOURCE_MARKER, 'marketplace\n', 'utf8');
    } catch {
        // marker is best-effort
    }
}

async function readInstallSource(): Promise<string> {
    try {
        const v = await fsp.readFile(INSTALL_SOURCE_MARKER, 'utf8');
        return v.trim() || 'marketplace';
    } catch {
        return 'marketplace';
    }
}

export function fireInstall(extensionVersion: string): void {
    void send('install', { extension_version: extensionVersion });
}

export function fireCommand(verb: string, payload?: Record<string, unknown>): void {
    void send('command', { verb, ...(payload ?? {}) });
}

async function send(eventType: 'install' | 'command', payload: Record<string, unknown>): Promise<void> {
    if (isOptedOut()) {return;}
    const output = getOutputChannel();

    const body = {
        product: PRODUCT,
        event_type: eventType,
        installation_id: installationId(),
        payload: eventType === 'install'
            ? { ...payload, via: await readInstallSource() }
            : payload
    };

    try {
        await fetch(TRACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3000)
        });
    } catch (err) {
        output.appendLine(`telemetry ${eventType} failed: ${err}`);
    }
}
