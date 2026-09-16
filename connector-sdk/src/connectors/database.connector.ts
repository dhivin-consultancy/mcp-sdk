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

export interface DatabaseConnectorConfig extends ConnectorConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

/**
 * Abstract base class for SQL and NoSQL database MCP connectors.
 */
export abstract class DatabaseConnector extends BaseConnector {
  public readonly type = 'database' as const;

  protected dbConfig: DatabaseConnectorConfig = {};

  public override async init(config: DatabaseConnectorConfig): Promise<void> {
    await super.init(config);
    this.dbConfig = { ...config };
    await this.connect();
  }

  /** Establish connection to the database */
  protected abstract connect(): Promise<void>;

  /** Terminate connection */
  public abstract disconnect(): Promise<void>;

  /** Execute a query or command against the database */
  public abstract query(sqlOrCommand: string, params?: unknown[]): Promise<unknown>;

  /** Inspect database schema / collections */
  public abstract describeSchema(): Promise<Record<string, unknown>>;

  public async listTools(): Promise<MCPToolDefinition[]> {
    this.ensureInitialized();
    return [
      {
        name: `${this.id}_query`,
        description: `Execute a read-only query on database ${this.name}`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The query statement to execute',
            },
            params: {
              type: 'array',
              description: 'Optional query parameters',
              items: { type: 'string' },
            },
          },
          required: ['query'],
        },
        category: 'database',
        tags: ['database', 'query', this.id],
        isDangerous: false,
      },
      {
        name: `${this.id}_describe_schema`,
        description: `Retrieve table or collection schemas from database ${this.name}`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
        category: 'database',
        tags: ['database', 'schema', this.id],
        isDangerous: false,
      },
    ];
  }

  public async executeTool(
    request: ToolExecutionRequest,
    _credentials?: ResolvedAuthCredentials
  ): Promise<ToolExecutionResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    try {
      if (request.toolName === `${this.id}_query`) {
        const queryStr = request.arguments['query'] as string;
        const params = (request.arguments['params'] as unknown[]) || [];
        const result = await this.query(queryStr, params);
        return {
          success: true,
          data: result,
          metadata: { durationMs: Date.now() - startTime },
        };
      }

      if (request.toolName === `${this.id}_describe_schema`) {
        const schema = await this.describeSchema();
        return {
          success: true,
          data: schema,
          metadata: { durationMs: Date.now() - startTime },
        };
      }

      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Unknown database tool: ${request.toolName}`,
        },
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      return {
        success: false,
        error: {
          code: 'DATABASE_QUERY_ERROR',
          message: errorObj.message || 'Database execution error',
          details: err,
        },
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  public getManifest(): ConnectorManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      description: `Database connector for ${this.name}`,
      type: this.type,
      supportedAuthTypes: ['basic', 'custom_header', 'none'],
      defaultConfig: {
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        database: this.dbConfig.database,
      },
    };
  }
}
