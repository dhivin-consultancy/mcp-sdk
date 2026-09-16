/**
 * Postman Collection v2.0 / v2.1 to OpenAPI 3.0 Converter
 */

export interface PostmanVariable {
  key: string;
  value?: string;
  type?: string;
  description?: string;
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanQueryParam {
  key: string;
  value?: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[] | string;
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

export interface PostmanRequestBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'graphql' | 'file';
  raw?: string;
  urlencoded?: Array<{ key: string; value?: string; description?: string }>;
  formdata?: Array<{ key: string; value?: string; type?: string; description?: string }>;
  options?: {
    raw?: {
      language?: string;
    };
  };
}

export interface PostmanRequest {
  method?: string;
  header?: PostmanHeader[];
  body?: PostmanRequestBody;
  url?: string | PostmanUrl;
  description?: string;
}

export interface PostmanResponse {
  name?: string;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
}

export interface PostmanItem {
  name?: string;
  description?: string;
  item?: PostmanItem[];
  request?: string | PostmanRequest;
  response?: PostmanResponse[];
}

export interface PostmanCollection {
  info?: {
    name?: string;
    _postman_id?: string;
    description?: string;
    schema?: string;
    version?: string;
  };
  variable?: PostmanVariable[];
  auth?: {
    type?: string;
    [key: string]: unknown;
  };
  item?: PostmanItem[];
}

/**
 * Resolve Postman web page URLs (e.g. https://documenter.getpostman.com/view/21538013/2s9YC5xC1o#...)
 * to their raw Postman gateway JSON collection API endpoint.
 */
export function resolvePostmanUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;

