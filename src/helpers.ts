import { getOutputChannel } from './output';

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

