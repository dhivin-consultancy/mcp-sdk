import { OpenApiConnector, OpenApiConnectorOptions } from '@mcp-platform/connector-sdk';

/**
 * Factory to create a ready-to-run Generic REST Connector from an OpenAPI specification.
 */
export function createGenericRestConnector(options: OpenApiConnectorOptions): OpenApiConnector {
  return new OpenApiConnector(options);
}

export * from '@mcp-platform/connector-sdk';
