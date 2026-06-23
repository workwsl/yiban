import { useState } from 'react';
import type { ModelConfig, ModelProvider } from '../shared/types';

interface ModelEditorProps {
  model: ModelConfig;
  onChange: (model: ModelConfig) => void;
}

export function ModelEditor({ model, onChange }: ModelEditorProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="model-editor-form">
      <label>
        名称
        <input
          value={model.name}
          onChange={(event) => onChange({ ...model, name: event.target.value })}
        />
      </label>

      <label>
        Provider
        <select
          value={model.provider}
          onChange={(event) => onChange({ ...model, provider: event.target.value as ModelProvider })}
        >
          <option value="deepseek">DeepSeek</option>
          <option value="qwen">Qwen</option>
          <option value="openai-compatible">OpenAI-compatible</option>
        </select>
      </label>

      <label>
        Base URL
        <input
          value={model.baseUrl}
          onChange={(event) => onChange({ ...model, baseUrl: event.target.value })}
        />
      </label>

      <label>
        Model Name
        <input
          value={model.model}
          onChange={(event) => onChange({ ...model, model: event.target.value })}
        />
      </label>

      <label>
        API Key
        <div className="password-field">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={model.apiKey}
            onChange={(event) => onChange({ ...model, apiKey: event.target.value })}
          />
          <button type="button" className="secondary compact" onClick={() => setShowApiKey((value) => !value)}>
            {showApiKey ? '隐藏' : '显示'}
          </button>
        </div>
      </label>

      <div className="grid">
        <label>
          超时毫秒
          <input
            type="number"
            value={model.timeoutMs}
            onChange={(event) => onChange({ ...model, timeoutMs: Number(event.target.value) })}
          />
        </label>

        <label>
          最大并发
          <input
            type="number"
            value={model.maxConcurrency}
            onChange={(event) => onChange({ ...model, maxConcurrency: Number(event.target.value) })}
          />
        </label>

        <label>
          单次字符数
          <input
            type="number"
            value={model.maxCharsPerRequest}
            onChange={(event) => onChange({ ...model, maxCharsPerRequest: Number(event.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
