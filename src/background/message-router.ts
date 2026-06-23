import type { RuntimeMessage, RuntimeResponse } from '../shared/messages';
import { DEFAULT_PROMPT_PROFILE_ID, resolveAllProfiles } from '../shared/prompts';
import { findModel } from '../shared/model-utils';
import { getProvider } from '../providers';
import { deleteModel, getModels, saveModel } from '../storage/model-store';
import {
  addCustomProfile,
  deleteCustomProfile,
  getPromptLibrary,
  getResolvedPromptProfiles,
  resetAllProfiles,
  resetProfile,
  savePromptLibrary,
} from '../storage/prompt-store';
import { getSiteRules, saveSiteRules } from '../storage/rule-store';
import { ensureValidPromptProfileId, getUserSettings, saveUserSettings } from '../storage/settings-store';

async function buildPromptsResponse() {
  const { library, profiles } = await getResolvedPromptProfiles();
  return { library, profiles };
}

export async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'PING':
      return {
        ok: true,
        data: {
          source: 'background',
          receivedAt: Date.now(),
        },
      };

    case 'SETTINGS_GET':
      return {
        ok: true,
        data: await getUserSettings(),
      };

    case 'SETTINGS_SAVE':
      await saveUserSettings(message.settings);
      return {
        ok: true,
        data: null,
      };

    case 'MODELS_GET':
      return {
        ok: true,
        data: {
          models: await getModels(),
        },
      };

    case 'MODEL_SAVE':
      return {
        ok: true,
        data: {
          models: await saveModel(message.model),
        },
      };

    case 'MODEL_DELETE':
      return {
        ok: true,
        data: {
          models: await deleteModel(message.modelId),
        },
      };

    case 'MODEL_TEST':
      try {
        return {
          ok: true,
          data: await getProvider(message.model).testConnection(message.model),
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: error instanceof Error && 'code' in error ? String(error.code) : 'MODEL_TEST_FAILED',
            message: error instanceof Error ? error.message : '模型连接测试失败。',
          },
        };
      }

    case 'SITE_RULES_GET':
      return {
        ok: true,
        data: {
          rules: await getSiteRules(),
        },
      };

    case 'SITE_RULES_SAVE':
      return {
        ok: true,
        data: {
          rules: await saveSiteRules(message.rules),
        },
      };

    case 'PROMPTS_GET':
      return {
        ok: true,
        data: await buildPromptsResponse(),
      };

    case 'PROMPTS_SAVE': {
      const library = await savePromptLibrary(message.library);
      return {
        ok: true,
        data: {
          library,
          profiles: resolveAllProfiles(library),
        },
      };
    }

    case 'PROMPTS_ADD': {
      const library = await addCustomProfile(message.profile);
      return {
        ok: true,
        data: {
          library,
          profiles: resolveAllProfiles(library),
        },
      };
    }

    case 'PROMPTS_DELETE': {
      const library = await deleteCustomProfile(message.profileId);
      return {
        ok: true,
        data: {
          library,
          profiles: resolveAllProfiles(library),
        },
      };
    }

    case 'PROMPTS_RESET': {
      const library = message.profileId
        ? await resetProfile(message.profileId)
        : await resetAllProfiles();
      return {
        ok: true,
        data: {
          library,
          profiles: resolveAllProfiles(library),
        },
      };
    }

    case 'TEXT_TRANSLATE': {
      try {
        const models = await getModels();
        const [settings, promptLibrary] = await Promise.all([getUserSettings(), getPromptLibrary()]);
        const model = findModel(models, message.payload.modelId ?? settings.defaultModelId);

        if (!model) {
          return {
            ok: false,
            error: {
              code: 'MODEL_MISSING',
              message: '请先在设置页添加模型配置。',
            },
          };
        }

        const profileIds = resolveAllProfiles(promptLibrary).map((profile) => profile.id);
        const promptProfileId = await ensureValidPromptProfileId(
          message.payload.promptProfileId ?? settings.promptProfileId ?? DEFAULT_PROMPT_PROFILE_ID,
          profileIds,
        );

        const enrichedRequest = {
          ...message.payload,
          promptProfileId,
          promptLibrary,
        };

        return {
          ok: true,
          data: {
            ...(await getProvider(model).translateText(enrichedRequest, model)),
            modelId: model.id,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: error instanceof Error && 'code' in error ? String(error.code) : 'TRANSLATE_FAILED',
            message: error instanceof Error ? error.message : '翻译失败。',
          },
        };
      }
    }

    default:
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_MESSAGE',
          message: `Unsupported message type: ${(message as { type?: string }).type ?? 'unknown'}`,
        },
      };
  }
}
