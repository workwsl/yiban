import type { ModelConfig } from '../shared/types';

const MODELS_KEY = 'yiban.models';

export const DEFAULT_MODEL_TEMPLATES: ModelConfig[] = [
  {
    id: 'deepseek-default',
    provider: 'deepseek',
    name: 'DeepSeek Chat',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
    enabled: true,
    timeoutMs: 30000,
    maxConcurrency: 3,
    maxCharsPerRequest: 3000,
  },
  {
    id: 'qwen-default',
    provider: 'qwen',
    name: 'Qwen Plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus',
    enabled: true,
    timeoutMs: 30000,
    maxConcurrency: 3,
    maxCharsPerRequest: 3000,
  },
];

export async function getModels(): Promise<ModelConfig[]> {
  const result = await chrome.storage.local.get(MODELS_KEY);
  const stored = result[MODELS_KEY] as ModelConfig[] | undefined;
  return stored?.length ? stored : DEFAULT_MODEL_TEMPLATES;
}

export async function saveModel(model: ModelConfig): Promise<ModelConfig[]> {
  const models = await getModels();
  const nextModels = models.some((item) => item.id === model.id)
    ? models.map((item) => (item.id === model.id ? model : item))
    : [...models, model];

  await chrome.storage.local.set({ [MODELS_KEY]: nextModels });
  return nextModels;
}

export async function deleteModel(modelId: string): Promise<ModelConfig[]> {
  const models = await getModels();
  const nextModels = models.filter((model) => model.id !== modelId);
  await chrome.storage.local.set({ [MODELS_KEY]: nextModels });
  return nextModels;
}
