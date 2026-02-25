import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Linggen Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('linggen.linggen-vscode'));
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);

        const expected = [
            'linggen.installCli',
            'linggen.indexCurrentProject',
            'linggen.explainAcrossProjects',
            'linggen.showGraphInPanel',
            'linggen.openLibrary',
            'linggen.pinToMemory',
            'linggen.browseOnlineSkills',
            'linggen.agentChat',
            'linggen.agentListRuns',
        ];

        for (const cmd of expected) {
            assert.ok(
                commands.includes(cmd),
                `${cmd} command should be registered`
            );
        }
    });

    test('Configuration should have expected properties', () => {
        const config = vscode.workspace.getConfiguration('linggen');

        // New settings
        assert.ok(config.has('memory.url'), 'Should have memory.url config');
        assert.ok(config.has('agent.url'), 'Should have agent.url config');
        assert.ok(config.has('mcp.enabled'), 'Should have mcp.enabled config');

        // Deprecated (still present for backward compat)
        assert.ok(config.has('backend.httpUrl'), 'Should have backend.httpUrl config');

        // Default values
        assert.strictEqual(config.get('memory.url'), 'http://localhost:8787');
        assert.strictEqual(config.get('agent.url'), 'http://localhost:6666');
        assert.strictEqual(config.get('backend.httpUrl'), 'http://localhost:8787');
        assert.strictEqual(config.get('mcp.enabled'), false);
    });
});

