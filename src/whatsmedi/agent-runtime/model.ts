export interface AgentModelRequest {
  systemPrompt: string
  userMessage: string
}

export interface AgentModelResponse {
  text: string
}

export interface AgentModel {
  generate(request: AgentModelRequest): Promise<AgentModelResponse>
}
