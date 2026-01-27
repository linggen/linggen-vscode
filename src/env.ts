import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

let envLoaded = false;

/**
 * Load environment variables from .env file in workspace root
 */
export function loadEnv(workspaceRoot?: string): void {
    if (envLoaded) {
        return;
    }

    try {
        const envPath = workspaceRoot
            ? path.join(workspaceRoot, '.env')
            : path.join(__dirname, '..', '.env');

        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            envLoaded = true;
        }
    } catch (error) {
        // Silently fail - .env file is optional
        console.error('Failed to load .env file:', error);
    }
}

/**
 * Get environment variable with optional fallback
 */
export function getEnv(key: string, fallback?: string): string | undefined {
    return process.env[key] || fallback;
}

/**
 * Get required environment variable, throws if not found
 */
export function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}
