import type { ToolDefinition, ToolMetadata, ToolResult, ExecutionContext } from './types.js';

/**
 * Global tool registry — all tools register here
 */
export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();
    private static instance: ToolRegistry;

    static getInstance(): ToolRegistry {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }

    /**
     * Register a tool definition
     */
    register(tool: ToolDefinition): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" is already registered`);
        }
        this.tools.set(tool.name, tool);
    }

    /**
     * Get a tool by name
     */
    get(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    /**
     * Check if a tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * List all registered tools
     */
    list(): ToolMetadata[] {
        return Array.from(this.tools.values()).map((t) => ({
            name: t.name,
            category: t.category,
            description: t.description,
            permissions: t.permissions,
        }));
    }

    /**
     * List tools by category
     */
    listByCategory(category: string): ToolMetadata[] {
        return this.list().filter((t) => t.category === category);
    }

    /**
     * Execute a tool with input validation and permission checks
     */
    async execute(
        name: string,
        input: unknown,
        ctx: ExecutionContext
    ): Promise<ToolResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                success: false,
                error: `Tool "${name}" not found`,
                durationMs: 0,
            };
        }

        // Validate input
        const parseResult = tool.inputSchema.safeParse(input);
        if (!parseResult.success) {
            return {
                success: false,
                error: `Invalid input for "${name}": ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
                durationMs: 0,
            };
        }

        // Check if tool is enabled in config
        const isEnabled = ctx.config.tools.enabled.some((pattern) => {
            if (pattern === name) return true;
            if (pattern.endsWith('.*')) {
                return name.startsWith(pattern.slice(0, -1));
            }
            return false;
        });

        if (!isEnabled) {
            return {
                success: false,
                error: `Tool "${name}" is not enabled in configuration`,
                durationMs: 0,
            };
        }

        // Execute with timeout
        const dataPrefix = parseResult.data as Record<string, unknown>;
        const timeout = (typeof dataPrefix.timeout === 'number' ? dataPrefix.timeout : undefined)
            ?? tool.timeout
            ?? ctx.config.tools.timeoutMs;

        const start = Date.now();

        try {
            const result = await Promise.race([
                tool.execute(parseResult.data, ctx),
                new Promise<ToolResult>((_, reject) =>
                    setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${timeout}ms`)), timeout)
                ),
            ]);
            return { ...result, durationMs: Date.now() - start };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - start,
            };
        }
    }

    /**
     * Check if a tool name matches a pattern (e.g., "fs.*")
     */
    matchesPattern(name: string, pattern: string): boolean {
        if (pattern === name) return true;
        if (pattern.endsWith('.*')) {
            return name.startsWith(pattern.slice(0, -1));
        }
        return false;
    }
}
