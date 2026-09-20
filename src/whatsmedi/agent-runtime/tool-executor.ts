import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolName,
} from './tool'
import type { ToolRegistry } from './tool-registry'

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async execute<TInput, TOutput>(
    toolName: ToolName,
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult<TOutput>> {
    const startedAt = this.now()
    const tool = this.registry.get(toolName)

    const auditBase = {
      correlationId: context.correlationId,
      toolName,
      agentId: context.agent.id,
      agentVersion: context.agent.version,
      accountId: context.accountId,
      personId: context.personId,
      purpose: context.purpose,
      startedAt,
    }

    if (!tool) {
      return {
        status: 'blocked',
        output: null,
        message: `Tool not found: ${toolName}`,
        audit: {
          ...auditBase,
          completedAt: this.now(),
        },
      }
    }

    const missingCapability =
      tool.permission.requiredCapabilities.find(
        (capability) =>
          !context.agent.capabilities.includes(capability),
      )

    if (missingCapability) {
      return {
        status: 'blocked',
        output: null,
        message: `Tool permission denied: missing capability ${missingCapability}`,
        audit: {
          ...auditBase,
          completedAt: this.now(),
        },
      }
    }

    if (
      tool.permission.allowedPurposes &&
      !tool.permission.allowedPurposes.includes(context.purpose)
    ) {
      return {
        status: 'blocked',
        output: null,
        message: 'Tool permission denied for this purpose',
        audit: {
          ...auditBase,
          completedAt: this.now(),
        },
      }
    }

    try {
      const output = (await tool.execute(
        input,
        context,
      )) as TOutput

      return {
        status: 'completed',
        output,
        message: null,
        audit: {
          ...auditBase,
          completedAt: this.now(),
        },
      }
    } catch (error) {
      return {
        status: 'failed',
        output: null,
        message:
          error instanceof Error
            ? error.message
            : 'Tool execution failed',
        audit: {
          ...auditBase,
          completedAt: this.now(),
        },
      }
    }
  }
}
