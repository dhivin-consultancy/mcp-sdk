/**
 * MCP Tool definitions and execution contract types.
 */

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
  /** Unique tool identifier within this connector (e.g. 'getUserById') */
  name: string;
  /** Clear human/LLM description of tool capability */
  description: string;
  /** JSON Schema of arguments accepted by the tool */
  inputSchema: JSONSchemaDefinition;
  /** Optional JSON Schema of data returned by the tool */
  outputSchema?: JSONSchemaDefinition;
  /** Natural-language prompt or hint for AI planner */
  prompt?: string;
  /** Category or functional tag */
  category?: string;
  /** Search tags */
  tags?: string[];
  /** Mark if executing this tool causes side-effects (updates, deletes, writes) */
  isDangerous?: boolean;
  /** Original API operation ID if derived from OpenAPI */
  operationId?: string;
}

export interface ToolExecutionContext {
  userId?: string;
  organizationId?: string;
  connectorId?: string;
  requestId?: string;
  timestamp?: string;
}

export interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  context?: ToolExecutionContext;
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

export type ToolHandler = (
  args: Record<string, unknown>,
  context?: ToolExecutionContext
) => Promise<unknown>;
