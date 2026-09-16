/**
 * Authentication types and credential definitions for MCP connectors.
 */

export type ConnectorAuthType =
  | 'none'
  | 'bearer'            // Authorization: Bearer <token>
  | 'api_key'           // Header, query param, or cookie
  | 'basic'             // Authorization: Basic base64(user:pass)
  | 'oauth2_client'     // OAuth2 Client Credentials
  | 'oauth2_password'   // OAuth2 Resource Owner Password
  | 'custom_header';    // Custom Header name + value

export interface ConnectorAuthConfig {
  type: ConnectorAuthType;
  in?: 'header' | 'query' | 'cookie';
  parameter_name?: string;
  token_url?: string;
  scopes?: string;
}

export interface DetectedSecurityScheme {
  name: string;
  type: ConnectorAuthType;
  description?: string;
  in?: 'header' | 'query' | 'cookie';
  parameter_name?: string;
  token_url?: string;
  scopes?: string;
}

/**
 * Resolved credentials passed at runtime to execute requests.
 * In a real environment, these are fetched from Google Secret Manager or a secure vault.
 */
export interface ResolvedAuthCredentials {
  type: ConnectorAuthType;
  /** Bearer token value */
  token?: string;
  /** API key value */
  api_key?: string;
  /** Basic auth username */
  username?: string;
  /** Basic auth password */
  password?: string;
  /** OAuth2 client id */
  client_id?: string;
  /** OAuth2 client secret */
  client_secret?: string;
  /** Custom header parameter name (if overriding config) */
  header_name?: string;
  /** Custom header value */
  header_value?: string;
  /** Location for api_key */
  in?: 'header' | 'query' | 'cookie';
  /** Parameter name for api_key */
  parameter_name?: string;
}
