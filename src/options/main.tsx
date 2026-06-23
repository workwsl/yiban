import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EMPTY_PROMPT_LIBRARY } from '../shared/prompts';
import { DEFAULT_SETTINGS } from '../shared/defaults';
import type {
  ModelsResponse,
  ModelTestResponse,
  PromptsResponse,
  RuntimeResponse,
  SiteRulesResponse,
} from '../shared/messages';
import type {
  CustomPromptProfile,
  ModelConfig,
  PromptLibrary,
  ResolvedPromptProfile,
  SiteRule,
  UserSettings,
} from '../shared/types';
import { BlocklistSettings } from './BlocklistSettings';
import { GeneralSettings } from './GeneralSettings';
import { ModelEditorModal } from './ModelEditorModal';
import { ModelSettings } from './ModelSettings';
import { OptionsShell } from './OptionsShell';
import { PromptSettings } from './PromptSettings';
import { parseSectionFromHash, type OptionsSection } from './types';
import './styles.css';

type ModelTestOutcome = { ok: true; message: string } | { ok: false; message: string };

async function runModelTest(model: ModelConfig): Promise<ModelTestOutcome> {
  const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<ModelTestResponse>>({
    type: 'MODEL_TEST',
    model,
  });

  if (response.ok) {
    const message = response.data.latencyMs
      ? `${response.data.message}（${response.data.latencyMs}ms）`
      : response.data.message;
    return { ok: true, message };
  }

  return { ok: false, message: response.error.message };
}

function emptyModel(): ModelConfig {
  return {
    id: crypto.randomUUID(),
    provider: 'openai-compatible',
    name: '自定义模型',
    baseUrl: '',
    apiKey: '',
    model: '',
    enabled: true,
    timeoutMs: 30000,
    maxConcurrency: 3,
    maxCharsPerRequest: 3000,
  };
}

