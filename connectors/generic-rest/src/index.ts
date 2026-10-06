import { OpenApiConnector, OpenApiConnectorOptions } from '@hostmcp-dev/connector-sdk';

/**
 * Factory to create a ready-to-run Generic REST Connector from an OpenAPI specification.
 */
export function createGenericRestConnector(options: OpenApiConnectorOptions): OpenApiConnector {
  return new OpenApiConnector(options);
}

export * from '@hostmcp-dev/connector-sdk';
