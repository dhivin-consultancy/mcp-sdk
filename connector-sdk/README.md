# @mcp-platform/connector-sdk

Official open-source SDK for building Model Context Protocol (MCP) connectors, converting OpenAPI specifications into MCP AI tools, and managing enterprise authentication.

---

## 🚀 Overview

The **MCP Connector SDK** provides the framework and runtime engine to build, test, and package MCP connectors that bridge Large Language Models (LLMs) with:
- **REST APIs** (via OpenAPI 2.0 / 3.x specifications)
- **Databases** (PostgreSQL, MySQL, MongoDB, etc.)
- **Custom Services & SaaS Platforms** (custom handlers with bespoke authentication)

---

## 📦 Installation

```bash
npm install @mcp-platform/connector-sdk
```

---

## 🛠️ Quick Start

### 1. Build an OpenAPI-Powered Connector

Transform any OpenAPI 2.0 (Swagger) or 3.x document (URL, YAML, or JSON) into MCP tools automatically:

```typescript
import { OpenApiConnector } from '@mcp-platform/connector-sdk';

const connector = new OpenApiConnector({
  id: 'stripe-payments',
  name: 'Stripe Payments API',
  spec: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  baseUrl: 'https://api.stripe.com',
});

// Initialize and discover tools
await connector.init({
  auth: {
    type: 'bearer',
  },
});

// List extracted MCP tools
const tools = await connector.listTools();
console.log(`Discovered ${tools.length} MCP tools:`, tools.map(t => t.name));

// Execute a tool
const result = await connector.executeTool(
  {
    toolName: 'createCustomer',
    arguments: { email: 'alice@example.com', name: 'Alice' },
  },
  {
    type: 'bearer',
    token: process.env.STRIPE_API_KEY,
  }
);

console.log('Result:', result.data);
```

---

### 2. Build a Custom Connector

For custom integrations, use `CustomConnector`:

```typescript
import { CustomConnector } from '@mcp-platform/connector-sdk';

const connector = new CustomConnector({
  id: 'calculator-service',
  name: 'Math Calculator',
  version: '1.0.0',
});

// Register tool with JSON Schema input definition and execution handler
connector.registerTool(
  {
    name: 'calculateTax',
    description: 'Calculate sales tax for a given amount and jurisdiction',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Transaction amount in USD' },
        state: { type: 'string', description: '2-letter state code, e.g. CA, NY' },
      },
      required: ['amount', 'state'],
    },
  },
  async (args) => {
    const rate = args.state === 'CA' ? 0.0725 : 0.05;
    return {
      amount: args.amount,
      tax: Number(args.amount) * rate,
      effectiveRate: rate,
    };
  }
);

await connector.init();
```

---

### 3. Build a Database Connector

Extend `DatabaseConnector` for relational or document databases:

```typescript
import { DatabaseConnector, DatabaseConnectorConfig } from '@mcp-platform/connector-sdk';

export class PostgresConnector extends DatabaseConnector {
  public readonly id = 'postgres-connector';
  public readonly name = 'PostgreSQL Connector';

  protected async connect(): Promise<void> {
    // initialize pg Pool or client
  }

  public async disconnect(): Promise<void> {
    // drain pool
  }

  public async query(sql: string, params: unknown[] = []): Promise<unknown> {
    // execute parameterized query safely
    return [{ id: 1, name: 'Sample' }];
  }

  public async describeSchema(): Promise<Record<string, unknown>> {
    // return table columns and types
    return { users: { id: 'uuid', email: 'varchar' } };
  }
}
```

---

## 🔐 Supported Authentication Types

The SDK includes runtime authentication injection for:

| Auth Type | Description | Credentials Object |
|---|---|---|
| `bearer` | HTTP Bearer token in `Authorization: Bearer <token>` | `{ type: 'bearer', token: '...' }` |
| `api_key` | Custom header, query parameter, or cookie | `{ type: 'api_key', api_key: '...', parameter_name: 'X-API-Key', in: 'header' }` |
| `basic` | Standard HTTP Basic Authentication | `{ type: 'basic', username: '...', password: '...' }` |
| `oauth2_client` | OAuth2 Client Credentials flow | `{ type: 'oauth2_client', token: '...' }` |
| `custom_header` | Arbitrary custom header injection | `{ type: 'custom_header', header_name: 'X-Tenant', header_value: '...' }` |
| `none` | Public unauthenticated access | `{ type: 'none' }` |

---

## 🧪 Testing Your Connector

The SDK includes a built-in compliance test runner:

```typescript
import { runConnectorTests } from '@mcp-platform/connector-sdk';

const report = await runConnectorTests(connector, {
  credentials: { type: 'bearer', token: 'test-token' },
  sampleExecution: {
    toolName: 'listCustomers',
    arguments: { limit: 5 },
  },
});

console.log(`Passed: ${report.passed}/${report.totalTests}`);
```

---

## 📄 License

Apache-2.0
