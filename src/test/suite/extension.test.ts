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
            'linggen.pinToAnchor',
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

        assert.ok(config.has('agent.url'), 'Should have agent.url config');
        assert.strictEqual(config.get('agent.url'), 'http://localhost:9898');
    });
});
