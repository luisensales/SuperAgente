export interface Tool {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (args: any) => Promise<string> | string;
}

const toolsRegistry: Record<string, Tool> = {};

export function registerTool(tool: Tool) {
    toolsRegistry[tool.name] = tool;
}

export function getTool(name: string): Tool | undefined {
    return toolsRegistry[name];
}

export function getAllTools(): Tool[] {
    return Object.values(toolsRegistry);
}

// Convert tools to the format expected by OpenAI / Groq
export function getToolsForLLM() {
    return getAllTools().map(tool => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }
    }));
}
