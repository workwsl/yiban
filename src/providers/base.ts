import type { ModelConfig, ModelTestResult, TranslateTextRequest, TranslateTextResponse } from '../shared/types';

export interface TranslationProvider {
  translateText(request: TranslateTextRequest, config: ModelConfig): Promise<TranslateTextResponse>;
  testConnection(config: ModelConfig): Promise<ModelTestResult>;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
