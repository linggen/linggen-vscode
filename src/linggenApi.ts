import * as path from 'path';

// Shapes mirror the Linggen frontend's `frontend/src/api.ts` types

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface Resource {
    id: string;
    name: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    resource_type: 'git' | 'local' | 'web' | 'uploads';
    path: string;
    enabled: boolean;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    include_patterns: string[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    exclude_patterns: string[];
}

export interface ListResourcesResponse {
    resources: Resource[];
}

export interface GraphStatusResponse {
    status: 'missing' | 'stale' | 'ready' | 'building' | 'error';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    node_count?: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    edge_count?: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    built_at?: string;
}

export interface GraphNode {
    id: string;
    label: string;
    language: string;
    folder: string;
}

export interface GraphEdge {
    source: string;
    target: string;
    kind: string;
}

export interface GraphResponse {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_id: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    built_at?: string;
}

export interface GraphQuery {
    folder?: string;
    focus?: string;
    hops?: number;
}

/**
 * Fetch all Linggen resources from the backend.
 */
export async function listResources(httpUrl: string): Promise<Resource[]> {
    const endpoint = `${httpUrl.replace(/\/+$/, '')}/api/resources`;
    const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
        throw new Error(`Failed to get resources: HTTP ${response.status}`);
    }
    const json = (await response.json()) as ListResourcesResponse;
    return json.resources ?? [];
}

/**
 * Either find an existing resource whose path overlaps the given workspacePath,
 * or create a new local resource for that workspace.
 */
export async function getOrCreateLocalResourceForWorkspace(
    httpUrl: string,
    workspacePath: string
): Promise<Resource> {
    const base = httpUrl.replace(/\/+$/, '');
    const resources = await listResources(base);

    let matching = findResourceForPath(resources, workspacePath);

    if (!matching) {
        const addEndpoint = `${base}/api/resources`;

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const body = {
            name: path.basename(workspacePath) || 'Workspace',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            resource_type: 'local',
            path: workspacePath,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            include_patterns: [] as string[],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            exclude_patterns: [] as string[]
        };

        const addResponse = await fetch(addEndpoint, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!addResponse.ok) {
            const errorText = await addResponse.text();
            throw new Error(
                `Failed to create Linggen resource: HTTP ${addResponse.status}: ${errorText}`
            );
        }

        const created = (await addResponse.json()) as { id: string; name: string };
        matching = {
            id: created.id,
            name: created.name,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            resource_type: 'local',
            path: workspacePath,
            enabled: true,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            include_patterns: [],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            exclude_patterns: []
        };
    }

    return matching;
}

/**
 * Find the best matching resource for a filesystem path, based on path prefix overlap.
 */
export function findResourceForPath(
    resources: Resource[],
    fsPath: string
): Resource | undefined {
    // Prefer the resource with the longest matching prefix
    let best: Resource | undefined;
    let bestLen = -1;

    for (const r of resources) {
        if (fsPath.startsWith(r.path) || r.path.startsWith(fsPath)) {
            const len = Math.max(r.path.length, fsPath.length);
            if (len > bestLen) {
                best = r;
                bestLen = len;
            }
        }
    }

    return best;
}

export async function getGraphStatus(
    httpUrl: string,
    sourceId: string
): Promise<GraphStatusResponse> {
    const base = httpUrl.replace(/\/+$/, '');
    const endpoint = `${base}/api/sources/${encodeURIComponent(sourceId)}/graph/status`;
    const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
        throw new Error(`Failed to get graph status: HTTP ${response.status}`);
    }
    return (await response.json()) as GraphStatusResponse;
}

export async function getGraph(
    httpUrl: string,
    sourceId: string,
    query?: GraphQuery
): Promise<GraphResponse> {
    const base = httpUrl.replace(/\/+$/, '');
    const params = new URLSearchParams();
    if (query?.folder) {
        params.set('folder', query.folder);
    }
    if (query?.focus) {
        params.set('focus', query.focus);
    }
    if (query?.hops !== undefined) {
        params.set('hops', String(query.hops));
    }

    const endpoint = `${base}/api/sources/${encodeURIComponent(sourceId)}/graph${
        params.toString() ? `?${params.toString()}` : ''
    }`;

    const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        throw new Error(`Failed to get graph: HTTP ${response.status}`);
    }
    return (await response.json()) as GraphResponse;
}

