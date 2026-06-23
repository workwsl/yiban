import type {
  CustomPromptProfile,
  PromptLibrary,
  PromptOverrides,
  ResolvedPromptProfile,
  StylePromptOverride,
  TranslateTextRequest,
} from './types';

export const PROMPT_VERSION = '2';
export const DEFAULT_PROMPT_PROFILE_ID = 'general';

export type BuiltInProfileId = 'general' | 'technical';

export interface StylePromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
}

export type DefaultPrompts = Record<BuiltInProfileId, StylePromptConfig>;

const GENERAL_SYSTEM_PROMPT = `You are a professional translation engine.
Translate the user's input into the target language.
Return only the translated text without explanations, notes, or summaries.
Do not add information not present in the source.
Preserve URLs, emails, code, variable names, commands, and structural meaning.`;

const TECHNICAL_SYSTEM_PROMPT = `${GENERAL_SYSTEM_PROMPT}

This is technical documentation translation.
Preserve API names, code symbols, command-line arguments, file paths, and product names.
Keep translations concise and accurate; avoid colloquial phrasing.`;

const USER_PROMPT_TEMPLATE = `Translate the following text to {{targetLanguage}}:

{{text}}`;

export const DEFAULT_PROMPTS: DefaultPrompts = {
  general: {
    systemPrompt: GENERAL_SYSTEM_PROMPT,
    userPromptTemplate: USER_PROMPT_TEMPLATE,
  },
  technical: {
    systemPrompt: TECHNICAL_SYSTEM_PROMPT,
    userPromptTemplate: USER_PROMPT_TEMPLATE,
  },
};

export const BUILTIN_PROFILE_IDS: BuiltInProfileId[] = ['general', 'technical'];

export const BUILTIN_PROFILE_LABELS: Record<BuiltInProfileId, string> = {
  general: '通用',
  technical: '技术文档（专家）',
};

export const EMPTY_PROMPT_LIBRARY: PromptLibrary = {
  customProfiles: [],
  overrides: {},
};

function isBuiltInProfileId(profileId: string): profileId is BuiltInProfileId {
  return profileId === 'general' || profileId === 'technical';
}

function mergePromptConfig(
  base: StylePromptConfig,
  override?: StylePromptOverride,
): StylePromptConfig {
  return {
    systemPrompt: override?.systemPrompt?.trim() || base.systemPrompt,
    userPromptTemplate: override?.userPromptTemplate?.trim() || base.userPromptTemplate,
  };
}

export function getBuiltinProfiles(): ResolvedPromptProfile[] {
  return BUILTIN_PROFILE_IDS.map((id) => ({
    id,
    name: BUILTIN_PROFILE_LABELS[id],
    ...DEFAULT_PROMPTS[id],
    isBuiltIn: true,
  }));
}

export function resolveProfile(
  profileId: string,
  library: PromptLibrary = EMPTY_PROMPT_LIBRARY,
): ResolvedPromptProfile | undefined {
  const override = library.overrides[profileId];

  if (isBuiltInProfileId(profileId)) {
    const merged = mergePromptConfig(DEFAULT_PROMPTS[profileId], override);
    return {
      id: profileId,
      name: BUILTIN_PROFILE_LABELS[profileId],
      ...merged,
      isBuiltIn: true,
    };
  }

  const custom = library.customProfiles.find((profile) => profile.id === profileId);

  if (!custom) {
    return undefined;
  }

  const merged = mergePromptConfig(
    {
      systemPrompt: custom.systemPrompt,
      userPromptTemplate: custom.userPromptTemplate,
    },
    override,
  );

  return {
    id: custom.id,
    name: custom.name,
    ...merged,
    isBuiltIn: false,
  };
}

export function resolveAllProfiles(library: PromptLibrary = EMPTY_PROMPT_LIBRARY): ResolvedPromptProfile[] {
  const builtinProfiles = getBuiltinProfiles().map((profile) =>
    resolveProfile(profile.id, library) ?? profile,
  );
  const customProfiles = library.customProfiles
    .map((profile) => resolveProfile(profile.id, library))
    .filter((profile): profile is ResolvedPromptProfile => profile !== undefined);

  return [...builtinProfiles, ...customProfiles];
}

export function getEffectiveProfilePrompt(
  profileId: string,
  library: PromptLibrary = EMPTY_PROMPT_LIBRARY,
): StylePromptConfig {
  const resolved = resolveProfile(profileId, library);

  if (resolved) {
    return {
      systemPrompt: resolved.systemPrompt,
      userPromptTemplate: resolved.userPromptTemplate,
    };
  }

  return DEFAULT_PROMPTS.general;
}

export function createDefaultCustomProfile(name: string): CustomPromptProfile {
  const defaults = DEFAULT_PROMPTS.general;

  return {
    id: crypto.randomUUID(),
    name: name.trim() || '自定义专家',
    systemPrompt: defaults.systemPrompt,
    userPromptTemplate: defaults.userPromptTemplate,
    createdAt: Date.now(),
  };
}

export function renderUserPrompt(template: string, targetLanguage: string, text: string): string {
  return template.replaceAll('{{targetLanguage}}', targetLanguage).replaceAll('{{text}}', text);
}

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildChatMessages(
  profileId: string,
  request: Pick<TranslateTextRequest, 'text' | 'targetLanguage'>,
  library: PromptLibrary = EMPTY_PROMPT_LIBRARY,
): ChatMessage[] {
  const prompt = getEffectiveProfilePrompt(profileId, library);

  return [
    {
      role: 'system',
      content: prompt.systemPrompt,
    },
    {
      role: 'user',
      content: renderUserPrompt(prompt.userPromptTemplate, request.targetLanguage, request.text),
    },
  ];
}

async function hashText(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getEffectivePromptFingerprint(
  library: PromptLibrary = EMPTY_PROMPT_LIBRARY,
): Promise<string> {
  const payload = resolveAllProfiles(library)
    .map((profile) => `${profile.id}\n${profile.name}\n${profile.systemPrompt}\n${profile.userPromptTemplate}`)
    .join('\n---\n');

  return hashText(`${PROMPT_VERSION}\n${payload}`);
}

export function previewChatMessages(
  profileId: string,
  library: PromptLibrary | undefined,
  sampleText: string,
  targetLanguage: string,
): ChatMessage[] {
  return buildChatMessages(
    profileId,
    {
      text: sampleText,
      targetLanguage,
    },
    library,
  );
}

export function migrateLegacyPromptOverrides(legacy: PromptOverrides | undefined): PromptLibrary {
  if (!legacy) {
    return { ...EMPTY_PROMPT_LIBRARY };
  }

  const overrides: PromptLibrary['overrides'] = {};

  if (legacy.general) {
    overrides.general = legacy.general;
  }

  if (legacy.technical) {
    overrides.technical = legacy.technical;
  }

  return {
    customProfiles: [],
    overrides,
  };
}
