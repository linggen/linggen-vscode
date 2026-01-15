import * as crypto from 'crypto';
import { getOutputChannel } from './output';

/**
 * Helper: Check if a URL refers to a local server.
 */
export function isLocalServer(httpUrl: string): boolean {
    try {
        const url = new URL(httpUrl);
        const hostname = url.hostname.toLowerCase();
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '[::1]' ||
            hostname.endsWith('.local')
        );
    } catch {
        return false;
    }
}

/**
 * Helper: Check if Linggen server is healthy via /api/status.
 */
export async function checkServerHealth(httpUrl: string): Promise<boolean> {
    const outputChannel = getOutputChannel();
    try {
        outputChannel.appendLine(`Checking server health at: ${httpUrl}`);
        const response = await fetch(`${httpUrl}/api/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        const isHealthy = response.ok;
        outputChannel.appendLine(`Server health check: ${isHealthy ? 'OK' : 'FAILED'}`);
        return isHealthy;
    } catch (error) {
        outputChannel.appendLine(`Server health check failed: ${error}`);
        return false;
    }
}

export function generateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 10);
}

export function getCommentSyntax(languageId: string): { prefix: string; suffix?: string } {
    const doubleSlash = { prefix: '//' };
    const hash = { prefix: '#' };
    const dash = { prefix: '--' };
    const percent = { prefix: '%' };

    const map: Record<string, { prefix: string; suffix?: string }> = {
        javascript: doubleSlash,
        typescript: doubleSlash,
        javascriptreact: doubleSlash,
        typescriptreact: doubleSlash,
        java: doubleSlash,
        c: doubleSlash,
        cpp: doubleSlash,
        csharp: doubleSlash,
        go: doubleSlash,
        rust: doubleSlash,
        swift: doubleSlash,
        php: doubleSlash,
        python: hash,
        ruby: hash,
        perl: hash,
        shellscript: hash,
        yaml: hash,
        dockerfile: hash,
        sql: dash,
        lua: dash,
        ada: dash,
        haskell: dash,
        latex: percent,
        css: { prefix: '/*', suffix: '*/' },
        html: { prefix: '<!--', suffix: '-->' },
        xml: { prefix: '<!--', suffix: '-->' },
        markdown: { prefix: '<!--', suffix: '-->' }
    };

    return map[languageId] || doubleSlash;
}

