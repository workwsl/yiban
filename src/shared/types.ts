export type TranslationStatus =
  | 'idle'
  | 'scanning'
  | 'translating'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'failed';

export type DisplayMode = 'bilingual' | 'translation_only' | 'hover';

export type PromptProfileId = string;

export interface StylePromptOverride {
  systemPrompt?: string;
  userPromptTemplate?: string;
}

/** @deprecated Use PromptLibrary instead */
export interface PromptOverrides {
  general?: StylePromptOverride;
  technical?: StylePromptOverride;
}

export interface CustomPromptProfile {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  createdAt: number;
}

export interface PromptLibrary {
  customProfiles: CustomPromptProfile[];
  overrides: Record<string, StylePromptOverride>;
}

export interface ResolvedPromptProfile {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  isBuiltIn: boolean;
}

export type ModelProvider = 'deepseek' | 'qwen' | 'openai-compatible';

export interface UserSettings {
  defaultTargetLanguage: string;
  defaultModelId: string | null;
  displayMode: DisplayMode;
  promptProfileId: PromptProfileId;
  cacheEnabled: boolean;
  autoTranslate: boolean;
  selectionTranslateEnabled: boolean;
}

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  timeoutMs: number;
  maxConcurrency: number;
  maxCharsPerRequest: number;
}

export interface SiteRule {
  domain: string;
  rule: 'never_translate';
}

export interface ModelTestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface TranslateTextRequest {
  text: string;
  targetLanguage: string;
  modelId: string | null;
  promptProfileId?: PromptProfileId;
  promptLibrary?: PromptLibrary;
}

export interface TranslateTextResponse {
  text: string;
  modelId?: string;
}

export interface TranslationSegment {
  id: string;
  text: string;
}

export interface TranslationResult {
  id: string;
  sourceText: string;
  translatedText: string;
}

export interface PageTranslationState {
  status: TranslationStatus;
  total: number;
  completed: number;
  failed: number;
  updatedAt: number;
  errorMessage?: string;
}

export interface ExtensionError {
  code: string;
  message: string;
  retryable: boolean;
}
