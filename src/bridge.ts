import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as lingMem from './lingMem';
import { getOutputChannel } from './output';

const MARKER_START = '<!-- ling-mem:start -->';
const MARKER_END = '<!-- ling-mem:end -->';
const CONSENT_KEY = 'linggen.bridge.consent';

interface BridgeTarget {
    id: string;
    label: string;
    relativePath: string;
    description: string;
}

const TARGETS: BridgeTarget[] = [
    { id: 'claude', label: 'Claude Code (project)', relativePath: 'CLAUDE.md', description: 'Project-level CLAUDE.md (global CLAUDE.md is wired by install.sh)' },
    { id: 'cursor', label: 'Cursor', relativePath: '.cursor/rules/ling-mem.md', description: 'Cursor agent rules' },
    { id: 'codex', label: 'Codex / Codex CLI', relativePath: 'AGENTS.md', description: 'AGENTS.md convention' },
    { id: 'copilot', label: 'GitHub Copilot', relativePath: '.github/copilot-instructions.md', description: 'Copilot Chat instructions' },
    { id: 'windsurf', label: 'Windsurf', relativePath: '.windsurfrules', description: 'Windsurf project rules' },
    { id: 'zed', label: 'Zed', relativePath: '.rules', description: 'Zed agent rules' }
];

export function hasConsent(context: vscode.ExtensionContext): boolean {
    return context.globalState.get<string[]>(CONSENT_KEY) !== undefined;
}

export function getConsent(context: vscode.ExtensionContext): string[] {
    return context.globalState.get<string[]>(CONSENT_KEY) ?? [];
}

export async function promptConsent(context: vscode.ExtensionContext): Promise<string[]> {
    const previous = new Set(getConsent(context));
    const isFirstTime = !hasConsent(context);
    const items: (vscode.QuickPickItem & { id: string })[] = TARGETS.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        picked: isFirstTime ? true : previous.has(t.id)
    }));

    const picked = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        title: 'Bridge ling-mem to your AI agents',
        placeHolder: 'Select which agents should read your memory (you can change this later)'
    });

    // Dismissed: on first ask, treat as "no agents" so we don't re-prompt
    // every activation. On re-ask, preserve the previous choice.
    const ids = picked
        ? picked.map((p) => p.id)
        : (isFirstTime ? [] : Array.from(previous));

    await context.globalState.update(CONSENT_KEY, ids);
    return ids;
}

export async function applyToWorkspace(context: vscode.ExtensionContext): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {return;}

    const consent = new Set(getConsent(context));
    const output = getOutputChannel();
    const block = `${MARKER_START}\n${buildBridgeContent()}\n${MARKER_END}\n`;

    for (const folder of folders) {
        for (const target of TARGETS) {
            const filePath = path.join(folder.uri.fsPath, target.relativePath);
            try {
                if (consent.has(target.id)) {
                    await writeDelimited(filePath, block);
                    output.appendLine(`Bridged ${target.label} in ${folder.name}: ${target.relativePath}`);
                } else {
                    const stripped = await stripDelimited(filePath);
                    if (stripped) {
                        output.appendLine(`Un-bridged ${target.label} in ${folder.name}: ${target.relativePath}`);
                    }
                }
            } catch (err) {
                output.appendLine(`Bridge update failed for ${target.label} in ${folder.name}: ${err}`);
            }
        }
    }
}

function tildePath(absolute: string): string {
    const home = os.homedir();
    if (absolute === home) {return '~';}
    if (absolute.startsWith(home + path.sep)) {
        return '~' + absolute.slice(home.length);
    }
    return absolute;
}

function buildBridgeContent(): string {
    const skillMd = tildePath(path.join(lingMem.skillDir(), 'SKILL.md'));
    return [
        '## Memory — `ling-mem`',
        '',
        'You have access to a cross-session memory store via the `ling-mem` CLI.',
        "It holds the user's preferences, identity, decisions, and project",
        'context across every AI tool they use.',
        '',
        '### Recall flow',
        '',
        'For any question about the user — preferences, identity, projects, pets,',
        'family, history, anything they may have mentioned before — search memory',
        '**before** answering:',
        '',
        '1. Start with **short, broad queries** (single keywords beat phrases):',
        '   ```',
        '   ling-mem search "<keyword>" --limit 10 --format json | jq -c \'del(.vector)\'',
        '   ```',
        '2. If results are empty or weak, try **synonyms or related concepts**',
        '   (e.g. `"cat"` → `"pet"` → `"animal"`, `"job"` → `"role"` → `"work"`).',
        '3. **Report the top 3 relevant rows inline** — *"From memory: ..."* —',
        '   even when the match is partial. **Connect entities by context**:',
        '   a row tagged `pet` is relevant to a question about cats/dogs even if',
        '   it doesn\'t literally say "cat".',
        '4. Only say "I don\'t know" if **multiple broad searches** return nothing',
        '   relevant. Don\'t conclude from a single failed query.',
        '',
        'The `del(.vector)` filter is mandatory — raw output includes 384-dim',
        'embeddings that blow up context.',
        '',
        '### Save flow',
        '',
        'When the user states a preference, decision, or gotcha worth remembering:',
        '',
        '```',
        'ling-mem add "<one-line fact>" --type <preference|decision|fact|tried|fixed|learned|built>',
        '```',
        '',
        '### Reference files',
        '',
        '- `~/.linggen/memory/identity.md` — who the user is',
        '- `~/.linggen/memory/style.md` — how they like to work',
        `- \`${skillMd}\` — full skill spec`
    ].join('\n');
}

async function writeDelimited(filePath: string, block: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let existing = '';
    try {
        existing = await fs.readFile(filePath, 'utf8');
    } catch {
        existing = '';
    }

    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END);

    let next: string;
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const before = existing.slice(0, startIdx);
        const after = existing.slice(endIdx + MARKER_END.length).replace(/^\n/, '');
        next = `${before}${block}${after}`;
    } else if (existing.length === 0) {
        next = block;
    } else {
        next = `${existing.replace(/\n*$/, '\n\n')}${block}`;
    }

    if (next !== existing) {
        await fs.writeFile(filePath, next, 'utf8');
    }
}

async function stripDelimited(filePath: string): Promise<boolean> {
    let existing: string;
    try {
        existing = await fs.readFile(filePath, 'utf8');
    } catch {
        return false;
    }

    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {return false;}

    const before = existing.slice(0, startIdx).replace(/\n+$/, '\n');
    const after = existing.slice(endIdx + MARKER_END.length).replace(/^\n+/, '');
    const next = (before + after).replace(/\n+$/, '\n');

    if (next === existing) {return false;}
    await fs.writeFile(filePath, next, 'utf8');
    return true;
}
