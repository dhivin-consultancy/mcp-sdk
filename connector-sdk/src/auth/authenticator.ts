import { ConnectorAuthConfig, ResolvedAuthCredentials } from '../types/auth';

export interface RequestAuthHeaders {
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  cookie?: string;
}

/**
 * Apply resolved authentication credentials to HTTP headers and query params.
 */
export function applyAuth(
  headers: Record<string, string> = {},
  queryParams: Record<string, string> = {},
  credentials?: ResolvedAuthCredentials,
  authConfig?: ConnectorAuthConfig
): RequestAuthHeaders {
  const finalHeaders = { ...headers };
  const finalQueryParams = { ...queryParams };
  let cookieHeader: string | undefined;

  if (!credentials || credentials.type === 'none') {
    return { headers: finalHeaders, queryParams: finalQueryParams };
  }

  const authType = credentials.type;

  switch (authType) {
    case 'bearer': {
      const token = credentials.token || '';
      if (token) {
        finalHeaders['Authorization'] = `Bearer ${token}`;
      }
      break;
    }

    case 'basic': {
      const user = credentials.username || '';
      const pass = credentials.password || '';
      const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
      finalHeaders['Authorization'] = `Basic ${encoded}`;
      break;
    }

    case 'api_key': {
      const keyVal = credentials.api_key || '';
      const paramName =
        credentials.parameter_name ||
        authConfig?.parameter_name ||
        'X-API-Key';
      const location =
        credentials.in ||
        authConfig?.in ||
        'header';

      if (keyVal) {
        if (location === 'header') {
          finalHeaders[paramName] = keyVal;
        } else if (location === 'query') {
          finalQueryParams[paramName] = keyVal;
        } else if (location === 'cookie') {
          cookieHeader = `${paramName}=${encodeURIComponent(keyVal)}`;
          finalHeaders['Cookie'] = cookieHeader;
        }
      }
      break;
    }

    case 'custom_header': {
      const headerName =
        credentials.header_name ||
        credentials.parameter_name ||
        authConfig?.parameter_name ||
        'X-Custom-Auth';
      const headerValue = credentials.header_value || '';
      if (headerValue) {
        finalHeaders[headerName] = headerValue;
      }
      break;
    }

    case 'oauth2_client':
    case 'oauth2_password': {
      // In execution context, a pre-exchanged access token or raw token is provided in credentials.token
      const token = credentials.token || '';
      if (token) {
        finalHeaders['Authorization'] = `Bearer ${token}`;
      }
      break;
    }

    default:
      break;
  }

  return {
    headers: finalHeaders,
    queryParams: finalQueryParams,
    cookie: cookieHeader,
  };
}
