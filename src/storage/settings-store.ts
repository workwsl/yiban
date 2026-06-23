import { DEFAULT_SETTINGS } from '../shared/defaults';
import { DEFAULT_PROMPT_PROFILE_ID } from '../shared/prompts';
import type { UserSettings } from '../shared/types';

const SETTINGS_KEY = 'yiban.userSettings';

interface LegacyUserSettings extends Partial<UserSettings> {
  translationStyle?: string;
}

function normalizeUserSettings(raw: LegacyUserSettings | undefined): UserSettings {
  const promptProfileId = raw?.promptProfileId ?? raw?.translationStyle ?? DEFAULT_PROMPT_PROFILE_ID;

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    promptProfileId,
  };
}

export async function getUserSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeUserSettings(result[SETTINGS_KEY] as LegacyUserSettings | undefined);
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function ensureValidPromptProfileId(profileId: string, availableIds: string[]): Promise<string> {
  if (availableIds.includes(profileId)) {
    return profileId;
  }

  const settings = await getUserSettings();

  if (settings.promptProfileId !== DEFAULT_PROMPT_PROFILE_ID) {
    await saveUserSettings({
      ...settings,
      promptProfileId: DEFAULT_PROMPT_PROFILE_ID,
    });
  }

  return DEFAULT_PROMPT_PROFILE_ID;
}
