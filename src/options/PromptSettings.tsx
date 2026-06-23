import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultCustomProfile,
  DEFAULT_PROMPTS,
  previewChatMessages,
} from '../shared/prompts';
import type { CustomPromptProfile, PromptLibrary, ResolvedPromptProfile } from '../shared/types';
import { PromptEditorModal } from './PromptEditorModal';

const PREVIEW_SAMPLE_TEXT = 'Install the package with npm install and configure the API key.';
const PREVIEW_TARGET_LANGUAGE = 'zh-CN';

interface PromptSettingsProps {
  library: PromptLibrary;
  profiles: ResolvedPromptProfile[];
  saved: boolean;
  error: string | null;
  onChange: (library: PromptLibrary) => void;
  onSave: () => void;
  onResetProfile: (profileId: string) => void;
  onResetAll: () => void;
  onAddProfile: (profile: Omit<CustomPromptProfile, 'id' | 'createdAt'>) => Promise<boolean>;
  onDeleteProfile: (profileId: string) => void;
}

function getActiveProfile(profiles: ResolvedPromptProfile[], activeProfileId: string): ResolvedPromptProfile {
  return profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
}

export function PromptSettings({
  library,
  profiles,
  saved,
  error,
  onChange,
  onSave,
  onResetProfile,
  onResetAll,
  onAddProfile,
  onDeleteProfile,
}: PromptSettingsProps) {
  const [activeProfileId, setActiveProfileId] = useState(profiles[0]?.id ?? 'general');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [draftProfile, setDraftProfile] = useState<CustomPromptProfile>(() => createDefaultCustomProfile(''));
  const previousProfileCountRef = useRef(profiles.length);

  const activeProfile = getActiveProfile(profiles, activeProfileId);
  const styleOverride = library.overrides[activeProfile.id];
  const isCustomized = Boolean(styleOverride?.systemPrompt || styleOverride?.userPromptTemplate);

  const previewMessages = useMemo(
    () => previewChatMessages(activeProfile.id, library, PREVIEW_SAMPLE_TEXT, PREVIEW_TARGET_LANGUAGE),
    [activeProfile.id, library],
  );

  useEffect(() => {
    if (!profiles.some((profile) => profile.id === activeProfileId)) {
      setActiveProfileId(profiles[0]?.id ?? 'general');
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    if (profiles.length > previousProfileCountRef.current) {
      const customProfiles = profiles.filter((profile) => !profile.isBuiltIn);
      const newestProfile = customProfiles[customProfiles.length - 1];

      if (newestProfile) {
        setActiveProfileId(newestProfile.id);
      }
    }

    previousProfileCountRef.current = profiles.length;
  }, [profiles]);

  function updateCustomProfileField(
    profileId: string,
    field: 'name' | 'systemPrompt' | 'userPromptTemplate',
    value: string,
  ): void {
    onChange({
      ...library,
      customProfiles: library.customProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, [field]: value } : profile,
      ),
    });
  }

  function updateOverrideField(field: 'systemPrompt' | 'userPromptTemplate', value: string): void {
    const defaults = activeProfile.isBuiltIn
      ? DEFAULT_PROMPTS[activeProfile.id as 'general' | 'technical']
      : library.customProfiles.find((profile) => profile.id === activeProfile.id);
    const currentOverride = library.overrides[activeProfile.id] ?? {};
    const nextOverride = { ...currentOverride, [field]: value };
    const nextOverrides = { ...library.overrides };

    if (defaults && value.trim() === defaults[field].trim()) {
      delete nextOverride[field];
    }

    if (Object.keys(nextOverride).length === 0) {
      delete nextOverrides[activeProfile.id];
    } else {
      nextOverrides[activeProfile.id] = nextOverride;
    }

    onChange({
      ...library,
      overrides: nextOverrides,
    });
  }

  function updatePromptField(field: 'systemPrompt' | 'userPromptTemplate', value: string): void {
    if (activeProfile.isBuiltIn) {
      updateOverrideField(field, value);
      return;
    }

    updateCustomProfileField(activeProfile.id, field, value);
  }

  function openCreateModal(): void {
    setDraftProfile(createDefaultCustomProfile(''));
    setModalError(null);
    setModalOpen(true);
  }

  async function handleCreateProfile(): Promise<void> {
    const name = draftProfile.name.trim();
    const systemPrompt = draftProfile.systemPrompt.trim();
    const userPromptTemplate = draftProfile.userPromptTemplate.trim();

    if (!name || !systemPrompt || !userPromptTemplate) {
      setModalError('请填写专家名称、System 提示词和 User 模板。');
      return;
    }

    const created = await onAddProfile({
      name,
      systemPrompt,
      userPromptTemplate,
    });

    if (created) {
      setModalOpen(false);
      setModalError(null);
    }
  }

  function handleDeleteProfile(profileId: string): void {
    const profile = profiles.find((item) => item.id === profileId);

    if (!profile || profile.isBuiltIn) {
      return;
    }

    if (!window.confirm(`确定删除专家「${profile.name}」吗？`)) {
      return;
    }

    onDeleteProfile(profileId);

    if (activeProfileId === profileId) {
      setActiveProfileId('general');
    }
  }

  return (
    <>
      <section className="content-section">
        <header className="content-header content-header-row">
          <div>
            <h2>提示词设置</h2>
            <p className="content-description">
              管理通用、技术文档与自定义专家提示词。Popup 中的「AI 专家」或通用设置中的「翻译风格」决定实际使用哪一套。
            </p>
          </div>
          <button type="button" onClick={openCreateModal}>
            + 添加专家
          </button>
        </header>

        <div className="prompt-profile-list" role="tablist" aria-label="专家档案">
          {profiles.map((profile) => (
            <div key={profile.id} className="prompt-profile-item">
              <button
                type="button"
                role="tab"
                aria-selected={activeProfileId === profile.id}
                className={`prompt-tab${activeProfileId === profile.id ? ' is-active' : ''}`}
                onClick={() => setActiveProfileId(profile.id)}
              >
                {profile.name}
              </button>
              {!profile.isBuiltIn ? (
                <button
                  type="button"
                  className="prompt-delete-btn secondary compact"
                  aria-label={`删除 ${profile.name}`}
                  onClick={() => handleDeleteProfile(profile.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="content-card prompt-editor-card">
          <div className="prompt-editor-meta">
            <span className={`prompt-badge${isCustomized ? ' is-custom' : ''}`}>
              {activeProfile.isBuiltIn
                ? isCustomized
                  ? '内置 · 已自定义'
                  : '内置 · 使用默认'
                : '自定义专家'}
            </span>
          </div>

          {!activeProfile.isBuiltIn ? (
            <label>
              专家名称
              <input
                value={activeProfile.name}
                onChange={(event) => updateCustomProfileField(activeProfile.id, 'name', event.target.value)}
              />
            </label>
          ) : null}

          <label>
            System 提示词
            <textarea
              className="prompt-textarea"
              rows={8}
              value={activeProfile.systemPrompt}
              onChange={(event) => updatePromptField('systemPrompt', event.target.value)}
            />
          </label>

          <label>
            User 模板
            <textarea
              className="prompt-textarea"
              rows={5}
              value={activeProfile.userPromptTemplate}
              onChange={(event) => updatePromptField('userPromptTemplate', event.target.value)}
            />
          </label>

          <div className="prompt-vars">
            <span className="prompt-vars-label">可用变量：</span>
            <code>{'{{targetLanguage}}'}</code>
            <code>{'{{text}}'}</code>
          </div>

          <div className="prompt-preview">
            <button
              type="button"
              className="prompt-preview-toggle secondary"
              onClick={() => setPreviewOpen((open) => !open)}
            >
              {previewOpen ? '收起预览' : '展开预览'}
            </button>

            {previewOpen ? (
              <div className="prompt-preview-body">
                <p className="prompt-preview-note">
                  示例：将「{PREVIEW_SAMPLE_TEXT}」翻译为 {PREVIEW_TARGET_LANGUAGE}
                </p>
                {previewMessages.map((message) => (
                  <div key={message.role} className="prompt-preview-block">
                    <div className="prompt-preview-role">{message.role === 'system' ? 'System' : 'User'}</div>
                    <pre className="prompt-preview-content">{message.content}</pre>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p className="error">{error}</p> : null}
          {saved ? <p className="saved">已保存</p> : null}

          <div className="prompt-actions">
            <button type="button" onClick={onSave}>
              保存
            </button>
            <button type="button" className="secondary" onClick={() => onResetProfile(activeProfile.id)}>
              恢复当前专家默认
            </button>
            <button type="button" className="secondary" onClick={onResetAll}>
              恢复全部默认
            </button>
          </div>
        </div>
      </section>

      <PromptEditorModal
        open={modalOpen}
        profile={draftProfile}
        error={modalError}
        onChange={setDraftProfile}
        onSave={() => void handleCreateProfile()}
        onClose={() => {
          setModalOpen(false);
          setModalError(null);
        }}
      />
    </>
  );
}
