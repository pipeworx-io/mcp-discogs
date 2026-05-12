interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Discogs MCP — music release / artist / label database
 *
 * Discogs is the most complete release-level catalog: vinyl/format/pressing
 * detail, marketplace prices, label discographies. Complements `musicbrainz`
 * (broader / metadata-focused) for "what was the original UK pressing of X"
 * questions.
 *
 * API: https://www.discogs.com/developers
 * Auth: header `Authorization: Discogs token=<personal_access_token>` —
 *       free, generated at discogs.com/settings/developers.
 *
 * Tools:
 * - search:         full-text search (release / master / artist / label)
 * - get_release:    release detail
 * - get_master:     master release detail (concept across editions)
 * - get_artist:     artist profile
 * - get_label:      label profile
 */


const BASE_URL = 'https://api.discogs.com';
const USER_AGENT = 'Pipeworx-Discogs-MCP/0.1 (contact@mojibake.ai)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search',
    description:
      'Full-text search across Discogs (releases, masters, artists, labels). Filter by type, title, artist, format (e.g., "Vinyl", "CD"), country, year, genre, style, label.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query' },
        type: { type: 'string', description: 'release | master | artist | label' },
        title: { type: 'string', description: 'Title filter' },
        artist: { type: 'string', description: 'Artist filter' },
        label: { type: 'string', description: 'Label filter' },
        format: { type: 'string', description: 'e.g., "Vinyl", "CD", "Album"' },
        country: { type: 'string', description: 'Country of release' },
        year: { type: 'string', description: 'Release year or year-range' },
        genre: { type: 'string', description: 'Genre filter' },
        style: { type: 'string', description: 'Style filter' },
        page: { type: 'number', description: '1-based page' },
        per_page: { type: 'number', description: '1-100 (default 25)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_release',
    description:
      'Full release detail: title, artists, labels, formats, tracklist, credits, year, country, notes, identifiers (barcode, matrix), data quality.',
    inputSchema: {
      type: 'object',
      properties: {
        release_id: { type: 'number', description: 'Discogs release ID' },
      },
      required: ['release_id'],
    },
  },
  {
    name: 'get_master',
    description: 'Master release detail (the canonical work across all editions/pressings).',
    inputSchema: {
      type: 'object',
      properties: {
        master_id: { type: 'number', description: 'Discogs master ID' },
      },
      required: ['master_id'],
    },
  },
  {
    name: 'get_artist',
    description: 'Artist profile + identifiers.',
    inputSchema: {
      type: 'object',
      properties: {
        artist_id: { type: 'number', description: 'Discogs artist ID' },
      },
      required: ['artist_id'],
    },
  },
  {
    name: 'get_label',
    description: 'Label profile + parent label + sublabels.',
    inputSchema: {
      type: 'object',
      properties: {
        label_id: { type: 'number', description: 'Discogs label ID' },
      },
      required: ['label_id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'Discogs requires a personal access token. Pass ?_apiKey=<token> after generating one at https://www.discogs.com/settings/developers.',
    );
  }
  switch (name) {
    case 'search':
      return search(apiKey, args);
    case 'get_release':
      return discogsGet(apiKey, `/releases/${reqNum(args, 'release_id', '249504')}`);
    case 'get_master':
      return discogsGet(apiKey, `/masters/${reqNum(args, 'master_id', '15')}`);
    case 'get_artist':
      return discogsGet(apiKey, `/artists/${reqNum(args, 'artist_id', '108713')}`);
    case 'get_label':
      return discogsGet(apiKey, `/labels/${reqNum(args, 'label_id', '1')}`);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqNum(args: Record<string, unknown>, key: string, example: string): number {
  const v = args[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Required argument "${key}" must be a number. Example: ${example}.`);
  }
  return v;
}

async function discogsFetch<T>(apiKey: string, path: string, params?: URLSearchParams): Promise<T> {
  const url = `${BASE_URL}${path}${params?.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Discogs token=${apiKey}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error('Discogs: unauthorized — check the personal access token');
  if (res.status === 404) throw new Error('Discogs: not found (HTTP 404)');
  if (res.status === 429) throw new Error('Discogs: rate-limit (HTTP 429) — 60 req/min for authenticated users');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discogs error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function discogsGet(apiKey: string, path: string) {
  return discogsFetch<Record<string, unknown>>(apiKey, path);
}

async function search(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({ q: String(args.query) });
  for (const k of ['type', 'title', 'artist', 'label', 'format', 'country', 'year', 'genre', 'style']) {
    if (args[k]) params.set(k, String(args[k]));
  }
  params.set('page', String(Math.max(1, (args.page as number) ?? 1)));
  params.set('per_page', String(Math.min(100, Math.max(1, (args.per_page as number) ?? 25))));

  const data = await discogsFetch<{
    pagination?: { items?: number; page?: number; pages?: number; per_page?: number };
    results?: {
      id?: number;
      type?: string;
      title?: string;
      year?: string;
      country?: string;
      format?: string[];
      label?: string[];
      genre?: string[];
      style?: string[];
      barcode?: string[];
      catno?: string;
      uri?: string;
      thumb?: string;
      master_id?: number;
      master_url?: string | null;
    }[];
  }>(apiKey, '/database/search', params);

  return {
    total: data.pagination?.items ?? 0,
    page: data.pagination?.page ?? null,
    total_pages: data.pagination?.pages ?? null,
    per_page: data.pagination?.per_page ?? null,
    returned: data.results?.length ?? 0,
    results: (data.results ?? []).map((r) => ({
      id: r.id ?? null,
      type: r.type ?? null,
      title: r.title ?? null,
      year: r.year ?? null,
      country: r.country ?? null,
      formats: r.format ?? [],
      labels: r.label ?? [],
      genres: r.genre ?? [],
      styles: r.style ?? [],
      catalog_number: r.catno ?? null,
      barcodes: r.barcode ?? [],
      master_id: r.master_id ?? null,
      discogs_url: r.uri ? `https://www.discogs.com${r.uri}` : null,
      thumbnail: r.thumb ?? null,
    })),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
