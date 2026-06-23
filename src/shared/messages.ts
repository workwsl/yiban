import type {
  CustomPromptProfile,
  ModelConfig,
  ModelTestResult,
  PageTranslationState,
  PromptLibrary,
  ResolvedPromptProfile,
  SiteRule,
  TranslateTextRequest,
  TranslateTextResponse,
  UserSettings,
} from './types';

export type RuntimeMessage =
  | { type: 'PING'; source: 'popup' | 'options' | 'content' }
  | { type: 'SETTINGS_GET' }
  | { type: 'SETTINGS_SAVE'; settings: UserSettings }
  | { type: 'MODELS_GET' }
  | { type: 'MODEL_SAVE'; model: ModelConfig }
  | { type: 'MODEL_DELETE'; modelId: string }
  | { type: 'MODEL_TEST'; model: ModelConfig }
  | { type: 'SITE_RULES_GET' }
  | { type: 'SITE_RULES_SAVE'; rules: SiteRule[] }
  | { type: 'PROMPTS_GET' }
  | { type: 'PROMPTS_SAVE'; library: PromptLibrary }
  | {
      type: 'PROMPTS_ADD';
      profile: Omit<CustomPromptProfile, 'id' | 'createdAt'> & { id?: string };
    }
  | { type: 'PROMPTS_DELETE'; profileId: string }
  | { type: 'PROMPTS_RESET'; profileId?: string }
  | { type: 'TEXT_TRANSLATE'; payload: TranslateTextRequest }
  | { type: 'PAGE_STATUS_GET' }
  | { type: 'PAGE_TRANSLATE_START'; targetLanguage: string; modelId: string | null }
  | { type: 'PAGE_TRANSLATE_STOP' }
  | { type: 'PAGE_TRANSLATE_TOGGLE'; targetLanguage: string; modelId: string | null };

export type RuntimeResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface PongResponse {
  source: string;
  receivedAt: number;
}

export type PageStatusResponse = PageTranslationState;

export interface ModelsResponse {
  models: ModelConfig[];
}

export type ModelTestResponse = ModelTestResult;

export type TranslateTextRuntimeResponse = TranslateTextResponse;

export interface SiteRulesResponse {
  rules: SiteRule[];
}

export interface PromptsResponse {
  library: PromptLibrary;
  profiles: ResolvedPromptProfile[];
}
