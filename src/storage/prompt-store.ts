import {
  createDefaultCustomProfile,
  DEFAULT_PROMPT_PROFILE_ID,
  EMPTY_PROMPT_LIBRARY,
  migrateLegacyPromptOverrides,
  resolveAllProfiles,
} from '../shared/prompts';
import type { CustomPromptProfile, PromptLibrary, PromptOverrides } from '../shared/types';
import { getUserSettings, saveUserSettings } from './settings-store';

const PROMPT_LIBRARY_KEY = 'yiban.promptLibrary';
const LEGACY_PROMPT_OVERRIDES_KEY = 'yiban.promptOverrides';

function normalizeLibrary(value: PromptLibrary | undefined): PromptLibrary {
  return {
    customProfiles: value?.customProfiles ?? [],
    overrides: value?.overrides ?? {},
  };
}

async function migrateLegacyStorage(): Promise<PromptLibrary> {
  const result = await chrome.storage.local.get([PROMPT_LIBRARY_KEY, LEGACY_PROMPT_OVERRIDES_KEY]);
  const existingLibrary = result[PROMPT_LIBRARY_KEY] as PromptLibrary | undefined;

  if (existingLibrary) {
    return normalizeLibrary(existingLibrary);
  }

  const legacyOverrides = result[LEGACY_PROMPT_OVERRIDES_KEY] as PromptOverrides | undefined;
  const migrated = migrateLegacyPromptOverrides(legacyOverrides);
  await chrome.storage.local.set({ [PROMPT_LIBRARY_KEY]: migrated });

  if (legacyOverrides) {
    await chrome.storage.local.remove(LEGACY_PROMPT_OVERRIDES_KEY);
  }

  return migrated;
}

export async function getPromptLibrary(): Promise<PromptLibrary> {
  return migrateLegacyStorage();
}

export async function savePromptLibrary(library: PromptLibrary): Promise<PromptLibrary> {
  const normalized = normalizeLibrary(library);
  await chrome.storage.local.set({ [PROMPT_LIBRARY_KEY]: normalized });
  return normalized;
}

export async function addCustomProfile(
  profile: Omit<CustomPromptProfile, 'id' | 'createdAt'> & { id?: string },
): Promise<PromptLibrary> {
  const library = await getPromptLibrary();
  const nextProfile = profile.id
    ? {
        id: profile.id,
        name: profile.name.trim(),
        systemPrompt: profile.systemPrompt.trim(),
        userPromptTemplate: profile.userPromptTemplate.trim(),
        createdAt: Date.now(),
      }
    : createDefaultCustomProfile(profile.name);

  if (profile.systemPrompt.trim()) {
    nextProfile.systemPrompt = profile.systemPrompt.trim();
  }

  if (profile.userPromptTemplate.trim()) {
    nextProfile.userPromptTemplate = profile.userPromptTemplate.trim();
  }

  return savePromptLibrary({
    ...library,
    customProfiles: [...library.customProfiles, nextProfile],
  });
}

export async function deleteCustomProfile(profileId: string): Promise<PromptLibrary> {
  const library = await getPromptLibrary();
  const nextOverrides = { ...library.overrides };
  delete nextOverrides[profileId];

  const nextLibrary = await savePromptLibrary({
    customProfiles: library.customProfiles.filter((profile) => profile.id !== profileId),
    overrides: nextOverrides,
  });

  const settings = await getUserSettings();

  if (settings.promptProfileId === profileId) {
    await saveUserSettings({
      ...settings,
      promptProfileId: DEFAULT_PROMPT_PROFILE_ID,
    });
  }

  return nextLibrary;
}

export async function resetProfile(profileId: string): Promise<PromptLibrary> {
  const library = await getPromptLibrary();
  const nextOverrides = { ...library.overrides };
  delete nextOverrides[profileId];

  const customProfile = library.customProfiles.find((profile) => profile.id === profileId);

  if (customProfile) {
    const defaults = createDefaultCustomProfile(customProfile.name);
    return savePromptLibrary({
      ...library,
      customProfiles: library.customProfiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              systemPrompt: defaults.systemPrompt,
              userPromptTemplate: defaults.userPromptTemplate,
            }
          : profile,
      ),
      overrides: nextOverrides,
    });
  }

  return savePromptLibrary({
    ...library,
    overrides: nextOverrides,
  });
}

export async function resetAllProfiles(): Promise<PromptLibrary> {
  return savePromptLibrary({ ...EMPTY_PROMPT_LIBRARY });
}

export async function getResolvedPromptProfiles() {
  const library = await getPromptLibrary();
  return {
    library,
    profiles: resolveAllProfiles(library),
  };
}

/** @deprecated Use getPromptLibrary */
export async function getPromptOverrides(): Promise<PromptOverrides> {
  const library = await getPromptLibrary();
  return library.overrides as PromptOverrides;
}

/** @deprecated Use savePromptLibrary */
export async function savePromptOverrides(overrides: PromptOverrides): Promise<void> {
  const library = await getPromptLibrary();
  await savePromptLibrary({
    ...library,
    overrides: {
      ...library.overrides,
      ...overrides,
    },
  });
}

/** @deprecated Use resetProfile */
export async function resetPromptStyle(style: 'general' | 'technical'): Promise<PromptLibrary> {
  return resetProfile(style);
}

/** @deprecated Use resetAllProfiles */
export async function resetAllPrompts(): Promise<PromptLibrary> {
  return resetAllProfiles();
}
