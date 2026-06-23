import { initKeyboardShortcut } from './keyboard-shortcut';
import {
  startLazyPageTranslation,
  type LazyTranslationController,
} from './lazy-translator';
import { initSelectionTranslator } from './selection-translator';
import { removeExistingTranslations } from './translation-renderer';
import type {
  ModelsResponse,
  PromptsResponse,
  RuntimeMessage,
  RuntimeResponse,
  SiteRulesResponse,
} from '../shared/messages';
import { findModel } from '../shared/model-utils';
import { getEffectivePromptFingerprint } from '../shared/prompts';
import type { PageTranslationState, UserSettings } from '../shared/types';

const state: PageTranslationState = {
  status: 'idle',
  total: 0,
  completed: 0,
  failed: 0,
  updatedAt: Date.now(),
};

let stopRequested = false;
let lazyTranslator: LazyTranslationController | null = null;

initSelectionTranslator();
initKeyboardShortcut(() => {
  void toggleWithDefaultSettings();
});

function toResponse<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function hasVisibleTranslations(): boolean {
  return document.querySelector('[data-yiban-translated="true"]') !== null;
}

function shouldStopTranslation(): boolean {
  return (
    state.status === 'scanning' ||
    state.status === 'translating' ||
    state.status === 'completed' ||
    hasVisibleTranslations()
  );
}

function stopTranslation(): void {
  stopRequested = true;
  lazyTranslator?.stop();
  lazyTranslator = null;
  removeExistingTranslations();
  state.status = 'idle';
  state.total = 0;
  state.completed = 0;
  state.failed = 0;
  state.errorMessage = undefined;
  state.updatedAt = Date.now();
}

async function togglePageTranslation(targetLanguage: string, modelId: string | null): Promise<void> {
  if (shouldStopTranslation()) {
    stopTranslation();
    return;
  }

  void translatePage(targetLanguage, modelId);
  state.status = 'scanning';
}

async function toggleWithDefaultSettings(): Promise<void> {
  const [settingsResponse, modelsResponse] = await Promise.all([
    chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<UserSettings>>({ type: 'SETTINGS_GET' }),
    chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<ModelsResponse>>({ type: 'MODELS_GET' }),
  ]);

  if (!settingsResponse.ok || !modelsResponse.ok) {
    return;
  }

  const model = findModel(modelsResponse.data.models, settingsResponse.data.defaultModelId);
  await togglePageTranslation(settingsResponse.data.defaultTargetLanguage, model?.id ?? null);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse(toResponse({ source: 'content', receivedAt: Date.now() }));
    return false;
  }

  if (message.type === 'PAGE_STATUS_GET') {
    sendResponse(toResponse(state));
    return false;
  }

  if (message.type === 'PAGE_TRANSLATE_START') {
    void translatePage(message.targetLanguage, message.modelId);
    state.status = 'scanning';
    sendResponse(toResponse(state));
    return false;
  }

  if (message.type === 'PAGE_TRANSLATE_STOP') {
    stopTranslation();
    sendResponse(toResponse(state));
    return false;
  }

  if (message.type === 'PAGE_TRANSLATE_TOGGLE') {
    void togglePageTranslation(message.targetLanguage, message.modelId).then(() => {
      sendResponse(toResponse(state));
    });
    return true;
  }

  return false;
});

async function translatePage(targetLanguage: string, modelId: string | null): Promise<void> {
  stopRequested = false;
  lazyTranslator?.stop();
  lazyTranslator = null;
  removeExistingTranslations();

  state.status = 'scanning';
  state.total = 0;
  state.completed = 0;
  state.failed = 0;
  state.errorMessage = undefined;
  state.updatedAt = Date.now();

  if (await isCurrentSiteBlocked()) {
    state.status = 'failed';
    state.errorMessage = '当前网站已加入翻译黑名单。';
    state.updatedAt = Date.now();
    return;
  }

  const [settingsResponse, promptsResponse] = await Promise.all([
    chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<UserSettings>>({ type: 'SETTINGS_GET' }),
    chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<PromptsResponse>>({ type: 'PROMPTS_GET' }),
  ]);

  const promptProfileId = settingsResponse.ok
    ? settingsResponse.data.promptProfileId
    : 'general';
  const promptOverrides = promptsResponse.ok ? promptsResponse.data.library : { customProfiles: [], overrides: {} };
  const promptFingerprint = await getEffectivePromptFingerprint(promptOverrides);

  lazyTranslator = startLazyPageTranslation({
    targetLanguage,
    modelId,
    promptProfileId,
    promptFingerprint,
    isStopped: () => stopRequested,
    onProgress: (progress) => {
      state.total = progress.total;
      state.completed = progress.completed;
      state.failed = progress.failed;
      state.errorMessage = progress.errorMessage;

      if (progress.total > 0) {
        state.status =
          progress.completed + progress.failed >= progress.total ? 'completed' : 'translating';
      } else if (progress.discoverFinished) {
        state.status = 'completed';
      }

      state.updatedAt = Date.now();
    },
  });
}

async function isCurrentSiteBlocked(): Promise<boolean> {
  const response = await chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<SiteRulesResponse>>({
    type: 'SITE_RULES_GET',
  });

  if (!response.ok) {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return response.data.rules.some((rule) => rule.rule === 'never_translate' && hostname === rule.domain);
}