  const cleaned = urlStr.trim().replace(/^["'\s]+|["'\s]+$/g, '');

  try {
    const url = new URL(cleaned);
    if (url.hostname.includes('postman.com')) {
      const match = url.pathname.match(/\/view\/([^\/#?]+(?:\/[^\/#?]+)?)/);
      if (match) {
        const viewId = match[1];
        return `https://documenter.gw.postman.com/api/collections/${viewId}?segregateAuth=true&versionTag=latest`;
      }
    }
  } catch {
    // If URL parsing fails, check with regex on raw string
    const match = cleaned.match(/documenter\.getpostman\.com\/view\/([^\/#?\s]+(?:\/[^\/#?\s]+)?)/);
    if (match) {
      return `https://documenter.gw.postman.com/api/collections/${match[1]}?segregateAuth=true&versionTag=latest`;
    }
  }
  return cleaned;
}

/**
 * Extract Postman Collection JSON by inspecting Postman Documentation HTML text
 * for embedded prefetch links or meta tags (ownerId, publishedId, collectionId).
 */
export async function extractPostmanFromHtml(htmlText: string): Promise<Record<string, unknown> | null> {
  if (!htmlText || typeof htmlText !== 'string') return null;

  // 1. Try prefetch link match
  const prefetchMatch = htmlText.match(/href=["'](https:\/\/documenter\.gw\.postman\.com\/api\/collections\/[^"']+)["']/i);
  if (prefetchMatch) {
    try {
      const apiUrl = prefetchMatch[1].replace(/&amp;/g, '&');
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        return (await apiRes.json()) as Record<string, unknown>;
      }
    } catch {}
  }

  // 2. Try meta tags: ownerId & publishedId or collectionId
  const ownerIdMatch = htmlText.match(/meta\s+name=["']ownerId["']\s+content=["']([^"']+)["']/i);
  const publishedIdMatch = htmlText.match(/meta\s+name=["']publishedId["']\s+content=["']([^"']+)["']/i);
  if (ownerIdMatch && publishedIdMatch) {
    try {
      const apiUrl = `https://documenter.gw.postman.com/api/collections/${ownerIdMatch[1]}/${publishedIdMatch[1]}?segregateAuth=true&versionTag=latest`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        return (await apiRes.json()) as Record<string, unknown>;
      }
    } catch {}
  }

  const collectionIdMatch = htmlText.match(/meta\s+name=["']collectionId["']\s+content=["']([^"']+)["']/i);
  if (collectionIdMatch) {
    try {
      const apiUrl = `https://documenter.gw.postman.com/api/collections/${collectionIdMatch[1]}?segregateAuth=true&versionTag=latest`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        return (await apiRes.json()) as Record<string, unknown>;
      }
    } catch {}
  }

  return null;
}

/**
 * Check whether a given JSON object is a Postman Collection (v2.0 or v2.1).
 */
export function isPostmanCollection(spec: Record<string, unknown>): boolean {
  if (!spec || typeof spec !== 'object') return false;

  // Handle wrapped collection response (e.g. { collection: { info: ..., item: ... } })
  if ('collection' in spec && spec.collection && typeof spec.collection === 'object') {
    const inner = spec.collection as Record<string, unknown>;
    if (inner && (('info' in inner) || ('item' in inner))) {
      return isPostmanCollection(inner);
    }
  }

  // Has schema URL pointing to postman
  const schema = (spec.info as Record<string, unknown> | undefined)?.schema;
  if (typeof schema === 'string' && schema.includes('postman.com')) {
    return true;
  }

  // Has _postman_id or postman collection indicators
  const info = spec.info as Record<string, unknown> | undefined;
  if (info && ('_postman_id' in info || typeof info._postman_id === 'string')) {
    return true;
  }

  // Has item array containing request items, without OpenAPI / Swagger root keys
  const hasItemArray = Array.isArray(spec.item);
  const isOpenApi = 'openapi' in spec || 'swagger' in spec;

  if (hasItemArray && !isOpenApi && info && typeof info.name === 'string') {
    return true;
  }

  return false;
}

/**
 * Helper to infer basic JSON Schema from a sample JS value/object
 */
function valueToJsonSchema(val: unknown): Record<string, unknown> {
  if (val === null) return { type: 'string', nullable: true };
  if (typeof val === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' };
  if (typeof val === 'boolean') return { type: 'boolean' };
  if (typeof val === 'string') return { type: 'string' };

  if (Array.isArray(val)) {
    const itemSchema = val.length > 0 ? valueToJsonSchema(val[0]) : { type: 'string' };
    return { type: 'array', items: itemSchema };
  }

  if (typeof val === 'object') {
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      properties[k] = valueToJsonSchema(v);
    }
    return { type: 'object', properties };
  }

  return { type: 'string' };
}

/**
 * Convert Postman path variables (:param or {{param}}) to OpenAPI format ({param})
 */
function normalizePath(rawUrl: string, variables: Map<string, string>): { path: string; host?: string } {
  let urlStr = rawUrl.trim();

  // Substitute known collection variables in host
  for (const [k, v] of variables.entries()) {
    urlStr = urlStr.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }

  let host: string | undefined;

  // Strip scheme and domain if full URL
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
    try {
      const parsed = new URL(urlStr);
      host = `${parsed.protocol}//${parsed.host}`;
      urlStr = parsed.pathname + parsed.search;
    } catch {
      // Fallback regex strip
      const match = urlStr.match(/^(https?:\/\/[^\/]+)(\/.*)?$/);
      if (match) {
        host = match[1];
        urlStr = match[2] || '/';
      }
    }
  }

  // Remove query string from path
  const qIdx = urlStr.indexOf('?');
  if (qIdx !== -1) {
    urlStr = urlStr.substring(0, qIdx);
  }

  // Replace remaining {{variable}} or :variable with {variable}
  let path = urlStr
    .replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, '{$1}')
    .replace(/:([a-zA-Z0-9_-]+)/g, '{$1}');

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return { path, host };
}

/**
 * Convert a Postman Collection JSON into an OpenAPI 3.0.3 specification object.
 */
export function convertPostmanToOpenApi(source: Record<string, unknown> | string): Record<string, unknown> {
  let specObj: Record<string, unknown> = typeof source === 'string' ? JSON.parse(source) : (source as Record<string, unknown>);

  if (specObj && typeof specObj === 'object' && 'collection' in specObj && specObj.collection && typeof specObj.collection === 'object' && !('item' in specObj)) {
    specObj = specObj.collection as Record<string, unknown>;
  }

  const collection: PostmanCollection = specObj as unknown as PostmanCollection;

  const info = collection.info || {};
  const title = info.name || 'Postman Collection API';
  const description = info.description || 'Imported from Postman Collection';
  const version = info.version || '1.0.0';

  // 1. Extract collection variables into a map
  const collectionVars = new Map<string, string>();
  if (Array.isArray(collection.variable)) {
    for (const v of collection.variable) {
      if (v.key && typeof v.value === 'string') {
        collectionVars.set(v.key, v.value);
      }
    }
  }

  // 2. Discover Base Server URL
  let serverUrl = collectionVars.get('baseUrl') || collectionVars.get('url') || collectionVars.get('host');

  const paths: Record<string, Record<string, unknown>> = {};

  // Helper to process items recursively
  function processItems(items: PostmanItem[], currentTags: string[]) {
    for (const item of items) {
      if (Array.isArray(item.item)) {
        // Folder
        const folderTag = item.name || 'General';
        processItems(item.item, [...currentTags, folderTag]);
      } else if (item.request) {
        // Request Item
        const reqObj: PostmanRequest = typeof item.request === 'string'
          ? { method: 'GET', url: item.request }
          : item.request;

        const method = (reqObj.method || 'GET').toLowerCase();

        // Extract raw URL string
        let rawUrl = '';
        if (typeof reqObj.url === 'string') {
          rawUrl = reqObj.url;
        } else if (reqObj.url && typeof reqObj.url === 'object') {
          if (reqObj.url.raw) {
            rawUrl = reqObj.url.raw;
          } else if (reqObj.url.path) {
            const p = Array.isArray(reqObj.url.path) ? reqObj.url.path.join('/') : reqObj.url.path;
            const h = Array.isArray(reqObj.url.host) ? reqObj.url.host.join('.') : (reqObj.url.host || '');
            const proto = reqObj.url.protocol ? `${reqObj.url.protocol}://` : '';
            rawUrl = `${proto}${h}/${p}`;
          }
        }

        if (!rawUrl) continue;

        const { path, host } = normalizePath(rawUrl, collectionVars);
        if (host && !serverUrl) {
          serverUrl = host;
        }

        // Initialize path item if needed
        if (!paths[path]) {
          paths[path] = {};
        }

        // Extract parameters (path, query, header)
        const parameters: Array<Record<string, unknown>> = [];
        const paramNames = new Set<string>();

        // Path variables
        const pathVarMatches = path.match(/\{([a-zA-Z0-9_-]+)\}/g);
        if (pathVarMatches) {
          for (const match of pathVarMatches) {
            const pName = match.slice(1, -1);
            if (!paramNames.has(pName)) {
              paramNames.add(pName);
              parameters.push({
                name: pName,
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: `Path parameter ${pName}`,
              });
            }
          }
        }

        // Query parameters
        if (typeof reqObj.url === 'object' && Array.isArray(reqObj.url?.query)) {
          for (const q of reqObj.url.query) {
            if (q.disabled || !q.key) continue;
            if (!paramNames.has(`query:${q.key}`)) {
              paramNames.add(`query:${q.key}`);
              parameters.push({
                name: q.key,
                in: 'query',
                required: false,
                schema: { type: 'string' },
                description: q.description || `Query parameter ${q.key}`,
                example: q.value,
              });
            }
          }
        }

        // Header parameters
        if (Array.isArray(reqObj.header)) {
          for (const h of reqObj.header) {
            if (h.disabled || !h.key) continue;
            const lowerKey = h.key.toLowerCase();
            // Skip protocol headers
            if (['content-type', 'accept', 'authorization'].includes(lowerKey)) continue;

            if (!paramNames.has(`header:${h.key}`)) {
              paramNames.add(`header:${h.key}`);
              parameters.push({
                name: h.key,
                in: 'header',
                required: false,
                schema: { type: 'string' },
                description: h.description || `Header ${h.key}`,
                example: h.value,
              });
            }
          }
        }

        // Request Body
        let requestBody: Record<string, unknown> | undefined;
        if (reqObj.body && ['post', 'put', 'patch'].includes(method)) {
          const body = reqObj.body;
          if (body.mode === 'raw' && body.raw) {
            try {
              const jsonVal = JSON.parse(body.raw);
              const schema = valueToJsonSchema(jsonVal);
              requestBody = {
                required: true,
                content: {
                  'application/json': {
                    schema,
                    example: jsonVal,
                  },
                },
              };
            } catch {
              requestBody = {
                required: true,
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                    example: body.raw,
                  },
                },
              };
            }
          } else if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
            const properties: Record<string, unknown> = {};
            for (const field of body.urlencoded) {
              if (field.key) {
                properties[field.key] = { type: 'string', description: field.description };
              }
            }
            requestBody = {
              required: true,
              content: {
                'application/x-www-form-urlencoded': {
                  schema: { type: 'object', properties },
                },
              },
            };
          } else if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
            const properties: Record<string, unknown> = {};
            for (const field of body.formdata) {
              if (field.key) {
                properties[field.key] = { type: 'string', description: field.description };
              }
            }
            requestBody = {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: { type: 'object', properties },
                },
              },
            };
          }
        }

        // Responses
        const responses: Record<string, unknown> = {};
        if (Array.isArray(item.response) && item.response.length > 0) {
          for (const resp of item.response) {
            const statusCode = String(resp.code || 200);
            let responseSchema: Record<string, unknown> = { type: 'object' };
            let responseExample: unknown = undefined;

            if (resp.body) {
              try {
                responseExample = JSON.parse(resp.body);
                responseSchema = valueToJsonSchema(responseExample);
              } catch {
                responseSchema = { type: 'string' };
                responseExample = resp.body;
              }
            }

            responses[statusCode] = {
              description: resp.name || resp.status || 'Response',
              content: {
                'application/json': {
                  schema: responseSchema,
                  example: responseExample,
                },
              },
            };
          }
        } else {
          responses['200'] = {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          };
        }

        // Generate Operation ID (camelCase of name or method+path)
        const rawName = item.name || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const operationId = rawName
          .replace(/[^a-zA-Z0-9\s_-]/g, '')
          .split(/[\s_-]+/)
          .map((w, idx) => idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('');

        const operation: Record<string, unknown> = {
          summary: item.name || `${method.toUpperCase()} ${path}`,
          description: reqObj.description || item.description || '',
          operationId,
          tags: currentTags.length > 0 ? [currentTags[currentTags.length - 1]] : ['default'],
          parameters,
          responses,
        };

        if (requestBody) {
          operation.requestBody = requestBody;
        }

        paths[path][method] = operation;
      }
    }
  }

  if (Array.isArray(collection.item)) {
    processItems(collection.item, []);
  }

  const servers = serverUrl ? [{ url: serverUrl }] : [{ url: 'https://api.example.com' }];

  return {
    openapi: '3.0.3',
    info: {
      title,
      version,
      description,
    },
    servers,
    paths,
  };
}
