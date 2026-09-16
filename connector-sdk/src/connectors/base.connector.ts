import {
  IConnector,
  ConnectorConfig,
  ConnectorManifest,
  ConnectionTestResult,
  ConnectorCategory,
} from '../types/connector';
import { ResolvedAuthCredentials } from '../types/auth';
import {
  MCPToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
} from '../types/tool';

/**
 * Base abstract class implementing standard lifecycle for MCP connectors.
 */
export abstract class BaseConnector implements IConnector {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly type: ConnectorCategory;

  protected config: ConnectorConfig = {};
  protected initialized: boolean = false;

  public async init(config: ConnectorConfig): Promise<void> {
    this.config = { ...config };
    this.initialized = true;
  }

  public abstract testConnection(credentials?: ResolvedAuthCredentials): Promise<ConnectionTestResult>;

  public abstract listTools(): Promise<MCPToolDefinition[]>;

  public async getTool(toolName: string): Promise<MCPToolDefinition | undefined> {
    const tools = await this.listTools();
    return tools.find(t => t.name === toolName);
  }

  public abstract executeTool(
    request: ToolExecutionRequest,
    credentials?: ResolvedAuthCredentials
  ): Promise<ToolExecutionResult>;

  public abstract getManifest(): ConnectorManifest;

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Connector '${this.id}' is not initialized. Call init() first.`);
    }
  }
}
