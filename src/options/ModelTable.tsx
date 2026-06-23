import { useState } from 'react';
import type { ModelConfig } from '../shared/types';

type ModelTestOutcome = { ok: true; message: string } | { ok: false; message: string };

interface ModelTableProps {
  models: ModelConfig[];
  defaultModelId: string | null;
  onEdit: (model: ModelConfig) => void;
  onSetDefault: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onTest: (model: ModelConfig) => Promise<ModelTestOutcome>;
}

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  'openai-compatible': 'OpenAI-compatible',
};

export function ModelTable({ models, defaultModelId, onEdit, onSetDefault, onDelete, onTest }: ModelTableProps) {
  const [visibleApiKeyIds, setVisibleApiKeyIds] = useState<Set<string>>(() => new Set());
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>(
    {},
  );

  function toggleApiKeyVisibility(modelId: string): void {
    setVisibleApiKeyIds((current) => {
      const next = new Set(current);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }

  async function handleTest(model: ModelConfig): Promise<void> {
    if (testingModelId) {
      return;
    }

    setTestingModelId(model.id);
    setTestFeedback((current) => {
      const next = { ...current };
      delete next[model.id];
      return next;
    });

    const result = await onTest(model);

    setTestingModelId(null);
    setTestFeedback((current) => ({
      ...current,
      [model.id]: {
        type: result.ok ? 'success' : 'error',
        message: result.message,
      },
    }));
  }

  if (models.length === 0) {
    return <p className="muted">暂无模型，请点击「添加模型」创建。</p>;
  }

  return (
    <div className="model-table-wrap">
      <table className="model-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>Provider</th>
            <th>Model</th>
            <th>API Key</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => {
            const isDefault = model.id === defaultModelId;
            const showApiKey = visibleApiKeyIds.has(model.id);
            const isTesting = testingModelId === model.id;
            const feedback = testFeedback[model.id];

            return (
              <tr key={model.id}>
                <td>{model.name}</td>
                <td>{PROVIDER_LABELS[model.provider] ?? model.provider}</td>
                <td>{model.model || '—'}</td>
                <td className="api-key-col">
                  <div className="api-key-cell">
                    <div className="api-key-value-wrap">
                      {model.apiKey ? (
                        showApiKey ? (
                          <span className="api-key-value">{model.apiKey}</span>
                        ) : (
                          <span className="api-key-masked">••••••••</span>
                        )
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                    {model.apiKey ? (
                      <button
                        type="button"
                        className="link-button api-key-toggle"
                        onClick={() => toggleApiKeyVisibility(model.id)}
                      >
                        {showApiKey ? '隐藏' : '显示'}
                      </button>
                    ) : null}
                  </div>
                </td>
                <td>{isDefault ? <span className="model-badge">使用中</span> : '—'}</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="link-button" onClick={() => onEdit(model)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      disabled={Boolean(testingModelId)}
                      onClick={() => void handleTest(model)}
                    >
                      {isTesting ? '测试中...' : '测试'}
                    </button>
                    {!isDefault ? (
                      <button type="button" className="link-button" onClick={() => onSetDefault(model.id)}>
                        设为默认
                      </button>
                    ) : null}
                    <button type="button" className="link-button danger" onClick={() => onDelete(model.id)}>
                      删除
                    </button>
                  </div>
                  {feedback ? (
                    <p className={`test-feedback ${feedback.type}`}>{feedback.message}</p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
