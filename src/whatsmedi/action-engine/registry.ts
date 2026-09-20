import type {
  HealthcareActionType,
} from './types'

export interface HealthcareActionExecutor {
  readonly actionType: HealthcareActionType
  execute(
    request: import('./types').HealthcareActionRequest,
  ): Promise<import('./types').HealthcareActionResult>
}

export interface HealthcareActionRegistry {
  register(executor: HealthcareActionExecutor): void
  get(actionType: HealthcareActionType): HealthcareActionExecutor | null
  list(): readonly HealthcareActionExecutor[]
}

export class InMemoryHealthcareActionRegistry
  implements HealthcareActionRegistry
{
  private readonly executors = new Map<
    HealthcareActionType,
    HealthcareActionExecutor
  >()

  register(executor: HealthcareActionExecutor): void {
    this.executors.set(executor.actionType, executor)
  }

  get(
    actionType: HealthcareActionType,
  ): HealthcareActionExecutor | null {
    return this.executors.get(actionType) ?? null
  }

  list(): readonly HealthcareActionExecutor[] {
    return [...this.executors.values()]
  }
}
