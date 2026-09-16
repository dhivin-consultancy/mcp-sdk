import { ConnectorAuthType, DetectedSecurityScheme } from '../types/auth';

/**
 * Extract all securitySchemes from an OAS2/OAS3 spec and normalize
 * them into standard ConnectorAuth types.
 */
export function extractSecuritySchemes(
  spec: Record<string, unknown>,
  isV3: boolean
): DetectedSecurityScheme[] {
  const schemes: DetectedSecurityScheme[] = [];

  // OAS3: components.securitySchemes
  // OAS2: securityDefinitions
  const raw = isV3
    ? ((spec.components as Record<string, unknown>)?.securitySchemes as Record<string, Record<string, unknown>> | undefined)
    : (spec.securityDefinitions as Record<string, Record<string, unknown>> | undefined);

  if (!raw) return schemes;

  for (const [name, scheme] of Object.entries(raw)) {
    const type = (scheme.type as string) ?? '';
    const schemeStr = (scheme.scheme as string | undefined)?.toLowerCase();
    const detected = mapAuthType(type, schemeStr);

    const entry: DetectedSecurityScheme = {
      name,
      type: detected,
      description: (scheme.description as string) ?? undefined,
    };

    // api_key specifics
    if (detected === 'api_key') {
      entry.in = (scheme.in as 'header' | 'query' | 'cookie') ?? 'header';
      entry.parameter_name = (scheme.name as string) ?? 'X-API-Key';
    }

    // oauth2 specifics
    if (detected === 'oauth2_client' || detected === 'oauth2_password') {
      if (isV3) {
        const flows = scheme.flows as Record<string, Record<string, unknown>> | undefined;
        const flow = flows?.clientCredentials ?? flows?.password ?? flows?.authorizationCode;
        entry.token_url = (flow?.tokenUrl as string) ?? undefined;
        const scopeMap = (flow?.scopes as Record<string, string>) ?? {};
        entry.scopes = Object.keys(scopeMap).join(' ') || undefined;
      } else {
        entry.token_url = (scheme.tokenUrl as string) ?? undefined;
      }
    }

    // custom_header
    if (detected === 'custom_header') {
      entry.parameter_name = (scheme.name as string) ?? 'X-Custom-Auth';
    }

    schemes.push(entry);
  }

  return schemes;
}

/**
 * Map OAS type strings to ConnectorAuthType.
 */
export function mapAuthType(type: string, scheme?: string): ConnectorAuthType {
  if (type === 'http') {
    if (scheme === 'bearer') return 'bearer';
    if (scheme === 'basic') return 'basic';
    return 'bearer';
  }
  if (type === 'apiKey') return 'api_key';
  if (type === 'oauth2') return 'oauth2_client';
  if (type === 'openIdConnect') return 'oauth2_client';
  return 'none';
}
