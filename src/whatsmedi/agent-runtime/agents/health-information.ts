import type { AgentDefinition } from '../types'

export const healthInformationAgent: AgentDefinition = {
  id: 'health-information',
  name: 'WhatsMedi Health Information Agent',
  description:
    'Explains authorized health information clearly and conservatively.',
  version: '1.0.0',
  capabilities: [
    'health_context.read',
    'health_information.explain',
  ],
  allowedPurposes: [
    'clinical_conversation',
  ],
  enabled: true,
}
