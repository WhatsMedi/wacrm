export type WhatsMediId = string & { readonly __brand: 'WhatsMediId' }

export function createWhatsMediId(value: string): WhatsMediId {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error('WhatsMediId cannot be empty')
  }

  return normalized as WhatsMediId
}
