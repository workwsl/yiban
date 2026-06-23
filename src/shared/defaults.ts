import { DEFAULT_PROMPT_PROFILE_ID } from '../shared/prompts';
import type { UserSettings } from '../shared/types';

export const DEFAULT_SETTINGS: UserSettings = {
  defaultTargetLanguage: 'zh-CN',
  defaultModelId: null,
  displayMode: 'bilingual',
  promptProfileId: DEFAULT_PROMPT_PROFILE_ID,
  cacheEnabled: true,
  autoTranslate: false,
  selectionTranslateEnabled: true,
};
