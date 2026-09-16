import { BaseConnector } from './base.connector';
import {
  ConnectorConfig,
  ConnectorManifest,
  ConnectionTestResult,
} from '../types/connector';
import { ResolvedAuthCredentials } from '../types/auth';
import {
  MCPToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
} from '../types/tool';
import { ExtractedOperation, ParsedSpec } from '../types/openapi';
import { parseOpenApiSpec } from '../openapi/parser';
import { operationToMcpTool } from '../openapi/generator';
import { executeOpenApiOperation } from '../openapi/executor';

export interface OpenApiConnectorOptions {
  id: string;
  name: string;
  spec: string | Record<string, unknown>;
  baseUrl?: string;
  version?: string;
  description?: string;
}

/**
 * Production-ready MCP connector powered by an OpenAPI specification.
 * Automatically extracts operations, converts them to MCP tools, and handles HTTP execution.
 */
export class OpenApiConnector extends BaseConnector {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'api' as const;

  private specSource: string | Record<string, unknown>;
  private parsedSpec: ParsedSpec | null = null;
  private toolsMap: Map<string, { tool: MCPToolDefinition; operation: ExtractedOperation }> = new Map();
  private baseUrl: string = '';
  private version: string = '1.0.0';
  private description: string = '';

  constructor(options: OpenApiConnectorOptions) {
    super();
    this.id = options.id;
    this.name = options.name;
    this.specSource = options.spec;
    this.baseUrl = options.baseUrl || '';
    this.version = options.version || '1.0.0';
    this.description = options.description || '';
  }

  public override async init(config: ConnectorConfig = {}): Promise<void> {
    await super.init(config);

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }

    // Parse the spec and populate tools
    this.parsedSpec = await parseOpenApiSpec(this.specSource);

    if (!this.baseUrl && this.parsedSpec.base_url) {
      this.baseUrl = this.parsedSpec.base_url;
    }

    if (!this.description && this.parsedSpec.description) {
      this.description = this.parsedSpec.description;
    }

    // Map extracted operations
    this.toolsMap.clear();
    for (const op of this.parsedSpec.operations) {
      const tool = operationToMcpTool(op);
      this.toolsMap.set(tool.name, { tool, operation: op });
    }
  }

  public async listTools(): Promise<MCPToolDefinition[]> {
    this.ensureInitialized();
    return Array.from(this.toolsMap.values()).map(entry => entry.tool);
  }

  public async executeTool(
    request: ToolExecutionRequest,
    credentials?: ResolvedAuthCredentials
  ): Promise<ToolExecutionResult> {
    this.ensureInitialized();

    const entry = this.toolsMap.get(request.toolName);
    if (!entry) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${request.toolName}' was not found in connector '${this.id}'`,
        },
      };
    }

    return executeOpenApiOperation(entry.operation, request.arguments, {
      baseUrl: this.baseUrl,
      authConfig: this.config.auth,
      credentials,
    });
  }

  public async testConnection(credentials?: ResolvedAuthCredentials): Promise<ConnectionTestResult> {
    this.ensureInitialized();

    if (!this.baseUrl) {
      return {
        ok: false,
        message: 'Base URL is not defined for this OpenAPI connector',
      };
    }

    const startTime = Date.now();
    try {
      // Find a safe GET endpoint or ping the base URL
      const getOp = this.parsedSpec?.operations.find(
        op => op.method.toLowerCase() === 'get' && !op.path.includes('{')
      );

      const targetPath = getOp ? getOp.path : '/';
      const targetUrl = this.baseUrl.endsWith('/')
        ? `${this.baseUrl.slice(0, -1)}${targetPath}`
        : `${this.baseUrl}${targetPath}`;

      const headers: Record<string, string> = {};
      if (credentials?.type === 'bearer' && credentials.token) {
        headers['Authorization'] = `Bearer ${credentials.token}`;
      }

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - startTime;
      return {
        ok: res.status < 500,
        latencyMs,
        message: `HTTP ${res.status} response from ${targetUrl}`,
        details: { statusCode: res.status },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        message: (err as Error).message || 'Failed to connect to API target',
      };
    }
  }

  public getManifest(): ConnectorManifest {
    const authSchemes = this.parsedSpec?.security_schemes.map(s => s.type) || [];
    const supportedAuth = authSchemes.length > 0 ? authSchemes : (['none', 'bearer', 'api_key'] as const);

    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description || `OpenAPI connector for ${this.name}`,
      type: this.type,
      supportedAuthTypes: Array.from(new Set(supportedAuth)),
      defaultConfig: {
        baseUrl: this.baseUrl,
      },
    };
  }

  public getParsedSpec(): ParsedSpec | null {
    return this.parsedSpec;
  }
}
