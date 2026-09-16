import { ExtractedOperation, ExtractedParam } from '../types/openapi';
import { JSONSchemaDefinition, MCPToolDefinition } from '../types/tool';

export function extractOperation(
  method: string,
  path: string,
  operation: Record<string, unknown>,
  _spec: Record<string, unknown>,
  isV3: boolean
): ExtractedOperation {
  const operationId = operation.operationId as string | undefined;
  const summary = (operation.summary as string) ?? '';
  const description = (operation.description as string) ?? summary;
  const tags = (operation.tags as string[]) ?? [];

  // Generate tool_name
  const tool_name = operationId
    ? sanitizeToolName(operationId)
    : pathToToolName(method, path);

  // Extract parameters
  const rawParams = (operation.parameters as Array<Record<string, unknown>>) ?? [];
  const params: ExtractedParam[] = rawParams.map(p => extractParam(p)).filter(p => Boolean(p.name));

  // Extract request body (OAS3)
  let bodySchema: Record<string, unknown> | null = null;
  if (isV3 && operation.requestBody) {
    const rb = operation.requestBody as Record<string, unknown>;
    const content = rb.content as Record<string, { schema?: Record<string, unknown> }>;
    const mediaType =
      content?.['application/json'] ??
      content?.['application/x-www-form-urlencoded'] ??
      Object.values(content ?? {})[0];
    bodySchema = mediaType?.schema ?? null;
  }

  // OAS2: body parameter
  if (!isV3) {
    const bodyParam = params.find(p => p.in === 'body');
    if (bodyParam) {
      bodySchema = { type: 'object', description: bodyParam.description };
    }
  }

  // Build MCP input_schema
  const input_schema = buildInputSchema(params.filter(p => p.in !== 'body'), bodySchema, path);

  // Extract response schema
  const output_schema = extractResponseSchema(operation, isV3);

  // Build natural-language prompt
  const prompt = buildPrompt(method, path, summary, description, params);

  return {
    method,
    path,
    tool_name,
    description: description || summary || `${method.toUpperCase()} ${path}`,
    tags,
    input_schema,
    output_schema,
    prompt,
    operation_id: operationId,
  };
}

export function extractParam(p: Record<string, unknown>): ExtractedParam {
  if ('$ref' in p && typeof p.$ref === 'string') {
    const refParts = p.$ref.split('/');
    const refName = refParts[refParts.length - 1] || 'param';
    return {
      name: refName,
      in: 'query',
      required: false,
      type: 'string',
      description: `Parameter: ${refName}`,
    };
  }

  const schema = (p.schema as Record<string, unknown>) ?? {};
  return {
    name: (p.name as string) ?? '',
    in: (p.in as ExtractedParam['in']) ?? 'query',
    required: (p.required as boolean) ?? false,
    type: (schema.type as string) ?? (p.type as string) ?? 'string',
    description: (p.description as string) ?? (schema.description as string) ?? '',
    example: p.example ?? schema.example,
    enum: (schema.enum as unknown[]) ?? (p.enum as unknown[]) ?? undefined,
  };
}

export function buildInputSchema(
  params: ExtractedParam[],
  bodySchema: Record<string, unknown> | null,
  path: string
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // Extract path params from URL pattern (e.g. {customerId})
  const pathParams = [...path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);

  for (const p of params) {
    if (!p.name) continue;
    const prop: Record<string, unknown> = {
      type: p.type,
      description: p.description || `${p.in} parameter: ${p.name}`,
    };
    if (p.example !== undefined) prop.example = p.example;
    if (p.enum) prop.enum = p.enum;
    properties[p.name] = prop;
    if (p.required || pathParams.includes(p.name)) required.push(p.name);
  }

  // Merge body schema properties
  if (bodySchema && typeof bodySchema === 'object') {
    const bodyProps = (bodySchema.properties as Record<string, unknown>) ?? {};
    const bodyReq = (bodySchema.required as string[]) ?? [];
    Object.assign(properties, bodyProps);
    required.push(...bodyReq);
  }

  return {
    type: 'object',
    properties,
    required: [...new Set(required)],
  };
}

export function extractResponseSchema(
  operation: Record<string, unknown>,
  isV3: boolean
): Record<string, unknown> {
  const responses = (operation.responses as Record<string, Record<string, unknown>>) ?? {};
  const successCode = ['200', '201', '204'].find(c => responses[c]) ?? Object.keys(responses)[0];
  const response = responses[successCode] ?? {};

  if (isV3) {
    const content = response.content as Record<string, { schema?: Record<string, unknown> }> | undefined;
    const schema = content?.['application/json']?.schema ?? content?.[Object.keys(content ?? {})[0]]?.schema;
    return schema ?? { type: 'object' };
  } else {
    return (response.schema as Record<string, unknown>) ?? { type: 'object' };
  }
}

export function pathToToolName(method: string, path: string): string {
  const verbMap: Record<string, string> = {
    get: 'list',
    post: 'create',
    put: 'update',
    patch: 'patch',
    delete: 'delete',
    head: 'check',
  };

  const segments = path
    .replace(/\{[^}]+\}/g, '')
    .split('/')
    .filter(Boolean);

  const base = segments.map((s, i) =>
    i === segments.length - 1 && method !== 'get'
      ? singularize(toPascalCase(s))
      : toPascalCase(s)
  ).join('');

  const verb = verbMap[method] ?? method;
  return `${verb}${base}`;
}

export function sanitizeToolName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

function toPascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function buildPrompt(
  method: string,
  path: string,
  summary: string,
  description: string,
  params: ExtractedParam[]
): string {
  const base = summary || description || `${method.toUpperCase()} ${path}`;
  const paramList = params
    .filter(p => p.in !== 'body' && Boolean(p.name))
    .map(p => `${p.name} (${p.required ? 'required' : 'optional'}): ${p.description || p.type}`)
    .join('; ');

  return paramList
    ? `${base}. Parameters: ${paramList}`
    : base;
}

/** Convert ExtractedOperation into standard MCPToolDefinition */
export function operationToMcpTool(op: ExtractedOperation): MCPToolDefinition {
  const isDangerous = ['post', 'put', 'patch', 'delete'].includes(op.method.toLowerCase());
  return {
    name: op.tool_name,
    description: op.description,
    inputSchema: op.input_schema as JSONSchemaDefinition,
    outputSchema: op.output_schema as JSONSchemaDefinition,
    prompt: op.prompt,
    tags: op.tags,
    category: op.tags[0] || 'rest_api',
    isDangerous,
    operationId: op.operation_id,
  };
}
