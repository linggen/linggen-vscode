import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
        // Use the skill definition from assets as the default template
        const templatePath = path.join(context.extensionPath, 'assets', 'skills', 'linggen', 'SKILL.md');
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
    const assetsSkillsDir = path.join(context.extensionPath, 'assets', 'skills', 'linggen');
    const targetSkillsDir = path.join(rootPath, '.claude', 'skills', 'linggen');
    const targetScriptsDir = path.join(targetSkillsDir, 'scripts');

    if (!fs.existsSync(assetsSkillsDir)) {
        return;
    }

    try {
        // Create directories
        if (!fs.existsSync(targetScriptsDir)) {
            fs.mkdirSync(targetScriptsDir, { recursive: true });
        }

        // Copy SKILL.md
        const skillMdSource = path.join(assetsSkillsDir, 'SKILL.md');
        const skillMdTarget = path.join(targetSkillsDir, 'SKILL.md');
        if (fs.existsSync(skillMdSource)) {
            fs.copyFileSync(skillMdSource, skillMdTarget);
        }

        // Copy scripts
        const scriptsSourceDir = path.join(assetsSkillsDir, 'scripts');
        if (fs.existsSync(scriptsSourceDir)) {
            const scripts = fs.readdirSync(scriptsSourceDir);
            for (const script of scripts) {
                const scriptSource = path.join(scriptsSourceDir, script);
                const scriptTarget = path.join(targetScriptsDir, script);
                fs.copyFileSync(scriptSource, scriptTarget);
                // Set executable permissions
                try {
                    fs.chmodSync(scriptTarget, 0o755);
                } catch (chmodError) {
                    outputChannel.appendLine(`Failed to set executable permissions for ${scriptTarget}: ${chmodError}`);
                }
            }
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
