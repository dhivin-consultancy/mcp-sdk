import { ConnectorAuthConfig, ResolvedAuthCredentials } from '../types/auth';
import { ExtractedOperation } from '../types/openapi';
import { ToolExecutionResult } from '../types/tool';
import { applyAuth } from '../auth/authenticator';

export interface ExecuteOptions {
  baseUrl?: string;
  authConfig?: ConnectorAuthConfig;
  credentials?: ResolvedAuthCredentials;
  timeoutMs?: number;
}

/**
 * Execute an OpenAPI operation at runtime against the target API.
 */
export async function executeOpenApiOperation(
  operation: ExtractedOperation,
  args: Record<string, unknown> = {},
  options: ExecuteOptions = {}
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000;

  try {
    const rawBaseUrl = options.baseUrl || '';
    let finalPath = operation.path;
    const queryParams: Record<string, string> = {};
    const headerParams: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    const bodyPayload: Record<string, unknown> = {};

    // Detect path param names e.g. {id}
    const pathParamNames = new Set(
      [...operation.path.matchAll(/\{([^}]+)\}/g)].map(m => m[1])
    );

    // Distribute args to path, query, or body
    for (const [key, val] of Object.entries(args)) {
      if (val === undefined || val === null) continue;

      if (pathParamNames.has(key)) {
        finalPath = finalPath.replace(
          new RegExp(`\\{${key}\\}`, 'g'),
          encodeURIComponent(String(val))
        );
      } else if (['get', 'head', 'delete'].includes(operation.method.toLowerCase())) {
        queryParams[key] = String(val);
      } else {
        // For post/put/patch, put non-path args in the body unless specified otherwise
        bodyPayload[key] = val;
      }
    }

    // Apply authentication
    const authResult = applyAuth(
      headerParams,
      queryParams,
      options.credentials,
      options.authConfig
    );

    // Build URL
    let urlString = rawBaseUrl.endsWith('/') && finalPath.startsWith('/')
      ? `${rawBaseUrl.slice(0, -1)}${finalPath}`
      : `${rawBaseUrl}${finalPath}`;

    // Append query params
    const queryString = new URLSearchParams(authResult.queryParams).toString();
    if (queryString) {
      urlString += (urlString.includes('?') ? '&' : '?') + queryString;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const reqInit: RequestInit = {
      method: operation.method.toUpperCase(),
      headers: authResult.headers,
      signal: controller.signal,
    };

    if (
      !['get', 'head'].includes(operation.method.toLowerCase()) &&
      Object.keys(bodyPayload).length > 0
    ) {
      reqInit.body = JSON.stringify(bodyPayload);
    }

    const res = await fetch(urlString, reqInit);
    clearTimeout(timer);

    const durationMs = Date.now() - startTime;
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const responseData = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: `HTTP_${res.status}`,
          message: typeof responseData === 'string'
            ? responseData
            : (responseData as Record<string, string>)?.message || `Request failed with status ${res.status}`,
          details: responseData,
        },
        metadata: {
          durationMs,
          rawStatusCode: res.status,
        },
      };
    }

    return {
      success: true,
      data: responseData,
      metadata: {
        durationMs,
        rawStatusCode: res.status,
      },
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorObj = err as Error;
    return {
      success: false,
      error: {
        code: errorObj.name === 'AbortError' ? 'TIMEOUT' : 'EXECUTION_ERROR',
        message: errorObj.message || 'Error executing OpenAPI operation',
        details: err,
      },
      metadata: {
        durationMs,
      },
    };
  }
}
