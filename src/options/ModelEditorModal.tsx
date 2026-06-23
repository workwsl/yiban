import { useEffect } from 'react';
import type { ModelConfig } from '../shared/types';
import { ModelEditor } from './ModelEditor';

interface ModelEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  model: ModelConfig;
  testResult: string | null;
  error: string | null;
  onChange: (model: ModelConfig) => void;
  onSave: () => void;
  onTest: () => void;
  onClose: () => void;
}

export function ModelEditorModal({
  open,
  mode,
  model,
  testResult,
  error,
  onChange,
  onSave,
  onTest,
  onClose,
}: ModelEditorModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h3 id="model-editor-title">{mode === 'create' ? '添加模型' : '编辑模型'}</h3>
          <button type="button" className="modal-close secondary compact" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="modal-body">
          <ModelEditor key={model.id} model={model} onChange={onChange} />
          {error ? <p className="error">{error}</p> : null}
          {testResult ? <p className="saved">{testResult}</p> : null}
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="secondary" onClick={onTest}>
            测试连接
          </button>
          <button type="button" onClick={onSave}>
            保存模型
          </button>
        </footer>
      </div>
    </div>
  );
}
