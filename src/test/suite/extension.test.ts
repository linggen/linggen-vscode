import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Linggen Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('linggen.linggen-vscode'));
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);

        // Installer command (runs in terminal after confirmation)
        assert.ok(
            commands.includes('linggen.installCli'),
            'linggen.installCli command should be registered'
        );
        assert.ok(
            commands.includes('linggen.indexCurrentProject'),
            'linggen.indexCurrentProject command should be registered'
        );
        assert.ok(
            commands.includes('linggen.openGraphView'),
            'linggen.openGraphView command should be registered'
        );
        assert.ok(
            commands.includes('linggen.configureCursorMsp'),
            'linggen.configureCursorMsp command should be registered'
        );
    });

    test('Configuration should have expected properties', () => {
        const config = vscode.workspace.getConfiguration('linggen');

        assert.ok(config.has('backend.httpUrl'), 'Should have backend.httpUrl config');
        assert.ok(config.has('installUrl'), 'Should have installUrl config');
    });
});

