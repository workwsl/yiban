import type { ModelConfig } from '../shared/types';
import { ModelTable } from './ModelTable';

interface ModelSettingsProps {
  models: ModelConfig[];
  defaultModelId: string | null;
  defaultModelName: string;
  saved: boolean;
  onAdd: () => void;
  onEdit: (model: ModelConfig) => void;
  onSetDefault: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onTest: (model: ModelConfig) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
}

export function ModelSettings({
  models,
  defaultModelId,
  defaultModelName,
  saved,
  onAdd,
  onEdit,
  onSetDefault,
  onDelete,
  onTest,
}: ModelSettingsProps) {
  return (
    <section className="content-section">
      <header className="content-header content-header-row">
        <div>
          <h2>模型配置</h2>
          <p className="content-description">管理翻译 API 模型，当前使用：{defaultModelName}</p>
        </div>
        <button type="button" onClick={onAdd}>
          + 添加模型
        </button>
      </header>

      <div className="content-card">
        {saved ? <p className="saved">已保存</p> : null}
        <ModelTable
          models={models}
          defaultModelId={defaultModelId}
          onEdit={onEdit}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
          onTest={onTest}
        />
      </div>
    </section>
  );
}
