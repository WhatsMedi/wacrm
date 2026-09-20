import type { HealthContext } from '../health-context/types'
import type { ToolDefinition } from './tool'

export type GetHealthContextInput = Record<string, never>

export const getHealthContextTool: ToolDefinition<
  GetHealthContextInput,
  HealthContext
> = {
  name: 'get_health_context',

  description:
    'Returns the already-authorized health context supplied by the Agent Runtime.',

  permission: {
    requiredCapabilities: ['health_context.read'],
  },

  async execute(_input, context) {
    if (!context.healthContext) {
      throw new Error(
        'Health context is unavailable for this tool execution',
      )
    }

    return context.healthContext
  },
}
