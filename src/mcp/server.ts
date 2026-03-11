import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListResourceTemplatesRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import type { AgentConfig } from '../config/schema.js';
import { createMcpHandlers } from './handlers.js';
import { McpResourceManager } from './resources.js';
import { McpPromptManager } from './prompts.js';
import type { McpServerOptions } from './types.js';

/**
 * MCP Server — exposes agent tools to editors like Cursor, Windsurf, etc.
 * Uses the same policy engine as CLI, logs which client initiated actions.
 */
export async function startMcpServer(
    config: AgentConfig,
    options: McpServerOptions
): Promise<void> {
    const server = new Server(
        {
            name: 'agent-runtime',
            version: '0.1.0',
        },
        {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
            },
        }
    );

    const handlers = await createMcpHandlers(config);

    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: handlers.getToolDefinitions(),
        };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        return handlers.handleToolCall(name, args ?? {});
    });

    // ─── Resources ───
    const resourceManager = new McpResourceManager();

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
        return {
            resourceTemplates: await resourceManager.getResourceTemplates()
        };
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: await resourceManager.listResources()
        };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        return await resourceManager.readResource(request.params.uri);
    });

    // ─── Prompts ───
    const promptManager = new McpPromptManager(config);
    await promptManager.init();

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: promptManager.getPrompts()
        };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        return await promptManager.getPrompt(request.params.name, request.params.arguments as any);
    });

    if (options.mode === 'stdio') {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    } else if (options.mode === 'http') {
        const app = express();
        const port = options.port || 3001;

        // Disable body-parser for SSE incoming messages, as SSE transport handles the body stream
        let transport: SSEServerTransport;

        app.get('/sse', async (_req, res) => {
            transport = new SSEServerTransport('/message', res);
            await server.connect(transport);
        });

        app.post('/message', async (req, res) => {
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(503).send('SSE not initialized');
            }
        });

        app.listen(port, () => {
            console.log(`[MCP] HTTP Server running on http://localhost:${port}/sse`);
        });
    }
}
