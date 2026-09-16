import { BaseConnector } from './base.connector';
import {
  ConnectorConfig,
  ConnectorManifest,
  ConnectionTestResult,
  ConnectorCategory,
} from '../types/connector';
import { ResolvedAuthCredentials, ConnectorAuthType } from '../types/auth';
import {
  MCPToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolHandler,
} from '../types/tool';

export interface CustomConnectorOptions {
  id: string;
  name: string;
  version?: string;
  description?: string;
  type?: ConnectorCategory;
  supportedAuthTypes?: ConnectorAuthType[];
  testHandler?: (credentials?: ResolvedAuthCredentials) => Promise<ConnectionTestResult>;
}

/**
 * Flexible connector class for developers building custom or composite MCP integrations.
 */
export class CustomConnector extends BaseConnector {
  public readonly id: string;
  public readonly name: string;
  public readonly type: ConnectorCategory;

  private version: string;
  private description: string;
  private supportedAuthTypes: ConnectorAuthType[];
  private tools: Map<string, { tool: MCPToolDefinition; handler: ToolHandler }> = new Map();
  private customTestHandler?: (credentials?: ResolvedAuthCredentials) => Promise<ConnectionTestResult>;

  constructor(options: CustomConnectorOptions) {
    super();
    this.id = options.id;
    this.name = options.name;
    this.version = options.version || '1.0.0';
    this.description = options.description || `Custom connector: ${options.name}`;
    this.type = options.type || 'custom';
    this.supportedAuthTypes = options.supportedAuthTypes || ['none'];
    this.customTestHandler = options.testHandler;
  }

  /**
   * Register an MCP tool and its execution handler.
   */
  public registerTool(tool: MCPToolDefinition, handler: ToolHandler): this {
    this.tools.set(tool.name, { tool, handler });
    return this;
  }

  public override async init(config: ConnectorConfig = {}): Promise<void> {
    await super.init(config);
  }

  public async listTools(): Promise<MCPToolDefinition[]> {
    this.ensureInitialized();
    return Array.from(this.tools.values()).map(entry => entry.tool);
  }

  public async executeTool(
    request: ToolExecutionRequest,
    _credentials?: ResolvedAuthCredentials
  ): Promise<ToolExecutionResult> {
    this.ensureInitialized();

    const entry = this.tools.get(request.toolName);
    if (!entry) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${request.toolName}' was not found in connector '${this.id}'`,
        },
      };
    }

    const startTime = Date.now();
    try {
      const data = await entry.handler(request.arguments, request.context);
      return {
        success: true,
        data,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      return {
        success: false,
        error: {
          code: 'HANDLER_ERROR',
          message: errorObj.message || 'Error executing tool handler',
          details: err,
        },
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  public async testConnection(credentials?: ResolvedAuthCredentials): Promise<ConnectionTestResult> {
    this.ensureInitialized();
    if (this.customTestHandler) {
      return this.customTestHandler(credentials);
    }
    return {
      ok: true,
      message: `Connector '${this.id}' is configured and ready with ${this.tools.size} registered tools`,
    };
  }

  public getManifest(): ConnectorManifest {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      type: this.type,
      supportedAuthTypes: this.supportedAuthTypes,
    };
  }
}
