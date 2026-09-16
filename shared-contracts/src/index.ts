/**
 * @mcp-platform/shared-contracts
 * Centralized contracts, interfaces, and protocol definitions for the MCP Platform.
 */

export type MCPToolCategory =
  | 'database'
  | 'rest_api'
  | 'analytics'
  | 'filesystem'
  | 'messaging'
  | 'automation'
  | 'custom';

export interface JSONSchemaDefinition {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JSONSchemaDefinition>;
  required?: string[];
  items?: JSONSchemaDefinition | JSONSchemaDefinition[];
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  additionalProperties?: boolean | JSONSchemaDefinition;
  [key: string]: unknown;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchemaDefinition;
  outputSchema?: JSONSchemaDefinition;
  category?: MCPToolCategory | string;
  tags?: string[];
  isDangerous?: boolean;
}

export type ConnectorType =
  | 'api'
  | 'database'
  | 'custom'
  | 'saas'
  | 'file'
  | 'stream';

export type ConnectorAuthType =
  | 'none'
  | 'bearer'
  | 'api_key'
  | 'basic'
  | 'oauth2_client'
  | 'oauth2_password'
  | 'custom_header';

export interface ConnectorAuthConfig {
  type: ConnectorAuthType;
  in?: 'header' | 'query' | 'cookie';
  parameterName?: string;
  tokenUrl?: string;
  scopes?: string;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  type: ConnectorType;
  author?: string;
  homepage?: string;
  supportedAuthTypes: ConnectorAuthType[];
  defaultConfig?: Record<string, unknown>;
}

export interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  context?: {
    userId?: string;
    organizationId?: string;
    requestId?: string;
    timestamp?: string;
  };
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    durationMs?: number;
    cached?: boolean;
    rawStatusCode?: number;
  };
}

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}
