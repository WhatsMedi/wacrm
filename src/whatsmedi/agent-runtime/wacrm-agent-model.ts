import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAiConfig } from '@/lib/ai/config';
import { generateReply } from '@/lib/ai/generate';
import type {
  AgentModel,
  AgentModelRequest,
  AgentModelResponse,
} from './model';

export class WacrmAgentModel implements AgentModel {
  constructor(
    private readonly db: SupabaseClient,
    private readonly accountId: string
  ) {}

  async generate(request: AgentModelRequest): Promise<AgentModelResponse> {
    const config = await loadAiConfig(this.db, this.accountId);

    if (!config) {
      throw new Error(
        `AI configuration is unavailable for account ${this.accountId}`
      );
    }

    const result = await generateReply({
      config,
      systemPrompt: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: request.userMessage,
        },
      ],
    });

    return {
      text: result.text,
    };
  }
}
