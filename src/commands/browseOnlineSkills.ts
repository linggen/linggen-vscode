import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { getOutputChannel } from '../output';

interface OnlineSkill {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    skill_id: string;
    url: string;
    skill: string;
    ref: string;
    content?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    install_count: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    updated_at: string;
}

interface SkillsShSkill {
    id: string;
    name: string;
    installs: number;
    topSource: string;
}

interface SkillsResponse {
    success: boolean;
    skills: OnlineSkill[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        total_pages: number;
    };
}

interface SkillsShResponse {
    skills: SkillsShSkill[];
}

type SkillSource = 'linggen' | 'skillsSh';

interface InstallableSkill {
    url: string;
    skill: string;
    ref?: string;
    source: SkillSource;
}

interface SkillQuickPickItem extends vscode.QuickPickItem {
    installable?: InstallableSkill;
    displayName?: string;
}

export async function browseOnlineSkills(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = getOutputChannel();
    const registryUrl = TRACKING_URL;

    await showSkillBrowser(registryUrl, outputChannel, context);
}

async function showSkillBrowser(
    registryUrl: string,
    outputChannel: vscode.OutputChannel,
    context: vscode.ExtensionContext
): Promise<void> {
    const quickPick = vscode.window.createQuickPick<SkillQuickPickItem>();
    quickPick.title = 'Browse Online Skills';
    quickPick.placeholder = 'Loading popular skills...';
    quickPick.busy = true;
    quickPick.show();

    let allSkills: OnlineSkill[] = [];
    let baseItems: SkillQuickPickItem[] = [];
    const currentPage = 1;
    const limit = 50;
    let searchTimer: NodeJS.Timeout | undefined;
    let activeSearchId = 0;

    try {
        // Fetch skills from registry
        outputChannel.appendLine(`Fetching skills from registry: ${registryUrl}`);
        const response = await fetchSkills(registryUrl, currentPage, limit);
        outputChannel.appendLine(`Fetched ${response.skills.length} skills successfully`);
        allSkills = response.skills;

        if (allSkills.length === 0) {
            quickPick.placeholder = 'No skills found in registry';
            quickPick.busy = false;
            setTimeout(() => quickPick.dispose(), 3000);
            return;
        }

        // Create QuickPick items
        baseItems = buildLinggenItems(allSkills);

        quickPick.items = baseItems;
        quickPick.busy = false;
        quickPick.placeholder = 'Select a skill to install';

        // Remote search with fallback to skills.sh
        quickPick.onDidChangeValue(() => {
            if (searchTimer) {
                clearTimeout(searchTimer);
            }

            const query = quickPick.value.trim();
            if (!query) {
                quickPick.items = baseItems;
                quickPick.placeholder = 'Select a skill to install';
                quickPick.busy = false;
                return;
            }

            searchTimer = setTimeout(async () => {
                const searchId = ++activeSearchId;
                quickPick.busy = true;
                quickPick.placeholder = 'Searching skills...';

                try {
                    const searchResponse = await fetchSearchSkills(registryUrl, query, 1, limit);
                    let items = buildLinggenItems(searchResponse.skills);

                    if (searchResponse.success && searchResponse.skills.length < 10) {
                        const skillsShResponse = await fetchSkillsSh(query, 10);
                        const linggenIds = new Set(
                            searchResponse.skills.map(skill => `${skill.url}::${skill.skill}`.toLowerCase())
                        );
                        const filteredSkillsSh = (skillsShResponse.skills || []).filter(skill => {
                            const repoUrl = `https://github.com/${skill.topSource}`;
                            const key = `${repoUrl}::${skill.id}`.toLowerCase();
                            return !linggenIds.has(key);
                        });
                        items = items.concat(buildSkillsShItems(filteredSkillsSh));
                    }

                    if (searchId === activeSearchId) {
                        quickPick.items = items;
                        quickPick.placeholder = items.length > 0 ? 'Select a skill to install' : 'No skills found';
                    }
                } catch (error) {
                    if (searchId === activeSearchId) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        outputChannel.appendLine(`Search failed: ${errorMsg}`);
                        quickPick.items = [];
                        quickPick.placeholder = 'Search failed. Try again.';
                    }
                } finally {
                    if (searchId === activeSearchId) {
                        quickPick.busy = false;
                    }
                }
            }, 300);
        });

        quickPick.onDidAccept(async () => {
            const selection = quickPick.selectedItems[0];
            if (!selection || !selection.installable) {
                return;
            }

            quickPick.dispose();
            await installSkill(selection.installable, outputChannel, context, selection.displayName);
        });

    } catch (error) {
        outputChannel.appendLine(`Failed to fetch skills: ${error}`);

        const errorMsg = error instanceof Error ? error.message : String(error);

        // Provide helpful guidance based on error type
        if (errorMsg.includes('Could not resolve host') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
            vscode.window.showErrorMessage(
                `Cannot connect to skills registry. The Cloudflare Worker may not be deployed yet. Please check the registry URL in settings: ${registryUrl}`,
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'linggen.skills.registryUrl');
                }
            });
        } else {
            vscode.window.showErrorMessage(`Failed to fetch skills from registry: ${errorMsg}`);
        }

        quickPick.dispose();
    }
}

