import { DetectedSecurityScheme } from './auth';

export interface ExtractedParam {
  name: string;
  in: 'query' | 'path' | 'header' | 'body' | 'cookie';
  required: boolean;
  type: string;
  description: string;
  example?: unknown;
  enum?: unknown[];
}

export interface ExtractedOperation {
  /** HTTP method: get, post, patch, delete etc. */
  method: string;
  /** Raw path: /customers/{customerId}/invoices */
  path: string;
  /** Suggested MCP tool name (camelCase): listCustomerInvoices */
  tool_name: string;
  /** Short human description */
  description: string;
  /** Tags / category from the spec */
  tags: string[];
  /** JSON Schema for MCP input */
  input_schema: Record<string, unknown>;
  /** JSON Schema for MCP output (from response schema) */
  output_schema: Record<string, unknown>;
  /** Natural-language prompt for the AI */
  prompt: string;
  /** Original operation ID if present */
  operation_id?: string;
}

export interface ParsedSpec {
  title: string;
  version: string;
  description: string;
  base_url: string;
  operations: ExtractedOperation[];
  security_schemes: DetectedSecurityScheme[];
  raw_json: Record<string, unknown>;
  is_postman?: boolean;
}
