import { useEffect } from 'react';
import type { CustomPromptProfile } from '../shared/types';

interface PromptEditorModalProps {
  open: boolean;
  profile: CustomPromptProfile;
  error: string | null;
  onChange: (profile: CustomPromptProfile) => void;
  onSave: () => void;
  onClose: () => void;
}

export function PromptEditorModal({
  open,
  profile,
  error,
  onChange,
  onSave,
  onClose,
}: PromptEditorModalProps) {
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
        aria-labelledby="prompt-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h3 id="prompt-editor-title">添加专家</h3>
          <button type="button" className="modal-close secondary compact" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="modal-body">
          <label>
            专家名称
            <input
              value={profile.name}
              onChange={(event) => onChange({ ...profile, name: event.target.value })}
              placeholder="例如：学术翻译"
            />
          </label>

          <label>
            System 提示词
            <textarea
              className="prompt-textarea"
              rows={8}
              value={profile.systemPrompt}
              onChange={(event) => onChange({ ...profile, systemPrompt: event.target.value })}
            />
          </label>

          <label>
            User 模板
            <textarea
              className="prompt-textarea"
              rows={5}
              value={profile.userPromptTemplate}
              onChange={(event) => onChange({ ...profile, userPromptTemplate: event.target.value })}
            />
          </label>

          <div className="prompt-vars">
            <span className="prompt-vars-label">可用变量：</span>
            <code>{'{{targetLanguage}}'}</code>
            <code>{'{{text}}'}</code>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" onClick={onSave}>
            创建专家
          </button>
        </footer>
      </div>
    </div>
  );
}