function buildLinggenItems(skills: OnlineSkill[]): SkillQuickPickItem[] {
    return skills.map(skill => ({
        label: `$(package) ${skill.skill}`,
        description: skill.url,
        detail: `${skill.install_count} installs • Updated: ${new Date(skill.updated_at).toLocaleDateString()} • Source: Linggen`,
        displayName: skill.skill,
        installable: {
            url: skill.url,
            skill: skill.skill,
            ref: skill.ref,
            source: 'linggen'
        }
    }));
}

function buildSkillsShItems(skills: SkillsShSkill[]): SkillQuickPickItem[] {
    return skills.map(skill => {
        const repoUrl = `https://github.com/${skill.topSource}`;
        const displayName = skill.name || skill.id;
        return {
            label: `$(package) ${displayName}`,
            description: repoUrl,
            detail: `${skill.installs} installs • Source: GitHub`,
            displayName,
            installable: {
                url: repoUrl,
                skill: skill.id,
                ref: 'main',
                source: 'skillsSh'
            }
        };
    });
}

async function fetchSkills(registryUrl: string, page: number, limit: number): Promise<SkillsResponse> {
    const url = `${registryUrl}/skills?page=${page}&limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json() as SkillsResponse;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('HTTP')) {
            throw error;
        }
        throw new Error(`Failed to connect to registry at ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function fetchSearchSkills(registryUrl: string, query: string, page: number, limit: number): Promise<SkillsResponse> {
    const encodedQuery = encodeURIComponent(query);
    const url = `${registryUrl}/skills/search?q=${encodedQuery}&page=${page}&limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json() as SkillsResponse;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('HTTP')) {
            throw error;
        }
        throw new Error(`Failed to connect to registry search at ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function fetchSkillsSh(query: string, limit: number): Promise<SkillsShResponse> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://skills.sh/api/search?q=${encodedQuery}&limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json() as SkillsShResponse;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('HTTP')) {
            throw error;
        }
        throw new Error(`Failed to connect to skills.sh at ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Cooldown period in milliseconds (24 hours, matching CF Worker deduplication)
const INSTALL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Internal tracking identifier for installation analytics
const TRACKING_NUMBER = 'dd55d4c93490bf9d6e45124351838ea9';

// Internal tracking URL for skills registry
const TRACKING_URL = 'https://linggen-analytics.liangatbc.workers.dev';

interface InstallTimestamp {
    [skillUrl: string]: number;
}

async function installSkill(
    skill: InstallableSkill,
    outputChannel: vscode.OutputChannel,
    context: vscode.ExtensionContext,
    displayName?: string
): Promise<void> {
    const skillLabel = displayName || skill.skill;
    const answer = await vscode.window.showInformationMessage(
        `Install skill "${skillLabel}" from ${skill.url}?`,
        'Install',
        'Cancel'
    );

    if (answer !== 'Install') {
        return;
    }

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a workspace first.');
        return;
    }

    const registryUrl = TRACKING_URL;
    const apiKey = TRACKING_NUMBER;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Installing skill: ${skill.skill}...`,
            cancellable: false
        },
        async (progress) => {
            try {
                progress.report({ message: 'Downloading from GitHub...' });

                // Parse GitHub URL
                const url = skill.url.trim().replace(/\.git$/, '').replace(/\/$/, '');
                const urlParts = url.replace('https://github.com/', '').split('/');
                if (urlParts.length < 2) {
                    throw new Error('Invalid GitHub URL');
                }
                const owner = urlParts[0];
                const repo = urlParts[1];
                const ref = skill.ref || 'main';

                outputChannel.appendLine(`Downloading skill: ${skillLabel} from ${url} (ref: ${ref})`);

                // Download zipball from GitHub
                const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/${ref}`;
                const response = await fetch(zipUrl);

                if (!response.ok) {
                    throw new Error(`GitHub returned ${response.status}: ${response.statusText}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                progress.report({ message: 'Extracting skill...' });

                // Create temp file for zip
                const tempZipPath = path.join(os.tmpdir(), `${skill.skill}-${Date.now()}.zip`);
                fs.writeFileSync(tempZipPath, buffer);

                // Extract skill
                const zip = new AdmZip(tempZipPath);
                const zipEntries = zip.getEntries();

                // Find skill directory in zip
                let skillRootInZip: string | null = null;
                for (const entry of zipEntries) {
                    const entryName = entry.entryName;
                    if ((entryName.endsWith('/SKILL.md') || entryName.endsWith('/skill.md')) &&
                        entryName.includes(`/${skill.skill}/`)) {
                        skillRootInZip = path.dirname(entryName);
                        break;
                    }
                }

                if (!skillRootInZip) {
                    throw new Error(`Could not find skill '${skill.skill}' in repository. Make sure it contains a SKILL.md file.`);
                }

                // Create target directory: .claude/skills/{skill_name}
                const targetDir = path.join(workspaceFolder.uri.fsPath, '.claude', 'skills', skill.skill);

                // Remove existing if present
                if (fs.existsSync(targetDir)) {
                    fs.rmSync(targetDir, { recursive: true, force: true });
                }

                fs.mkdirSync(targetDir, { recursive: true });

                // Extract files
                const skillRootPrefix = skillRootInZip + '/';
                for (const entry of zipEntries) {
                    if (entry.entryName.startsWith(skillRootPrefix) && !entry.isDirectory) {
                        const relativePath = entry.entryName.substring(skillRootPrefix.length);
                        if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) {
                            continue;
                        }

                        const destPath = path.join(targetDir, relativePath);
                        const destDir = path.dirname(destPath);

                        if (!fs.existsSync(destDir)) {
                            fs.mkdirSync(destDir, { recursive: true });
                        }

                        fs.writeFileSync(destPath, entry.getData());
                    }
                }

                // Cleanup temp file
                fs.unlinkSync(tempZipPath);

                outputChannel.appendLine(`✓ Skill installed: ${skillLabel} at ${targetDir}`);

                // Check cooldown and record installation to CF Worker registry
                if (apiKey) {
                    const installTimestamps = context.globalState.get<InstallTimestamp>('linggen.installTimestamps', {});
                    const lastInstall = installTimestamps[skill.url] || 0;
                    const now = Date.now();
                    const timeSinceLastInstall = now - lastInstall;

                    if (timeSinceLastInstall < INSTALL_COOLDOWN_MS) {
                        const hoursRemaining = Math.ceil((INSTALL_COOLDOWN_MS - timeSinceLastInstall) / (60 * 60 * 1000));
                        outputChannel.appendLine(`ℹ Skipping installation count (cooldown: ${hoursRemaining}h remaining)`);
                    } else {
                        progress.report({ message: 'Recording installation...' });
                        await recordInstallation(registryUrl, apiKey, skill, outputChannel);

                        // Update timestamp after successful API call
                        installTimestamps[skill.url] = now;
                        await context.globalState.update('linggen.installTimestamps', installTimestamps);
                    }
                }

                vscode.window.showInformationMessage(
                    `✓ Skill "${skillLabel}" installed successfully to .claude/skills/${skill.skill}`
                );

            } catch (error) {
                outputChannel.appendLine(`Failed to install skill: ${error}`);
                vscode.window.showErrorMessage(`Failed to install skill: ${error}`);
            }
        }
    );
}

async function recordInstallation(
    registryUrl: string,
    apiKey: string,
    skill: InstallableSkill,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    try {
        const installUrl = `${registryUrl}/skills/install`;

        const response = await fetch(installUrl, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                url: skill.url,
                skill: skill.skill,
                ref: skill.ref || 'main',
                installer: 'linggen-vscode',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                installer_version: '0.6.0',
                timestamp: new Date().toISOString()
            })
        });

        if (response.ok) {
            const result = await response.json() as { ok: boolean; counted: boolean };
            if (result.counted) {
                outputChannel.appendLine(`✓ Installation recorded in registry`);
            } else {
                outputChannel.appendLine(`ℹ Installation recorded (already counted recently)`);
            }
        } else {
            outputChannel.appendLine(`⚠ Failed to record installation: ${response.status}`);
        }
    } catch (error) {
        outputChannel.appendLine(`⚠ Failed to record installation: ${error}`);
    }
}
