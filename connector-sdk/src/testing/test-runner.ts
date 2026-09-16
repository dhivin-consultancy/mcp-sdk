import { IConnector } from '../types/connector';
import { ResolvedAuthCredentials } from '../types/auth';

export interface TestSuiteOptions {
  credentials?: ResolvedAuthCredentials;
  sampleExecution?: {
    toolName: string;
    arguments: Record<string, unknown>;
  };
}

export interface TestReport {
  connectorId: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: Array<{
    name: string;
    passed: boolean;
    durationMs: number;
    error?: string;
  }>;
}

/**
 * Test harness to validate connector compliance and behavior.
 */
export async function runConnectorTests(
  connector: IConnector,
  options: TestSuiteOptions = {}
): Promise<TestReport> {
  const results: TestReport['results'] = [];

  // Test 1: Check Manifest
  const t1Start = Date.now();
  try {
    const manifest = connector.getManifest();
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Manifest missing required fields: id, name, or version');
    }
    results.push({
      name: 'Manifest compliance',
      passed: true,
      durationMs: Date.now() - t1Start,
    });
  } catch (err: unknown) {
    results.push({
      name: 'Manifest compliance',
      passed: false,
      durationMs: Date.now() - t1Start,
      error: (err as Error).message,
    });
  }

  // Test 2: Connection test
  const t2Start = Date.now();
  try {
    const connResult = await connector.testConnection(options.credentials);
    results.push({
      name: 'Connection test',
      passed: connResult.ok,
      durationMs: Date.now() - t2Start,
      error: connResult.ok ? undefined : (connResult.message || 'Connection test returned false'),
    });
  } catch (err: unknown) {
    results.push({
      name: 'Connection test',
      passed: false,
      durationMs: Date.now() - t2Start,
      error: (err as Error).message,
    });
  }

  // Test 3: List tools
  const t3Start = Date.now();
  try {
    const tools = await connector.listTools();
    if (!Array.isArray(tools)) {
      throw new Error('listTools() must return an array');
    }
    for (const tool of tools) {
      if (!tool.name || !tool.inputSchema) {
        throw new Error(`Tool missing name or inputSchema: ${JSON.stringify(tool)}`);
      }
    }
    results.push({
      name: `List tools (${tools.length} discovered)`,
      passed: true,
      durationMs: Date.now() - t3Start,
    });
  } catch (err: unknown) {
    results.push({
      name: 'List tools',
      passed: false,
      durationMs: Date.now() - t3Start,
      error: (err as Error).message,
    });
  }

  // Test 4 (Optional): Sample execution
  if (options.sampleExecution) {
    const t4Start = Date.now();
    try {
      const res = await connector.executeTool({
        toolName: options.sampleExecution.toolName,
        arguments: options.sampleExecution.arguments,
      }, options.credentials);

      results.push({
        name: `Tool execution (${options.sampleExecution.toolName})`,
        passed: res.success,
        durationMs: Date.now() - t4Start,
        error: res.success ? undefined : res.error?.message,
      });
    } catch (err: unknown) {
      results.push({
        name: `Tool execution (${options.sampleExecution.toolName})`,
        passed: false,
        durationMs: Date.now() - t4Start,
        error: (err as Error).message,
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    connectorId: connector.id,
    totalTests: results.length,
    passed,
    failed,
    results,
  };
}
