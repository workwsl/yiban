import type { ModelConfig } from './types';

export function findModel(models: ModelConfig[], modelId: string | null): ModelConfig | null {
  if (modelId) {
    return models.find((model) => model.id === modelId) ?? null;
  }

  return models.find((model) => model.enabled && model.apiKey.trim()) ?? models[0] ?? null;
}
