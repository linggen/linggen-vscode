import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getOutputChannel } from '../output';

/**
 * Command: Linggen: Bootstrap Cursor Rules
 * Ensures that the project has an entrance rule in .cursor/rules/linggen.md.
 */
export async function bootstrapRules(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = getOutputChannel();
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const cursorRulesDir = path.join(rootPath, '.cursor', 'rules');
    const linggenRulePath = path.join(cursorRulesDir, 'linggen.md');
    const localSkillPath = path.join(rootPath, '.linggen', 'skills', 'linggen.md');

    // 1. Check if the rule already exists
    if (fs.existsSync(linggenRulePath)) {
        outputChannel.appendLine(`Linggen rule already exists at ${linggenRulePath}`);
        return;
    }

    // 2. Ensure .cursor/rules directory exists
    try {
        if (!fs.existsSync(cursorRulesDir)) {
            fs.mkdirSync(cursorRulesDir, { recursive: true });
            outputChannel.appendLine(`Created directory: ${cursorRulesDir}`);
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to create .cursor/rules directory: ${error}`);
        return;
    }

    // 3. Determine the content
    let content = '';
    if (fs.existsSync(localSkillPath)) {
        // Copy the whole content of the local skill
        try {
            content = fs.readFileSync(localSkillPath, 'utf8');
            outputChannel.appendLine(`Found local Linggen skill. Copying content to Cursor rules.`);
        } catch (error) {
            outputChannel.appendLine(`Error reading local skill at ${localSkillPath}: ${error}`);
            // Fallback to template if read fails
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

    // 4. Write the file
    try {
        fs.writeFileSync(linggenRulePath, content, 'utf8');
        outputChannel.appendLine(`Successfully bootstrapped Linggen rule at ${linggenRulePath}`);
        
        // Optional: notify the user if this was a significant first-time setup
        if (!fs.existsSync(localSkillPath)) {
             vscode.window.showInformationMessage(
                'Linggen: Bootstrapped Cursor rules to help the AI understand your project context.',
                'Open Rule'
            ).then(selection => {
                if (selection === 'Open Rule') {
                    vscode.workspace.openTextDocument(linggenRulePath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                }
            });
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to write Linggen rule: ${error}`);
    }
}
