import * as vscode from 'vscode';
import { checkServerHealth, getMemoryUrl } from '../helpers';

interface LibraryPack {
    id: string;
    name: string;
    folder?: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    read_only?: boolean;
    scope?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    created_at?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    updated_at?: string;
}

interface LibraryFile {
    path: string;
    content: string;
}

interface ManifestItem {
    id: string;
    name: string;
    type: string;
    readOnly?: boolean;
    installedAt: string;
    sourceUrl: string;
}

interface LibraryManifest {
    installed: ManifestItem[];
}

interface LibraryQuickPickItem extends vscode.QuickPickItem {
    pack?: LibraryPack;
    folder?: string;
}

export async function openLibrary(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const httpUrl = getMemoryUrl();
    // Newer Linggen servers:
    // - GET /api/library                -> { folders: string[], packs: LibraryPack[] }
    // - GET /api/library/packs/<id>     -> { path: string, content: string }
    //
    // Older servers may support GET /api/library/packs -> { packs: LibraryPack[] }.
    const listEndpoint = '/api/library';
    const readEndpoint = '/api/library/packs';

    const isRunning = await checkServerHealth(httpUrl);
    if (!isRunning) {
        vscode.window.showInformationMessage('Linggen is not running. Start it to browse the library.');
        return;
    }

    await showLibraryFolders(httpUrl, listEndpoint, readEndpoint, workspaceFolders[0].uri);
}

