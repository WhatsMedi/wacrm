import type {
  RegisteredTool,
  ToolDefinition,
  ToolName,
} from './tool'

export interface ToolRegistry {
  register<TInput, TOutput>(
    tool: ToolDefinition<TInput, TOutput>,
  ): void

  get(toolName: ToolName): RegisteredTool | null

  list(): readonly RegisteredTool[]
}

export class InMemoryToolRegistry implements ToolRegistry {
  private readonly tools = new Map<ToolName, RegisteredTool>()

  register<TInput, TOutput>(
    tool: ToolDefinition<TInput, TOutput>,
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }

    this.tools.set(
      tool.name,
      tool as unknown as RegisteredTool,
    )
  }

  get(toolName: ToolName): RegisteredTool | null {
    return this.tools.get(toolName) ?? null
  }

  list(): readonly RegisteredTool[] {
    return [...this.tools.values()]
  }
}