function Options() {
  const [activeSection, setActiveSection] = useState<OptionsSection>(parseSectionFromHash);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [siteRules, setSiteRules] = useState<SiteRule[]>([]);
  const [promptLibrary, setPromptLibrary] = useState<PromptLibrary>(EMPTY_PROMPT_LIBRARY);
  const [promptProfiles, setPromptProfiles] = useState<ResolvedPromptProfile[]>([]);
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingModel, setEditingModel] = useState<ModelConfig>(emptyModel());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  function flashSaved(): void {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function applyPromptsResponse(data: PromptsResponse): void {
    setPromptLibrary(data.library);
    setPromptProfiles(data.profiles);
  }

  function handleSectionChange(section: OptionsSection): void {
    setActiveSection(section);
    window.location.hash = section;
    setError(null);
  }

  async function loadSettings(): Promise<UserSettings | null> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<UserSettings>>({
      type: 'SETTINGS_GET',
    });

    if (response.ok) {
      setSettings(response.data);
      setError(null);
      return response.data;
    }

    setError(response.error.message);
    return null;
  }

  async function loadModels(): Promise<ModelConfig[]> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<ModelsResponse>>({
      type: 'MODELS_GET',
    });

    if (!response.ok) {
      setError(response.error.message);
      return [];
    }

    setModels(response.data.models);
    return response.data.models;
  }

  async function loadPrompts(): Promise<PromptsResponse | null> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({
      type: 'PROMPTS_GET',
    });

    if (response.ok) {
      applyPromptsResponse(response.data);
      setError(null);
      return response.data;
    }

    setError(response.error.message);
    return null;
  }

  async function savePromptLibrary(nextLibrary: PromptLibrary): Promise<boolean> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({
      type: 'PROMPTS_SAVE',
      library: nextLibrary,
    });

    if (response.ok) {
      applyPromptsResponse(response.data);
      setError(null);
      return true;
    }

    setError(response.error.message);
    return false;
  }

  async function addPromptProfile(
    profile: Omit<CustomPromptProfile, 'id' | 'createdAt'>,
  ): Promise<boolean> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({
      type: 'PROMPTS_ADD',
      profile,
    });

    if (response.ok) {
      applyPromptsResponse(response.data);
      setError(null);
      return true;
    }

    setError(response.error.message);
    return false;
  }

  async function deletePromptProfile(profileId: string): Promise<void> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({
      type: 'PROMPTS_DELETE',
      profileId,
    });

    if (response.ok) {
      applyPromptsResponse(response.data);
      const nextSettings = await loadSettings();

      if (nextSettings && !response.data.profiles.some((profile) => profile.id === nextSettings.promptProfileId)) {
        setSettings({ ...nextSettings, promptProfileId: 'general' });
      }

      setError(null);
      flashSaved();
    } else {
      setError(response.error.message);
    }
  }

  async function resetPromptProfile(profileId: string): Promise<void> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({
      type: 'PROMPTS_RESET',
      profileId,
    });

    if (response.ok) {
      applyPromptsResponse(response.data);
      setError(null);
      flashSaved();
    } else {
      setError(response.error.message);
    }
  }

  async function resetAllPromptProfiles(): Promise<void> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({
      type: 'PROMPTS_RESET',
    });

    if (response.ok) {
      applyPromptsResponse(response.data);
      setError(null);
      flashSaved();
    } else {
      setError(response.error.message);
    }
  }

  async function handleSavePrompts(): Promise<void> {
    if (await savePromptLibrary(promptLibrary)) {
      flashSaved();
    }
  }

  async function loadSiteRules() {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<SiteRulesResponse>>({
      type: 'SITE_RULES_GET',
    });

    if (response.ok) {
      setSiteRules(response.data.rules);
    }
  }

  async function persistSettings(nextSettings: UserSettings): Promise<boolean> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<null>>({
      type: 'SETTINGS_SAVE',
      settings: nextSettings,
    });

    if (response.ok) {
      setSettings(nextSettings);
      setError(null);
      return true;
    }

    setError(response.error.message);
    return false;
  }

  async function saveSettings() {
    if (await persistSettings(settings)) {
      flashSaved();
    }
  }

  async function setDefaultModel(modelId: string) {
    const nextSettings = { ...settings, defaultModelId: modelId };

    if (await persistSettings(nextSettings)) {
      flashSaved();
    }
  }

  function openCreateModal() {
    setEditingModel(emptyModel());
    setModalMode('create');
    setModalError(null);
    setTestResult(null);
    setModalOpen(true);
  }

  function openEditModal(model: ModelConfig) {
    setEditingModel(model);
    setModalMode('edit');
    setModalError(null);
    setTestResult(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalError(null);
    setTestResult(null);
  }

  async function saveModel() {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<ModelsResponse>>({
      type: 'MODEL_SAVE',
      model: editingModel,
    });

    if (!response.ok) {
      setModalError(response.error.message);
      return;
    }

    const nextModels = response.data.models;
    setModels(nextModels);

    const shouldAutoDefault =
      !settings.defaultModelId || !nextModels.some((model) => model.id === settings.defaultModelId);

    if (shouldAutoDefault) {
      await persistSettings({ ...settings, defaultModelId: editingModel.id });
    }

    closeModal();
    flashSaved();
  }

  async function deleteModelById(modelId: string) {
    const model = models.find((item) => item.id === modelId);

    if (!model || !window.confirm(`确定删除模型「${model.name}」吗？`)) {
      return;
    }

    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<ModelsResponse>>({
      type: 'MODEL_DELETE',
      modelId,
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    const nextModels = response.data.models;
    setModels(nextModels);

    if (settings.defaultModelId === modelId) {
      await persistSettings({
        ...settings,
        defaultModelId: nextModels[0]?.id ?? null,
      });
    }

    flashSaved();
  }

  async function testModel() {
    setTestResult('测试中...');
    setModalError(null);

    const result = await runModelTest(editingModel);

    if (result.ok) {
      setTestResult(result.message);
    } else {
      setTestResult(null);
      setModalError(result.message);
    }
  }

  function testModelFromList(model: ModelConfig): Promise<ModelTestOutcome> {
    return runModelTest(model);
  }

  async function saveSiteRules(nextRules: SiteRule[]) {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<SiteRulesResponse>>({
      type: 'SITE_RULES_SAVE',
      rules: nextRules,
    });

    if (response.ok) {
      setSiteRules(response.data.rules);
      setNewBlockedDomain('');
      setError(null);
    } else {
      setError(response.error.message);
    }
  }

  function addBlockedDomain() {
    const domain = newBlockedDomain.trim().toLowerCase();

    if (!domain || siteRules.some((rule) => rule.domain === domain)) {
      return;
    }

    void saveSiteRules([...siteRules, { domain, rule: 'never_translate' }]);
  }

  useEffect(() => {
    void (async () => {
      await loadSettings();
      await loadModels();
      await loadPrompts();
      await loadSiteRules();
    })();
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setActiveSection(parseSectionFromHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const defaultModel = models.find((model) => model.id === settings.defaultModelId);

  return (
    <>
      <OptionsShell activeSection={activeSection} onSectionChange={handleSectionChange}>
        {activeSection === 'general' ? (
          <GeneralSettings
            settings={settings}
            profiles={promptProfiles}
            saved={saved}
            error={error}
            onChange={setSettings}
            onSave={() => void saveSettings()}
          />
        ) : null}

        {activeSection === 'prompts' ? (
          <PromptSettings
            library={promptLibrary}
            profiles={promptProfiles}
            saved={saved}
            error={error}
            onChange={setPromptLibrary}
            onSave={() => void handleSavePrompts()}
            onResetProfile={(profileId) => void resetPromptProfile(profileId)}
            onResetAll={() => void resetAllPromptProfiles()}
            onAddProfile={addPromptProfile}
            onDeleteProfile={(profileId) => void deletePromptProfile(profileId)}
          />
        ) : null}

        {activeSection === 'models' ? (
          <ModelSettings
            models={models}
            defaultModelId={settings.defaultModelId}
            defaultModelName={defaultModel?.name ?? '未设置'}
            saved={saved}
            onAdd={openCreateModal}
            onEdit={openEditModal}
            onSetDefault={(modelId) => void setDefaultModel(modelId)}
            onDelete={(modelId) => void deleteModelById(modelId)}
            onTest={testModelFromList}
          />
        ) : null}

        {activeSection === 'blocklist' ? (
          <BlocklistSettings
            siteRules={siteRules}
            newBlockedDomain={newBlockedDomain}
            error={error}
            onNewBlockedDomainChange={setNewBlockedDomain}
            onAdd={addBlockedDomain}
            onRemove={(domain) => void saveSiteRules(siteRules.filter((item) => item.domain !== domain))}
          />
        ) : null}
      </OptionsShell>

      <ModelEditorModal
        open={modalOpen}
        mode={modalMode}
        model={editingModel}
        testResult={testResult}
        error={modalError}
        onChange={setEditingModel}
        onSave={() => void saveModel()}
        onTest={() => void testModel()}
        onClose={closeModal}
      />
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Options />);
