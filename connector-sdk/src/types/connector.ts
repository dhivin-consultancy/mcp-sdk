import { ConnectorAuthConfig, ConnectorAuthType, ResolvedAuthCredentials } from './auth';
import { MCPToolDefinition, ToolExecutionRequest, ToolExecutionResult } from './tool';

export type ConnectorCategory =
  | 'api'
  | 'database'
  | 'custom'
  | 'saas'
  | 'file'
  | 'stream';

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  type: ConnectorCategory;
  author?: string;
  homepage?: string;
  supportedAuthTypes: ConnectorAuthType[];
  defaultConfig?: Record<string, unknown>;
}

export interface ConnectorConfig {
  id?: string;
  name?: string;
  baseUrl?: string;
  auth?: ConnectorAuthConfig;
  options?: Record<string, unknown>;
}

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Standard interface that all MCP connectors must implement.
 */
export interface IConnector {
  /** Connector identifier */
  readonly id: string;
  /** Connector human readable name */
  readonly name: string;
  /** Connector type */
  readonly type: ConnectorCategory;

  /** Initialize or configure connector */
  init(config: ConnectorConfig): Promise<void>;

  /** Test if the connector can reach its target service */
  testConnection(credentials?: ResolvedAuthCredentials): Promise<ConnectionTestResult>;

  /** List all MCP tools exposed by this connector */
  listTools(): Promise<MCPToolDefinition[]>;

  /** Get definition for a single tool by name */
  getTool(toolName: string): Promise<MCPToolDefinition | undefined>;

  /** Execute a tool by name with arguments and optional credentials */
  executeTool(
    request: ToolExecutionRequest,
    credentials?: ResolvedAuthCredentials
  ): Promise<ToolExecutionResult>;

  /** Retrieve connector manifest */
  getManifest(): ConnectorManifest;
}
