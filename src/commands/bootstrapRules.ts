import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getOutputChannel } from '../output';

const ANCHOR_RULE_CONTENT = `# Linggen Anchor System

Code files in this project may contain \`// linggen anchor: <repo-relative-path>\` comments.
These comments point to anchor files under \`.linggen/anchor/\` (Markdown files with structured context).

When you encounter a \`linggen anchor:\` comment, read the referenced file to understand the
context, constraints, and conventions it describes. Treat anchor content as authoritative
project knowledge that should inform your code generation and suggestions.
`;

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

    // Clean up old skill artifacts
    cleanupOldSkills(rootPath);

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

    const content = ANCHOR_RULE_CONTENT;

    // Check if the rule already exists and is identical
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

    // Write the file
    try {
        fs.writeFileSync(rulePath, content, 'utf8');
        outputChannel.appendLine(`Successfully synced Linggen rule at ${rulePath} (IDE: ${vscode.env.appName})`);

        // Optional: notify the user on first-time bootstrap
        if (!ruleAlreadyExists) {
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

const ANCHOR_AWARE_REF = `When code files contain \`// linggen anchor: <path>\` comments, read the referenced anchor file under \`.linggen/anchor/\` for context.`;

/**
 * Ensures that CLAUDE.md exists and references the Linggen anchor system.
 */
async function bootstrapClaudeMd(rootPath: string): Promise<void> {
    const outputChannel = getOutputChannel();
    const claudeMdPath = path.join(rootPath, 'CLAUDE.md');

    // Old references to migrate away from
    const oldSkillRefs = [
        '.claude/skills/memory/SKILL.md',
        '.claude/skills/linggen/SKILL.md'
    ];

    try {
        if (fs.existsSync(claudeMdPath)) {
            let content = fs.readFileSync(claudeMdPath, 'utf8');
            let modified = false;

            // Migrate old skill references
            for (const oldRef of oldSkillRefs) {
                if (content.includes(oldRef)) {
                    // Replace the line containing the old reference
                    content = content.replace(
                        new RegExp(`.*${oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\n?`, 'g'),
                        ''
                    );
                    modified = true;
                }
            }

            if (content.includes('linggen anchor:')) {
                // Already has anchor awareness
                if (modified) {
                    fs.writeFileSync(claudeMdPath, content, 'utf8');
                    outputChannel.appendLine(`Migrated CLAUDE.md: removed old skill references`);
                }
                return;
            }

            // Append anchor awareness
            const updatedContent = content.trimEnd() + '\n\n' + ANCHOR_AWARE_REF + '\n';
            fs.writeFileSync(claudeMdPath, updatedContent, 'utf8');
            outputChannel.appendLine(`Updated CLAUDE.md with anchor awareness`);
        } else {
            // Create new CLAUDE.md
            const newContent = `# Claude Code Instructions\n\n${ANCHOR_AWARE_REF}\n`;
            fs.writeFileSync(claudeMdPath, newContent, 'utf8');
            outputChannel.appendLine(`Created CLAUDE.md with anchor awareness`);
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to bootstrap CLAUDE.md: ${error}`);
    }
}

/**
 * Ensures that AGENTS.md exists and references the Linggen anchor system.
 * Preserves user content and only appends the reference if missing.
 */
async function bootstrapAgentsMd(rootPath: string): Promise<void> {
    const outputChannel = getOutputChannel();
    const claudeMdPath = path.join(rootPath, 'CLAUDE.md');
    const agentsMdPath = path.join(rootPath, 'AGENTS.md');

    // Old references to migrate away from
    const oldSkillRefs = [
        '.claude/skills/memory/SKILL.md',
        '.claude/skills/linggen/SKILL.md'
    ];

    try {
        if (fs.existsSync(agentsMdPath)) {
            let existingContent = fs.readFileSync(agentsMdPath, 'utf8');
            let modified = false;

            // Migrate old skill references
            for (const oldRef of oldSkillRefs) {
                if (existingContent.includes(oldRef)) {
                    existingContent = existingContent.replace(
                        new RegExp(`.*${oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\n?`, 'g'),
                        ''
                    );
                    modified = true;
                }
            }

            if (existingContent.includes('linggen anchor:')) {
                if (modified) {
                    fs.writeFileSync(agentsMdPath, existingContent, 'utf8');
                    outputChannel.appendLine(`Migrated AGENTS.md: removed old skill references`);
                }
                return;
            }

            const updatedContent = existingContent.trimEnd() + '\n\n' + ANCHOR_AWARE_REF + '\n';
            fs.writeFileSync(agentsMdPath, updatedContent, 'utf8');
            outputChannel.appendLine(`Updated AGENTS.md with anchor awareness`);
            return;
        }

        let newContent = '';
        if (fs.existsSync(claudeMdPath)) {
            const claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
            if (claudeContent.includes('linggen anchor:')) {
                newContent = claudeContent;
            } else {
                newContent = claudeContent.trimEnd() + '\n\n' + ANCHOR_AWARE_REF + '\n';
            }
        } else {
            newContent = `# Claude Code Instructions\n\n${ANCHOR_AWARE_REF}\n`;
        }

        fs.writeFileSync(agentsMdPath, newContent, 'utf8');
        outputChannel.appendLine(`Created AGENTS.md with anchor awareness`);
    } catch (error) {
        outputChannel.appendLine(`Failed to bootstrap AGENTS.md: ${error}`);
    }
}

/**
 * Remove old skill artifacts that are no longer needed.
 */
function cleanupOldSkills(rootPath: string): void {
    const outputChannel = getOutputChannel();
    const oldSkillDir = path.join(rootPath, '.claude', 'skills', 'memory');

    try {
        if (fs.existsSync(oldSkillDir)) {
            fs.rmSync(oldSkillDir, { recursive: true, force: true });
            outputChannel.appendLine(`Removed old skill directory: ${oldSkillDir}`);

            // Clean up parent if empty
            const skillsDir = path.join(rootPath, '.claude', 'skills');
            try {
                const remaining = fs.readdirSync(skillsDir);
                if (remaining.length === 0) {
                    fs.rmdirSync(skillsDir);
                    outputChannel.appendLine(`Removed empty skills directory: ${skillsDir}`);
                }
            } catch {
                // ignore
            }
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to clean up old skills: ${error}`);
    }
}
