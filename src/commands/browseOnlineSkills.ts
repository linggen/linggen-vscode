import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { getOutputChannel } from '../output';
import { getAgentUrl, checkAgentHealth } from '../helpers';

interface BuiltInSkill {
    name: string;
    description: string;
    installed: boolean;
}

interface SkillsShSkill {
    id: string;
    name: string;
    installs: number;
    topSource: string;
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
    await showSkillBrowser(outputChannel, context);
}

async function showSkillBrowser(
    outputChannel: vscode.OutputChannel,
    context: vscode.ExtensionContext
): Promise<void> {
    const quickPick = vscode.window.createQuickPick<SkillQuickPickItem>();
    quickPick.title = 'Browse Online Skills';
    quickPick.placeholder = 'Loading Linggen skills...';
    quickPick.busy = true;
    quickPick.show();

    let baseItems: SkillQuickPickItem[] = [];
    let searchTimer: NodeJS.Timeout | undefined;
    let activeSearchId = 0;

    try {
        // Fetch built-in skills from Linggen server or GitHub
        const builtInSkills = await fetchBuiltInSkills(outputChannel);
        outputChannel.appendLine(`Fetched ${builtInSkills.length} built-in skills`);

        if (builtInSkills.length === 0) {
            quickPick.placeholder = 'No skills found. Type to search community skills.';
            quickPick.busy = false;
        } else {
            baseItems = buildBuiltInItems(builtInSkills);
            quickPick.items = baseItems;
            quickPick.busy = false;
            quickPick.placeholder = 'Select a skill to install, or type to search community';
        }

        // Search: filter built-in + search skills.sh for community
        quickPick.onDidChangeValue(() => {
            if (searchTimer) {
                clearTimeout(searchTimer);
            }

            const query = quickPick.value.trim();
            if (!query) {
                quickPick.items = baseItems;
                quickPick.placeholder = 'Select a skill to install, or type to search community';
                quickPick.busy = false;
                return;
            }

            // Immediately filter built-in skills client-side
            const lowerQuery = query.toLowerCase();
            const filteredBuiltIn = baseItems.filter(item =>
                item.displayName?.toLowerCase().includes(lowerQuery) ||
                item.description?.toLowerCase().includes(lowerQuery)
            );
            quickPick.items = filteredBuiltIn;

            // Debounced community search
            searchTimer = setTimeout(async () => {
                const searchId = ++activeSearchId;
                quickPick.busy = true;

                try {
                    const skillsShResponse = await fetchSkillsSh(query, 20);
                    const builtInNames = new Set(baseItems.map(i => i.displayName?.toLowerCase()));
                    const communityItems = buildSkillsShItems(
                        (skillsShResponse.skills || []).filter(s => !builtInNames.has(s.id.toLowerCase()))
                    );

                    if (searchId === activeSearchId) {
                        quickPick.items = [...filteredBuiltIn, ...communityItems];
                        quickPick.placeholder = quickPick.items.length > 0 ? 'Select a skill to install' : 'No skills found';
                    }
                } catch (error) {
                    if (searchId === activeSearchId) {
                        outputChannel.appendLine(`Community search failed: ${error}`);
                        // Keep showing filtered built-in results
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
            await installSkill(selection.installable, outputChannel, selection.displayName);
        });

    } catch (error) {
        outputChannel.appendLine(`Failed to fetch skills: ${error}`);
        const errorMsg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to load skills: ${errorMsg}`);
        quickPick.dispose();
    }
}

async function fetchBuiltInSkills(outputChannel: vscode.OutputChannel): Promise<BuiltInSkill[]> {
    // Try fetching from running Linggen server first
    const agentUrl = getAgentUrl();
    try {
        const healthy = await checkAgentHealth(agentUrl);
        if (healthy) {
            const resp = await fetch(`${agentUrl}/api/builtin-skills`, {
                signal: AbortSignal.timeout(10000)
            });
            if (resp.ok) {
                return await resp.json() as BuiltInSkill[];
            }
        }
    } catch (e) {
        outputChannel.appendLine(`Server builtin-skills fetch failed, falling back to GitHub: ${e}`);
    }

    // Fallback: fetch from GitHub API directly
    return fetchBuiltInFromGitHub(outputChannel);
}

async function fetchBuiltInFromGitHub(outputChannel: vscode.OutputChannel): Promise<BuiltInSkill[]> {
    try {
        const resp = await fetch('https://api.github.com/repos/linggen/skills/contents/', {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            signal: AbortSignal.timeout(10000)
        });
        if (!resp.ok) {
            return [];
        }
        const entries = await resp.json() as Array<{ name: string; type: string }>;
        const dirs = entries.filter(e => e.type === 'dir');

        // Fetch SKILL.md for each to get description
        const skills: BuiltInSkill[] = [];
        for (const dir of dirs) {
            try {
                const mdResp = await fetch(
                    `https://raw.githubusercontent.com/linggen/skills/main/${dir.name}/SKILL.md`,
                    { signal: AbortSignal.timeout(5000) }
                );
                if (!mdResp.ok) { continue; }
                const content = await mdResp.text();
                const desc = extractDescription(content);
                skills.push({ name: dir.name, description: desc || dir.name, installed: false });
            } catch {
                skills.push({ name: dir.name, description: dir.name, installed: false });
            }
        }
        return skills;
    } catch (e) {
        outputChannel.appendLine(`GitHub API fallback failed: ${e}`);
        return [];
    }
}

function extractDescription(content: string): string | null {
    const trimmed = content.trim();
    if (!trimmed.startsWith('---')) { return null; }
    const end = trimmed.indexOf('\n---', 3);
    if (end < 0) { return null; }
    const frontmatter = trimmed.substring(3, end);
    for (const line of frontmatter.split('\n')) {
        const match = line.trim().match(/^description:\s*(.+)/);
        if (match) {
            return match[1].trim().replace(/^["']|["']$/g, '');
        }
    }
    return null;
}

function buildBuiltInItems(skills: BuiltInSkill[]): SkillQuickPickItem[] {
    return skills.map(skill => ({
        label: `$(package) ${skill.name}`,
        description: skill.installed ? '(installed)' : '',
        detail: `${skill.description} • Source: Linggen`,
        displayName: skill.name,
        installable: {
            url: 'https://github.com/linggen/skills',
            skill: skill.name,
            ref: 'main',
            source: 'linggen' as SkillSource
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
            detail: `${skill.installs} installs • Source: Community`,
            displayName,
            installable: {
                url: repoUrl,
                skill: skill.id,
                ref: 'main',
                source: 'skillsSh' as SkillSource
            }
        };
    });
}

async function fetchSkillsSh(query: string, limit: number): Promise<SkillsShResponse> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://skills.sh/api/search?q=${encodedQuery}&limit=${limit}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error(`skills.sh returned ${response.status}`);
    }
    return await response.json() as SkillsShResponse;
}

async function installSkill(
    skill: InstallableSkill,
    outputChannel: vscode.OutputChannel,
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

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a workspace first.');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Installing skill: ${skill.skill}...`,
            cancellable: false
        },
        async (progress) => {
            try {
                progress.report({ message: 'Downloading from GitHub...' });

                const url = skill.url.trim().replace(/\.git$/, '').replace(/\/$/, '');
                const urlParts = url.replace('https://github.com/', '').split('/');
                if (urlParts.length < 2) {
                    throw new Error('Invalid GitHub URL');
                }
                const owner = urlParts[0];
                const repo = urlParts[1];
                const ref = skill.ref || 'main';

                outputChannel.appendLine(`Downloading skill: ${skillLabel} from ${url} (ref: ${ref})`);

                const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/${ref}`;
                const response = await fetch(zipUrl);

                if (!response.ok) {
                    throw new Error(`GitHub returned ${response.status}: ${response.statusText}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                progress.report({ message: 'Extracting skill...' });

                const tempZipPath = path.join(os.tmpdir(), `${skill.skill}-${Date.now()}.zip`);
                fs.writeFileSync(tempZipPath, buffer);

                const zip = new AdmZip(tempZipPath);
                const zipEntries = zip.getEntries();

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

                const targetDir = path.join(workspaceFolder.uri.fsPath, '.claude', 'skills', skill.skill);

                if (fs.existsSync(targetDir)) {
                    fs.rmSync(targetDir, { recursive: true, force: true });
                }

                fs.mkdirSync(targetDir, { recursive: true });

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

                fs.unlinkSync(tempZipPath);

                outputChannel.appendLine(`Skill installed: ${skillLabel} at ${targetDir}`);
                vscode.window.showInformationMessage(
                    `Skill "${skillLabel}" installed to .claude/skills/${skill.skill}`
                );

            } catch (error) {
                outputChannel.appendLine(`Failed to install skill: ${error}`);
                vscode.window.showErrorMessage(`Failed to install skill: ${error}`);
            }
        }
    );
}
