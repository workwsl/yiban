import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ModelsResponse, PageStatusResponse, PromptsResponse, RuntimeResponse } from '../shared/messages';
import { DEFAULT_SETTINGS } from '../shared/defaults';
import { formatCommandShortcut } from '../shared/shortcut-format';
import type { ModelConfig, ResolvedPromptProfile, UserSettings } from '../shared/types';
import { LanguageBar } from '../shared/components/LanguageBar';
import { ToggleRow } from './components/ToggleRow';
import './styles.css';

const EXTENSION_VERSION = '0.2.0';
const TOGGLE_SHORTCUT_LABEL = formatCommandShortcut('Alt+A');

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  scanning: '扫描中',
  translating: '翻译中',
  paused: '已暂停',
  stopped: '已停止',
  completed: '已完成',
  failed: '失败',
};

function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function Popup() {
  const [status, setStatus] = useState<string>('读取中');
  const [progress, setProgress] = useState<PageStatusResponse | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [promptProfiles, setPromptProfiles] = useState<ResolvedPromptProfile[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_SETTINGS.defaultTargetLanguage);
  const [promptProfileId, setPromptProfileId] = useState(DEFAULT_SETTINGS.promptProfileId);
  const [error, setError] = useState<string | null>(null);

  const [selectionTranslateEnabled, setSelectionTranslateEnabled] = useState(
    DEFAULT_SETTINGS.selectionTranslateEnabled,
  );

  const isTranslating = status === 'translating' || status === 'scanning';

  async function loadPageStatus() {
    setError(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      setError('无法读取当前标签页');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage<unknown, RuntimeResponse<PageStatusResponse>>(tab.id, {
        type: 'PAGE_STATUS_GET',
      });

      if (response.ok) {
        setStatus(response.data.status);
        setProgress(response.data);
      } else {
        setError(response.error.message);
      }
    } catch {
      setError('当前页面无法连接内容脚本，请刷新页面后重试');
    }
  }

  async function startTranslation() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      setError('无法读取当前标签页');
      return;
    }

    const response = await chrome.tabs.sendMessage<unknown, RuntimeResponse<PageStatusResponse>>(tab.id, {
      type: 'PAGE_TRANSLATE_START',
      targetLanguage,
      modelId: selectedModelId,
    });

    if (response.ok) {
      setStatus(response.data.status);
      setProgress(response.data);
      setError(null);
    } else {
      setError(response.error.message);
    }
  }

  async function stopTranslation() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      setError('无法读取当前标签页');
      return;
    }

    const response = await chrome.tabs.sendMessage<unknown, RuntimeResponse<PageStatusResponse>>(tab.id, {
      type: 'PAGE_TRANSLATE_STOP',
    });

    if (response.ok) {
      setStatus(response.data.status);
      setProgress(response.data);
    }
  }

  async function persistSelectionSetting(enabled: boolean): Promise<void> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<UserSettings>>({
      type: 'SETTINGS_GET',
    });

    if (!response.ok) {
      return;
    }

    await chrome.runtime.sendMessage({
      type: 'SETTINGS_SAVE',
      settings: {
        ...response.data,
        selectionTranslateEnabled: enabled,
      },
    });
  }

  async function handleSelectionTranslateChange(enabled: boolean): Promise<void> {
    setSelectionTranslateEnabled(enabled);
    await persistSelectionSetting(enabled);
  }

  async function persistDefaultModel(modelId: string | null): Promise<void> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<UserSettings>>({
      type: 'SETTINGS_GET',
    });

    if (!response.ok) {
      return;
    }

    await chrome.runtime.sendMessage({
      type: 'SETTINGS_SAVE',
      settings: {
        ...response.data,
        defaultModelId: modelId,
      },
    });
  }

  async function persistPromptProfileId(nextProfileId: string): Promise<void> {
    const response = await chrome.runtime.sendMessage<unknown, RuntimeResponse<UserSettings>>({
      type: 'SETTINGS_GET',
    });

    if (!response.ok) {
      return;
    }

    await chrome.runtime.sendMessage({
      type: 'SETTINGS_SAVE',
      settings: {
        ...response.data,
        promptProfileId: nextProfileId,
      },
    });
  }

  async function handlePromptProfileChange(nextProfileId: string): Promise<void> {
    setPromptProfileId(nextProfileId);
    await persistPromptProfileId(nextProfileId);
  }

  async function handleModelChange(modelId: string | null): Promise<void> {
    setSelectedModelId(modelId);
    await persistDefaultModel(modelId);
  }

  async function loadSettingsAndModels() {
    const [settingsResponse, modelsResponse, promptsResponse] = await Promise.all([
      chrome.runtime.sendMessage<unknown, RuntimeResponse<UserSettings>>({ type: 'SETTINGS_GET' }),
      chrome.runtime.sendMessage<unknown, RuntimeResponse<ModelsResponse>>({ type: 'MODELS_GET' }),
      chrome.runtime.sendMessage<unknown, RuntimeResponse<PromptsResponse>>({ type: 'PROMPTS_GET' }),
    ]);

    if (settingsResponse.ok) {
      const loaded = settingsResponse.data;
      setTargetLanguage(loaded.defaultTargetLanguage);
      setSelectedModelId(loaded.defaultModelId);
      setPromptProfileId(loaded.promptProfileId);
      setSelectionTranslateEnabled(loaded.selectionTranslateEnabled);
    }

    if (modelsResponse.ok) {
      setModels(modelsResponse.data.models);
      setSelectedModelId((current) => current ?? modelsResponse.data.models[0]?.id ?? null);
    }

    if (promptsResponse.ok) {
      setPromptProfiles(promptsResponse.data.profiles);
    }
  }

  useEffect(() => {
    void loadSettingsAndModels();
    void loadPageStatus();
  }, []);

  useEffect(() => {
    if (!isTranslating) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadPageStatus();
    }, 800);

    return () => window.clearInterval(timer);
  }, [isTranslating]);

  const progressText =
    progress && progress.total > 0
      ? `${progress.completed} / ${progress.total}${progress.failed ? `，失败 ${progress.failed}` : ''}`
      : null;

  return (
    <main className="popup">
      <header className="popup-header">
        <h1 className="popup-brand">译伴</h1>
        <span className={`status-pill${isTranslating ? ' is-active' : ''}`}>{formatStatus(status)}</span>
      </header>

      <LanguageBar targetLanguage={targetLanguage} onTargetLanguageChange={setTargetLanguage} />

      <section className="settings-card">
        <div className="setting-row">
          <span className="setting-row-label">翻译服务</span>
          <div className="setting-row-control">
            <select
              className="setting-select"
              value={selectedModelId ?? ''}
              disabled={models.length === 0}
              onChange={(event) => void handleModelChange(event.target.value || null)}
            >
              {models.length === 0 ? (
                <option value="">请先在设置中添加模型</option>
              ) : (
                models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-row-label">AI 专家</span>
          <div className="setting-row-control">
            <select
              className="setting-select"
              value={promptProfileId}
              onChange={(event) => void handlePromptProfileChange(event.target.value)}
            >
              {promptProfiles.length === 0 ? (
                <option value="general">通用</option>
              ) : (
                promptProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      {error ? <p className="alert">{error}</p> : null}

      <section className="translate-section">
        <p className="translate-meta">{progressText ?? (isTranslating ? '正在处理页面内容…' : '')}</p>
        <div className="translate-actions">
          <button
            type="button"
            className="btn-translate"
            disabled={models.length === 0 || isTranslating}
            onClick={() => void startTranslation()}
          >
            {`翻译 (${TOGGLE_SHORTCUT_LABEL})`}
          </button>
          {isTranslating ? (
            <button type="button" className="btn-stop" onClick={() => void stopTranslation()}>
              停止
            </button>
          ) : null}
        </div>
      </section>

      <section className="toggles">
        <ToggleRow
          label="划词翻译：选中后显示翻译按钮"
          checked={selectionTranslateEnabled}
          onChange={(enabled) => void handleSelectionTranslateChange(enabled)}
        />
      </section>

      <footer className="popup-footer">
        <div className="popup-footer-links">
          <button
            type="button"
            className="footer-link"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('translator.html') })}
          >
            输入翻译
          </button>
          <button type="button" className="footer-link" onClick={() => chrome.runtime.openOptionsPage()}>
            设置
          </button>
        </div>
        <span className="footer-version">{EXTENSION_VERSION}</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Popup />);