async function showLibraryFolders(
    httpUrl: string,
    listEndpoint: string,
    readEndpoint: string,
    rootUri: vscode.Uri
): Promise<void> {
    const quickPick = vscode.window.createQuickPick<LibraryQuickPickItem>();
    quickPick.title = 'Linggen Library';
    quickPick.placeholder = 'Loading packs...';
    quickPick.busy = true;
    quickPick.show();

    try {
        const packs = await fetchLibraryPacks(httpUrl, listEndpoint);

        // Group by folder
        const folders = new Set<string>();
        for (const pack of packs) {
            folders.add(pack.folder || 'general');
        }

        const items: LibraryQuickPickItem[] = Array.from(folders).sort().map(folder => ({
            label: `$(folder) ${folder}`,
            description: `Browse ${folder} packs`,
            folder: folder
        }));

        quickPick.items = items;
        quickPick.busy = false;
        quickPick.placeholder = 'Select a folder to browse packs';

        quickPick.onDidAccept(async () => {
            const selection = quickPick.selectedItems[0];
            if (!selection || !selection.folder) {
                return;
            }

            quickPick.dispose();
            const folderPacks = packs.filter(p => (p.folder || 'general') === selection.folder);
            await showPacksInFolder(selection.folder, folderPacks, httpUrl, readEndpoint, rootUri);
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch library: ${error}`);
        quickPick.dispose();
    }
}

async function showPacksInFolder(
    folderName: string,
    packs: LibraryPack[],
    httpUrl: string,
    readEndpoint: string,
    rootUri: vscode.Uri
): Promise<void> {
    const quickPick = vscode.window.createQuickPick<LibraryQuickPickItem>();
    quickPick.title = `Linggen Library: ${folderName}`;
    quickPick.placeholder = 'Select a pack to install';

    const items: LibraryQuickPickItem[] = [
        {
            label: '$(arrow-left) ..',
            description: 'Go back to folders',
            folder: '..' // special value to go back
        },
        ...packs.map(pack => ({
            label: `${pack.read_only ? '$(lock) ' : '$(file-code) '}${pack.name}`,
            description: pack.description || pack.id,
            pack: pack
        }))
    ];

    quickPick.items = items;
    quickPick.show();

    quickPick.onDidAccept(async () => {
        const selection = quickPick.selectedItems[0];
        if (!selection) {
            return;
        }

        if (selection.folder === '..') {
            quickPick.dispose();
            const listEndpoint = '/api/library/packs';
            await showLibraryFolders(httpUrl, listEndpoint, readEndpoint, rootUri);
        } else if (selection.pack) {
            await installPack(selection.pack, httpUrl, readEndpoint, rootUri);
            quickPick.dispose();
        }
    });
}

async function fetchLibraryPacks(httpUrl: string, endpoint: string): Promise<LibraryPack[]> {
    const url = new URL(endpoint, httpUrl);

    const tryGet = async (u: string): Promise<LibraryPack[]> => {
        const res = await fetch(u);
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`GET ${u} returned ${res.status}: ${text}`);
        }
        let json: unknown;
        try {
            json = JSON.parse(text) as unknown;
        } catch (e) {
            throw new Error(`GET ${u} returned non-JSON response: ${String(e)} (${text.slice(0, 200)})`);
        }

        // Supported shapes:
        // - { packs: [...] }
        // - { folders: [...], packs: [...] }
        // - [ ...packs ]
        if (Array.isArray(json)) {
            return json as LibraryPack[];
        }
        if (json && typeof json === 'object') {
            const obj = json as { packs?: unknown };
            if (Array.isArray(obj.packs)) {
                return obj.packs as LibraryPack[];
            }
        }

        return [];
    };

    // Preferred list endpoint (new servers): /api/library
    try {
        return await tryGet(url.toString());
    } catch (e) {
        // Backward compatibility: older servers used GET /api/library/packs
        const fallback = new URL('/api/library/packs', httpUrl).toString();
        try {
            return await tryGet(fallback);
        } catch {
            throw e;
        }
    }
}

function joinUrl(base: string, endpointPath: string): string {
    const b = base.replace(/\/+$/, '');
    const p = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    return `${b}${p}`;
}

function buildReadUrl(httpUrl: string, endpoint: string, packId: string): string {
    const encodedId = encodeURIComponent(packId);
    const base = joinUrl(httpUrl, endpoint);
    // If caller provided a templated endpoint, respect it.
    if (base.includes('{id}')) {
        return base.replace('{id}', encodedId);
    }
    return `${base.replace(/\/+$/, '')}/${encodedId}`;
}

async function installPack(
    pack: LibraryPack,
    httpUrl: string,
    endpoint: string,
    rootUri: vscode.Uri
): Promise<void> {
    try {
        // Read pack content
        // Encode pack.id because it contains slashes (e.g. official/skills/linggen.md)
        const readUrl = buildReadUrl(httpUrl, endpoint, pack.id);

        const res = await fetch(readUrl);
        if (!res.ok) {
            throw new Error(`GET ${readUrl} returned ${res.status}: ${await res.text()}`);
        }

        const data = await res.json() as LibraryFile;

        // Use the original filename from the server path if available, or fall back to pack.name + .md
        let fileName = pack.id + '.md';
        if (data.path) {
            fileName = data.path.split(/[/\\]/).pop() || fileName;
        } else if (pack.name) {
            fileName = pack.name.toLowerCase().replace(/\s+/g, '-') + '.md';
        }

        // Determine destination folder based on pack folder or name
        // Backend returns folder like "official/skills" or "skills"
        const folderName = pack.folder || 'general';
        let destDir = `.linggen/${folderName}`;

        if (pack.read_only) {
            // If it's official, we want to store it in .linggen/<type>/official/
            // e.g. "official/skills" -> ".linggen/skills/official"
            if (folderName.startsWith('official/')) {
                const type = folderName.replace('official/', '');
                destDir = `.linggen/${type}/official`;
            } else if (folderName === 'official') {
                destDir = `.linggen/general/official`;
            } else {
                destDir = `.linggen/${folderName}/official`;
            }
        }

        const dirUri = vscode.Uri.joinPath(rootUri, destDir);
        const fileUri = vscode.Uri.joinPath(dirUri, fileName);

        await vscode.workspace.fs.createDirectory(dirUri);
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(data.content));

        vscode.window.showInformationMessage(`Installed ${pack.name} to ${destDir}/${fileName}`);

        // Update manifest
        await updateLibraryManifest(rootUri, pack, httpUrl);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to install pack: ${error}`);
    }
}

async function updateLibraryManifest(rootUri: vscode.Uri, pack: LibraryPack, httpUrl: string): Promise<void> {
    const manifestUri = vscode.Uri.joinPath(rootUri, '.linggen', 'library.lock.json');
    let manifest: LibraryManifest = { installed: [] };

    try {
        const data = await vscode.workspace.fs.readFile(manifestUri);
        manifest = JSON.parse(new TextDecoder().decode(data)) as LibraryManifest;
    } catch {
        // Manifest doesn't exist yet
    }

    const newItem: ManifestItem = {
        id: pack.id,
        name: pack.name,
        type: pack.folder || 'general',
        readOnly: pack.read_only,
        installedAt: new Date().toISOString(),
        sourceUrl: httpUrl
    };

    // Replace if already exists by id
    const index = manifest.installed.findIndex((item: ManifestItem) => item.id === pack.id);
    if (index >= 0) {
        manifest.installed[index] = newItem;
    } else {
        manifest.installed.push(newItem);
    }

    await vscode.workspace.fs.writeFile(manifestUri, new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
}
