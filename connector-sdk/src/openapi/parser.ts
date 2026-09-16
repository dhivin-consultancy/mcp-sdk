// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwaggerParser = require('@apidevtools/swagger-parser') as {
  validate: (source: string | object) => Promise<object>;
  dereference: (source: string | object) => Promise<object>;
};
import yaml from 'js-yaml';
import { ExtractedOperation, ParsedSpec } from '../types/openapi';
import { extractSecuritySchemes } from './security';
import { extractOperation } from './generator';
import { isPostmanCollection, convertPostmanToOpenApi, resolvePostmanUrl, extractPostmanFromHtml } from './postman';

/**
 * Parse an OpenAPI spec or Postman collection (JSON/YAML string, URL, or JS object)
 * and extract all operations as MCP-ready tool definitions.
 *
 * @param source Raw YAML/JSON string, a URL string, or parsed object
 */
export async function parseOpenApiSpec(source: string | Record<string, unknown>): Promise<ParsedSpec> {
  let raw: Record<string, unknown> = {};

  if (typeof source === 'string') {
    const sourceStr = source.trim().replace(/^["'\s]+|["'\s]+$/g, '');

    // 1. Check if input string is raw HTML content
    if (sourceStr.startsWith('<!') || sourceStr.startsWith('<html') || sourceStr.startsWith('<HTML') || sourceStr.includes('<meta name="generator" content="Postman')) {
      const extracted = await extractPostmanFromHtml(sourceStr);
      if (extracted) {
        raw = extracted;
      } else {
        throw new Error('The input content is an HTML web page rather than a valid OpenAPI or Postman Collection JSON/YAML document.');
      }
    }
    // 2. Check if input string is a URL
    else if (sourceStr.startsWith('http://') || sourceStr.startsWith('https://')) {
      const resolvedUrl = resolvePostmanUrl(sourceStr);
      let text = '';

      try {
        const api = await SwaggerParser.validate(resolvedUrl) as Record<string, unknown>;
        raw = api;
      } catch {
        // Fallback: fetch raw spec text directly from URL
        try {
          const res = await fetch(resolvedUrl);
          if (res.ok) {
            text = await res.text();
          }
        } catch {
          // If fetch resolvedUrl failed, try original source URL
          if (resolvedUrl !== sourceStr) {
            const res = await fetch(sourceStr);
            if (res.ok) text = await res.text();
          }
        }

        // If returned text is HTML (e.g. Postman documenter HTML page), try extracting Postman API collection
        if (text && (text.trim().startsWith('<!') || text.trim().startsWith('<html') || text.trim().startsWith('<HTML') || text.includes('<meta name='))) {
          const extracted = await extractPostmanFromHtml(text);
          if (extracted) {
            raw = extracted;
          } else {
            throw new Error('The spec URL returned an HTML web page rather than a raw OpenAPI or Postman Collection JSON/YAML specification.');
          }
        } else if (text) {
          try {
            raw = JSON.parse(text) as Record<string, unknown>;
          } catch {
            try {
              raw = yaml.load(text) as Record<string, unknown>;
            } catch (yamlErr: any) {
              throw new Error(`Failed to parse specification. Ensure content is valid JSON or YAML format (${yamlErr.message || String(yamlErr)})`);
            }
          }
        }
      }
    }
    // 3. Raw YAML or JSON string input
    else {
      try {
        raw = JSON.parse(sourceStr) as Record<string, unknown>;
      } catch {
        try {
          raw = yaml.load(sourceStr) as Record<string, unknown>;
        } catch {
          // Check if user pasted plain text / HTML markdown instead of JSON/YAML
          if (sourceStr.includes('<meta') || sourceStr.includes('## ') || sourceStr.includes('<!doctype')) {
            const extracted = await extractPostmanFromHtml(sourceStr);
            if (extracted) {
              raw = extracted;
            } else {
              throw new Error('The pasted content is plain text / HTML documentation rather than a valid JSON or YAML specification.');
            }
          } else {
            throw new Error('Invalid specification format. Content must be a valid OpenAPI or Postman Collection JSON or YAML document.');
          }
        }
      }
    }
  } else {
    raw = source;
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid spec content. Must be a valid JSON or YAML object.');
  }

  // Check if it is a Postman Collection and convert to OpenAPI 3.0 if so
  let isPostman = false;
  if (isPostmanCollection(raw)) {
    isPostman = true;
    raw = convertPostmanToOpenApi(raw);
  } else {
    // Dereference $ref pointers with fallback for standard OpenAPI specs
    try {
      const api = await SwaggerParser.dereference(raw as Parameters<typeof SwaggerParser.dereference>[0]);
      raw = api as unknown as Record<string, unknown>;
    } catch {
      // If dereferencing fails (e.g. unresolvable external $refs), fallback to raw object
    }
  }

  const result = extractFromSpec(raw);
  if (isPostman) {
    result.is_postman = true;
  }
  return result;
}

/**
 * Core spec extractor.
 */
export function extractFromSpec(spec: Record<string, unknown>): ParsedSpec {
  let processedSpec = spec;
  let isPostman = false;

  if (isPostmanCollection(processedSpec)) {
    isPostman = true;
    processedSpec = convertPostmanToOpenApi(processedSpec);
  }

  const isV3 = 'openapi' in processedSpec && typeof processedSpec.openapi === 'string' && processedSpec.openapi.startsWith('3');
  const isV2 = 'swagger' in processedSpec;

  if (!isV3 && !isV2) {
    throw new Error('Unsupported spec format. Only OpenAPI 2.x (Swagger), OpenAPI 3.x, and Postman Collections (v2.0/v2.1) are supported.');
  }

  const info = (processedSpec.info as Record<string, string>) ?? {};
  const title = info.title ?? 'Untitled API';
  const version = info.version ?? '1.0.0';
  const description = info.description ?? '';

  // Base URL
  let base_url = '';
  if (isV3) {
    const servers = (processedSpec.servers as Array<{ url: string }>) ?? [];
    base_url = servers[0]?.url ?? '';
  } else {
    // OAS2
    const host = (processedSpec.host as string) ?? '';
    const basePath = (processedSpec.basePath as string) ?? '';
    const schemes = (processedSpec.schemes as string[]) ?? ['https'];
    base_url = `${schemes[0]}://${host}${basePath}`;
  }

  const paths = (processedSpec.paths as Record<string, Record<string, unknown>>) ?? {};
  const operations: ExtractedOperation[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const method of httpMethods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const extracted = extractOperation(method, path, operation, processedSpec, isV3);
      operations.push(extracted);
    }
  }

  const security_schemes = extractSecuritySchemes(processedSpec, isV3);

  return { title, version, description, base_url, operations, security_schemes, raw_json: processedSpec, is_postman: isPostman };
}
