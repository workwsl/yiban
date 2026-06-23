import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageBar } from '../shared/components/LanguageBar';
import { DEFAULT_SETTINGS } from '../shared/defaults';
import type { ModelsResponse, PromptsResponse, RuntimeResponse, TranslateTextRuntimeResponse } from '../shared/messages';
import type { ModelConfig, ResolvedPromptProfile, UserSettings } from '../shared/types';
import './styles.css';

const DEBOUNCE_MS = 800;

type TranslateStatus = 'idle' | 'pending' | 'translating' | 'done' | 'error';

function Translator() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_SETTINGS.defaultTargetLanguage);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [promptProfileId, setPromptProfileId] = useState(DEFAULT_SETTINGS.promptProfileId);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [promptProfiles, setPromptProfiles] = useState<ResolvedPromptProfile[]>([]);
  const [translateStatus, setTranslateStatus] = useState<TranslateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);
  const prevConfigRef = useRef<string | null>(null);

  const configVersion = `${targetLanguage}|${selectedModelId ?? ''}|${promptProfileId}`;

  function handleSourceTextChange(value: string) {
    setSourceText(value);
    requestIdRef.current += 1;

    if (!value.trim()) {
      setTranslatedText('');
      setError(null);
      setTranslateStatus('idle');
      return;
    }

    setTranslatedText('');
    setError(null);
    setTranslateStatus('pending');
  }

  const translateText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed) {
        setTranslatedText('');
        setError(null);
        setTranslateStatus('idle');
        return;
      }

      if (models.length === 0) {
        setTranslatedText('');
        setError('请先在设置中添加模型');
        setTranslateStatus('error');
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      setTranslateStatus('translating');
      setError(null);

      const response = await chrome.runtime.sendMessage<
        unknown,
        RuntimeResponse<TranslateTextRuntimeResponse>
      >({
        type: 'TEXT_TRANSLATE',
        payload: {
          text: trimmed,
          targetLanguage,
          modelId: selectedModelId,
          promptProfileId,
        },
      });

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (response.ok) {
        setTranslatedText(response.data.text);
        setError(null);
        setTranslateStatus('done');
      } else {
        setTranslatedText('');
        setError(response.error.message);
        setTranslateStatus('error');
      }
    },
    [models.length, promptProfileId, selectedModelId, targetLanguage],
  );

  useEffect(() => {
    async function loadInitialData() {
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
      }

      if (modelsResponse.ok) {
        const loadedModels = modelsResponse.data.models;
        setModels(loadedModels);
        setSelectedModelId((current) => current ?? loadedModels[0]?.id ?? null);
      }

      if (promptsResponse.ok) {
        setPromptProfiles(promptsResponse.data.profiles);
      }

      setIsReady(true);
    }

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      void translateText(sourceText);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isReady, sourceText, translateText]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (prevConfigRef.current === null) {
      prevConfigRef.current = configVersion;
      return;
    }

    if (prevConfigRef.current === configVersion) {
      return;
    }

    prevConfigRef.current = configVersion;

    if (!sourceText.trim()) {
      return;
    }

    setTranslatedText('');
    setError(null);
    setTranslateStatus('translating');
    void translateText(sourceText);
  }, [configVersion, isReady, sourceText, translateText]);

  const outputContent = (() => {
    if (translateStatus === 'idle') {
      return null;
    }

    if (models.length === 0) {
      return <p className="output-placeholder">请先在设置中添加模型</p>;
    }

    if (translateStatus === 'pending') {
      return <p className="output-status">等待翻译…</p>;
    }

    if (translateStatus === 'translating') {
      return <p className="output-status is-active">翻译中…</p>;
    }

    if (translateStatus === 'error' && error) {
      return <p className="output-error">{error}</p>;
    }

    if (translateStatus === 'done' && translatedText) {
      return <p className="output-text">{translatedText}</p>;
    }

    return null;
  })();

  return (
    <div className="translator-page">
      <header className="translator-header">
        <h1 className="translator-brand">译伴 · 输入翻译</h1>

        <div className="translator-controls">
          <LanguageBar targetLanguage={targetLanguage} onTargetLanguageChange={setTargetLanguage} />

          <div className="control-group">
            <label className="control-label" htmlFor="translator-model">
              翻译服务
            </label>
            <select
              id="translator-model"
              className="control-select"
              value={selectedModelId ?? ''}
              disabled={models.length === 0}
              onChange={(event) => setSelectedModelId(event.target.value || null)}
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

          <div className="control-group">
            <label className="control-label" htmlFor="translator-prompt">
              AI 专家
            </label>
            <select
              id="translator-prompt"
              className="control-select"
              value={promptProfileId}
              onChange={(event) => setPromptProfileId(event.target.value)}
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
      </header>

      <main className={`translator-main${translateStatus === 'translating' ? ' is-translating' : ''}`}>
        <section className="translator-pane translator-pane-input">
          <textarea
            className="translator-textarea"
            placeholder="输入要翻译的文本"
            value={sourceText}
            onChange={(event) => handleSourceTextChange(event.target.value)}
            spellCheck={false}
          />
        </section>

        <div className="translator-divider" aria-hidden="true" />

        <section className="translator-pane translator-pane-output" aria-live="polite">
          {outputContent}
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Translator />);
