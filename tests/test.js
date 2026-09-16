const assert = require('assert');
const {
  parseOpenApiSpec,
  OpenApiConnector,
  CustomConnector,
  runConnectorTests,
} = require('@mcp-platform/connector-sdk');

async function runTests() {
  console.log('🧪 Running MCP Public Test Suite...\n');

  // Test 1: OpenAPI spec parsing & tool extraction
  console.log('1. Testing OpenAPI Parser & Security Extraction...');
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Order Service', version: '2.1.0', description: 'Enterprise Orders API' },
    servers: [{ url: 'https://orders.internal.net/v2' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-KEY' },
      },
    },
    paths: {
      '/orders/{orderId}': {
        get: {
          operationId: 'getOrderDetails',
          summary: 'Retrieve single order by ID',
          parameters: [
            { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Order found',
              content: { 'application/json': { schema: { type: 'object' } } }
            }
          }
        }
      }
    }
  };

  const parsed = await parseOpenApiSpec(spec);
  assert.strictEqual(parsed.title, 'Order Service');
  assert.strictEqual(parsed.operations.length, 1);
  assert.strictEqual(parsed.operations[0].tool_name, 'getOrderDetails');
  assert.strictEqual(parsed.security_schemes.length, 2);
  console.log('   ✅ OpenAPI spec parsed and security schemes mapped correctly');

  // Test 2: OpenApiConnector lifecycle & tools
  console.log('2. Testing OpenApiConnector...');
  const apiConnector = new OpenApiConnector({
    id: 'orders-connector',
    name: 'Orders API Connector',
    spec,
  });

  await apiConnector.init();
  const tools = await apiConnector.listTools();
  assert.strictEqual(tools.length, 1);
  assert.strictEqual(tools[0].name, 'getOrderDetails');
  assert.strictEqual(tools[0].inputSchema.type, 'object');
  assert(tools[0].inputSchema.properties.orderId !== undefined);
  console.log('   ✅ OpenApiConnector initialized and exported MCP tools');

  // Test 3: CustomConnector registration & tool execution
  console.log('3. Testing CustomConnector...');
  const customConnector = new CustomConnector({
    id: 'text-processor',
    name: 'Text Utility Connector',
  });

  customConnector.registerTool(
    {
      name: 'uppercaseText',
      description: 'Convert string to uppercase',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    async (args) => {
      return { uppercased: String(args.text).toUpperCase() };
    }
  );

  await customConnector.init();
  const execResult = await customConnector.executeTool({
    toolName: 'uppercaseText',
    arguments: { text: 'hello mcp' },
  });

  assert.strictEqual(execResult.success, true);
  assert.deepStrictEqual(execResult.data, { uppercased: 'HELLO MCP' });
  console.log('   ✅ CustomConnector tool registered and executed cleanly');

  // Test 4: Harness test runner
  console.log('4. Testing Test Harness (runConnectorTests)...');
  const report = await runConnectorTests(customConnector);
  assert.strictEqual(report.failed, 0);
  assert.strictEqual(report.passed, report.totalTests);
  console.log(`   ✅ Test runner completed: ${report.passed}/${report.totalTests} tests passed`);

  console.log('\n🎉 All public contract and SDK unit tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
