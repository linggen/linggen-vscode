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

    // 1. Check if the rule already exists
    if (fs.existsSync(rulePath)) {
        outputChannel.appendLine(`Linggen rule already exists at ${rulePath}`);
        return;
    }

    // 2. Determine the content
    let content = '';
    if (fs.existsSync(localSkillPath)) {
        // Copy the whole content of the local skill
        try {
            content = fs.readFileSync(localSkillPath, 'utf8');
            outputChannel.appendLine(`Found local Linggen skill. Copying content to AI rules.`);
        } catch (error) {
            outputChannel.appendLine(`Error reading local skill at ${localSkillPath}: ${error}`);
        }
    }

    if (!content) {
        // Use the template from assets
        const templatePath = path.join(context.extensionPath, 'assets', 'linggen-rule-template.md');
        try {
            if (fs.existsSync(templatePath)) {
                content = fs.readFileSync(templatePath, 'utf8');
                outputChannel.appendLine(`Project not Linggen-aware. Bootstrapping with default template.`);
            } else {
                // Fallback if template is missing
                content = `---
description: Activates Linggen Expert.
globs: ["**/*"]
---

Follow Linggen Expert instructions via MCP tools.
`;
                outputChannel.appendLine(`Template not found at ${templatePath}. Using minimal fallback.`);
            }
        } catch (error) {
            outputChannel.appendLine(`Error reading template: ${error}`);
            return;
        }
    }

    // If not Cursor, we might want to strip or adapt the YAML frontmatter if needed,
    // but AGENTS.md and .windsurfrules often support it or ignore it gracefully.
    // For AGENTS.md, it's safer to keep it or just provide the markdown.

    // 4. Write the file
    try {
        fs.writeFileSync(rulePath, content, 'utf8');
        outputChannel.appendLine(`Successfully bootstrapped Linggen rule at ${rulePath} (IDE: ${vscode.env.appName})`);
        
        // Optional: notify the user
        if (!fs.existsSync(localSkillPath)) {
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
