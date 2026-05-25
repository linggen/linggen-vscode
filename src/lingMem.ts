import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFile = promisify(cp.execFile);

export interface StatusJson {
    state: 'running' | 'stale_pidfile' | 'not_running';
    pid?: number;
    port?: number;
    health?: 'ok' | 'error' | 'unreachable';
    version?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    started_at?: string;
}

function home(...parts: string[]): string {
    return path.join(os.homedir(), ...parts);
}

const BINARY_CANDIDATES = [
    '/usr/local/bin/ling-mem',
    home('.local', 'bin', 'ling-mem')
];

const SKILL_DIR_CANDIDATES = [
    home('.linggen', 'skills', 'shared-memory'),
    home('.claude', 'skills', 'shared-memory')
];

export function binaryPath(): string {
    for (const p of BINARY_CANDIDATES) {
        try {
            if (fs.statSync(p).isFile()) {return p;}
        } catch { /* try next */ }
    }
    return BINARY_CANDIDATES[0];
}

export function skillDir(): string {
    for (const d of SKILL_DIR_CANDIDATES) {
        try {
            if (fs.statSync(path.join(d, 'SKILL.md')).isFile()) {return d;}
        } catch { /* try next */ }
    }
    return SKILL_DIR_CANDIDATES[0];
}

export function isInstalled(): boolean {
    for (const p of BINARY_CANDIDATES) {
        try {
            if (fs.statSync(p).isFile()) {return true;}
        } catch { /* try next */ }
    }
    return false;
}

export async function version(): Promise<string | undefined> {
    if (!isInstalled()) {return undefined;}
    try {
        const { stdout } = await execFile(binaryPath(), ['--version'], { timeout: 5000 });
        return stdout.trim();
    } catch {
        return undefined;
    }
}

export async function start(port: number): Promise<void> {
    if (!isInstalled()) {throw new Error('ling-mem is not installed');}
    await execFile(binaryPath(), ['start', '--port', String(port)], { timeout: 10000 });
}

export async function status(): Promise<StatusJson> {
    if (!isInstalled()) {return { state: 'not_running' };}
    try {
        const { stdout } = await execFile(binaryPath(), ['status'], { timeout: 3000 });
        return JSON.parse(stdout) as StatusJson;
    } catch {
        return { state: 'not_running' };
    }
}
