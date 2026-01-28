import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { getOutputChannel } from '../output';

/**
 * Command: Linggen: Bootstrap AI Rules
 * Ensures that the project has an entrance rule for AI agents.
 * Supports Cursor, Windsurf, Antigravity, Zed, and AGENTS.md.
 */
export async function bootstrapRules(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = getOutputChannel();
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const appName = vscode.env.appName.toLowerCase();
    
    // Always bootstrap Claude skills
    await bootstrapSkills(context, rootPath);

    // Bootstrap CLAUDE.md for Claude Code users
    await bootstrapClaudeMd(rootPath);
    // Bootstrap AGENTS.md for Codex users (keep in sync with CLAUDE.md)
    await bootstrapAgentsMd(rootPath);

    let rulePath = '';

    if (appName.includes('cursor')) {
        const cursorRulesDir = path.join(rootPath, '.cursor', 'rules');
        rulePath = path.join(cursorRulesDir, 'linggen.md');
        
        // Ensure .cursor/rules directory exists
        try {
            if (!fs.existsSync(cursorRulesDir)) {
                fs.mkdirSync(cursorRulesDir, { recursive: true });
                outputChannel.appendLine(`Created directory: ${cursorRulesDir}`);
            }
        } catch (error) {
            outputChannel.appendLine(`Failed to create .cursor/rules directory: ${error}`);
            return;
        }
    } else if (appName.includes('windsurf')) {
        rulePath = path.join(rootPath, '.windsurfrules');
    } else if (appName.includes('antigravity')) {
        const antigravityDir = path.join(rootPath, '.antigravity');
        rulePath = path.join(antigravityDir, 'rules.md');
        
        // Ensure .antigravity directory exists
        try {
            if (!fs.existsSync(antigravityDir)) {
                fs.mkdirSync(antigravityDir, { recursive: true });
                outputChannel.appendLine(`Created directory: ${antigravityDir}`);
            }
        } catch (error) {
            outputChannel.appendLine(`Failed to create .antigravity directory: ${error}`);
            return;
        }
    } else if (appName.includes('zed')) {
        rulePath = path.join(rootPath, '.rules');
    } else {
        // Fallback to AGENTS.md for other IDEs or standard VS Code
        rulePath = path.join(rootPath, 'AGENTS.md');
    }

    const localSkillPath = path.join(rootPath, '.linggen', 'skills', 'linggen.md');
    const officialSkillPath = path.join(rootPath, '.linggen', 'skills', 'official', 'linggen.md');

    // 1. Determine the content
    let content = '';
    const sourcePath = fs.existsSync(localSkillPath) ? localSkillPath : (fs.existsSync(officialSkillPath) ? officialSkillPath : null);
    
    if (sourcePath) {
        // Copy the whole content of the local skill
        try {
            content = fs.readFileSync(sourcePath, 'utf8');
            outputChannel.appendLine(`Found local Linggen skill at ${sourcePath}. Syncing content to AI rules.`);
        } catch (error) {
            outputChannel.appendLine(`Error reading local skill at ${sourcePath}: ${error}`);
        }
    }

    if (!content) {
        // Use the bootstrapped Claude/Codex skill as the default template (preferred).
        // This comes from the public skills repo and keeps rules consistent across environments.
        const bootstrappedSkillPath = path.join(rootPath, '.claude', 'skills', 'linggen', 'SKILL.md');
        const templatePath = fs.existsSync(bootstrappedSkillPath)
            ? bootstrappedSkillPath
            : path.join(context.extensionPath, 'assets', 'skills', 'linggen', 'SKILL.md');
        try {
            if (fs.existsSync(templatePath)) {
                content = fs.readFileSync(templatePath, 'utf8');
                outputChannel.appendLine(`Project not Linggen-aware. Syncing with skill template.`);
            } else {
                // Fallback if template is missing
                content = `---
description: Activates Linggen Skill.
globs: ["**/*"]
---

Follow Linggen Skill instructions via shell scripts.
`;
                outputChannel.appendLine(`Template not found at ${templatePath}. Using minimal fallback.`);
            }
        } catch (error) {
            outputChannel.appendLine(`Error reading template: ${error}`);
            return;
        }
    }

    // 2. Check if the rule already exists and is identical
    const ruleAlreadyExists = fs.existsSync(rulePath);
    if (ruleAlreadyExists) {
        try {
            const existingContent = fs.readFileSync(rulePath, 'utf8');
            if (existingContent === content) {
                // Already up to date
                return;
            }
            outputChannel.appendLine(`Linggen rule at ${rulePath} is out of date. Updating...`);
        } catch (error) {
            outputChannel.appendLine(`Error reading existing rule at ${rulePath}: ${error}`);
        }
    }

    // 3. Write the file
    try {
        fs.writeFileSync(rulePath, content, 'utf8');
        outputChannel.appendLine(`Successfully synced Linggen rule at ${rulePath} (IDE: ${vscode.env.appName})`);
        
        // Optional: notify the user on first-time bootstrap
        if (!fs.existsSync(localSkillPath) && !ruleAlreadyExists) {
             vscode.window.showInformationMessage(
                `Linggen: Bootstrapped ${path.basename(rulePath)} to help the AI understand your project context.`,
                'Open Rule'
            ).then(selection => {
                if (selection === 'Open Rule') {
                    vscode.workspace.openTextDocument(rulePath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                }
            });
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to write Linggen rule: ${error}`);
    }
}

/**
 * Ensures that the project has the latest Linggen skills for Claude Code.
 */
async function bootstrapSkills(context: vscode.ExtensionContext, rootPath: string): Promise<void> {
    const outputChannel = getOutputChannel();
    const targetSkillsDir = path.join(rootPath, '.claude', 'skills', 'linggen');
    const targetScriptsDir = path.join(targetSkillsDir, 'scripts');

    try {
        // Create directories
        if (!fs.existsSync(targetScriptsDir)) {
            fs.mkdirSync(targetScriptsDir, { recursive: true });
        }

        // Prefer bootstrapping from the public skills repo so users can use Linggen outside VS Code.
        // Repo: https://github.com/linggen/skills
        const owner = 'linggen';
        const repo = 'skills';
        const ref = 'main';
        const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/${ref}`;

        outputChannel.appendLine(`Bootstrapping Linggen skill from ${owner}/${repo} (ref: ${ref})`);

        // Download zipball
        const response = await fetch(zipUrl);
        if (!response.ok) {
            throw new Error(`GitHub returned ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Write to temp and extract
        const tempZipPath = path.join(os.tmpdir(), `linggen-skills-${Date.now()}.zip`);
        fs.writeFileSync(tempZipPath, buffer);

        const zip = new AdmZip(tempZipPath);
        const zipEntries = zip.getEntries();

        // Find the linggen skill root in the zip. Supported layouts:
        // - skills/linggen/SKILL.md
        // - linggen/SKILL.md
        // The zip has a top-level prefix like "<repo>-<ref>/...".
        let skillRootInZip: string | null = null;
        for (const entry of zipEntries) {
            const entryName = entry.entryName;
            if (
                entryName.endsWith('/skills/linggen/SKILL.md') ||
                entryName.endsWith('/skills/linggen/skill.md') ||
                entryName.endsWith('/linggen/SKILL.md') ||
                entryName.endsWith('/linggen/skill.md')
            ) {
                skillRootInZip = path.dirname(entryName);
                break;
            }
        }

        if (!skillRootInZip) {
            throw new Error(`Could not find linggen SKILL.md in ${owner}/${repo}. Expected skills/linggen/SKILL.md.`);
        }

        // Clear the existing skill directory to ensure scripts/docs stay in sync.
        if (fs.existsSync(targetSkillsDir)) {
            fs.rmSync(targetSkillsDir, { recursive: true, force: true });
        }
        fs.mkdirSync(targetScriptsDir, { recursive: true });

        // Extract files under the skill root into .claude/skills/linggen
        const skillRootPrefix = skillRootInZip + '/';
        for (const entry of zipEntries) {
            if (entry.isDirectory) {
                continue;
            }
            if (!entry.entryName.startsWith(skillRootPrefix)) {
                continue;
            }

            const relativePath = entry.entryName.substring(skillRootPrefix.length);
            if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) {
                continue;
            }

            const destPath = path.join(targetSkillsDir, relativePath);
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.writeFileSync(destPath, entry.getData());
        }

        // Cleanup temp file
        try {
            fs.unlinkSync(tempZipPath);
        } catch {
            // ignore
        }

        // Set executable permissions for scripts (best-effort, may fail on Windows).
        try {
            if (fs.existsSync(targetScriptsDir)) {
                const scripts = fs.readdirSync(targetScriptsDir);
                for (const script of scripts) {
                    const scriptTarget = path.join(targetScriptsDir, script);
                    try {
                        fs.chmodSync(scriptTarget, 0o755);
                    } catch (chmodError) {
                        outputChannel.appendLine(`Failed to set executable permissions for ${scriptTarget}: ${chmodError}`);
                    }
                }
            }
        } catch (e) {
            outputChannel.appendLine(`Failed to enumerate scripts for chmod: ${e}`);
        }

        // Generate .linggen/config if it doesn't exist or update it
        const linggenConfigDir = path.join(rootPath, '.linggen');
        if (!fs.existsSync(linggenConfigDir)) {
            fs.mkdirSync(linggenConfigDir, { recursive: true });
        }
        const linggenConfigFile = path.join(linggenConfigDir, 'config');
        const config = vscode.workspace.getConfiguration('linggen');
        const apiUrl = config.get<string>('backend.httpUrl', 'http://localhost:8787');
        
        const configContent = `# Linggen Workspace Configuration\n# This file is automatically updated by the Linggen VS Code extension.\nLINGGEN_API_URL="${apiUrl}"\n`;
        fs.writeFileSync(linggenConfigFile, configContent, 'utf8');

        outputChannel.appendLine(`Successfully bootstrapped Linggen skills at ${targetSkillsDir}`);
    } catch (error) {
        outputChannel.appendLine(`Failed to bootstrap Linggen skills: ${error}`);
    }
}

/**
 * Ensures that CLAUDE.md exists and references the Linggen skill.
 * This helps Claude Code discover the .linggen folder with memory, policy, etc.
 */
async function bootstrapClaudeMd(rootPath: string): Promise<void> {
    const outputChannel = getOutputChannel();
    const claudeMdPath = path.join(rootPath, 'CLAUDE.md');
    const linggenSkillRef = 'Please read `.claude/skills/linggen/SKILL.md` on load to understand the Linggen project structure and context management system.';

    try {
        if (fs.existsSync(claudeMdPath)) {
            // Check if already has the reference
            const content = fs.readFileSync(claudeMdPath, 'utf8');
            if (content.includes('.claude/skills/linggen/SKILL.md')) {
                // Already configured
                return;
            }

            // Append the reference
            const updatedContent = content.trimEnd() + '\n\n' + linggenSkillRef + '\n';
            fs.writeFileSync(claudeMdPath, updatedContent, 'utf8');
            outputChannel.appendLine(`Updated CLAUDE.md with Linggen skill reference`);
        } else {
            // Create new CLAUDE.md with Linggen reference
            const newContent = `# Claude Code Instructions

${linggenSkillRef}
`;
            fs.writeFileSync(claudeMdPath, newContent, 'utf8');
            outputChannel.appendLine(`Created CLAUDE.md with Linggen skill reference`);
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to bootstrap CLAUDE.md: ${error}`);
    }
}

/**
 * Ensures that AGENTS.md exists and mirrors CLAUDE.md for Codex.
 */
async function bootstrapAgentsMd(rootPath: string): Promise<void> {
    const outputChannel = getOutputChannel();
    const claudeMdPath = path.join(rootPath, 'CLAUDE.md');
    const agentsMdPath = path.join(rootPath, 'AGENTS.md');
    const linggenSkillRef = 'Please read `.claude/skills/linggen/SKILL.md` on load to understand the Linggen project structure and context management system.';

    try {
        let sourceContent = '';
        if (fs.existsSync(claudeMdPath)) {
            sourceContent = fs.readFileSync(claudeMdPath, 'utf8');
        }

        if (!sourceContent) {
            sourceContent = `# Claude Code Instructions

${linggenSkillRef}
`;
        }

        if (fs.existsSync(agentsMdPath)) {
            const existingContent = fs.readFileSync(agentsMdPath, 'utf8');
            if (existingContent === sourceContent) {
                return;
            }
            fs.writeFileSync(agentsMdPath, sourceContent, 'utf8');
            outputChannel.appendLine(`Updated AGENTS.md to mirror CLAUDE.md`);
            return;
        }

        fs.writeFileSync(agentsMdPath, sourceContent, 'utf8');
        outputChannel.appendLine(`Created AGENTS.md to mirror CLAUDE.md`);
    } catch (error) {
        outputChannel.appendLine(`Failed to bootstrap AGENTS.md: ${error}`);
    }
}
