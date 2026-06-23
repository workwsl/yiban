import type { TranslationProvider } from './base';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { ModelConfig } from '../shared/types';

const openAICompatibleProvider = new OpenAICompatibleProvider();

export function getProvider(_config: ModelConfig): TranslationProvider {
  return openAICompatibleProvider;
}
