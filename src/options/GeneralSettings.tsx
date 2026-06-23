import type { ResolvedPromptProfile, UserSettings } from '../shared/types';

interface GeneralSettingsProps {
  settings: UserSettings;
  profiles: ResolvedPromptProfile[];
  saved: boolean;
  error: string | null;
  onChange: (settings: UserSettings) => void;
  onSave: () => void;
}

export function GeneralSettings({
  settings,
  profiles,
  saved,
  error,
  onChange,
  onSave,
}: GeneralSettingsProps) {
  return (
    <section className="content-section">
      <header className="content-header">
        <h2>通用设置</h2>
        <p className="content-description">配置默认翻译语言与翻译行为。</p>
      </header>

      <div className="content-card">
        <label>
          默认目标语言
          <input
            value={settings.defaultTargetLanguage}
            onChange={(event) =>
              onChange({
                ...settings,
                defaultTargetLanguage: event.target.value,
              })
            }
          />
        </label>

        <label>
          翻译风格
          <select
            value={settings.promptProfileId}
            onChange={(event) =>
              onChange({
                ...settings,
                promptProfileId: event.target.value,
              })
            }
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <a className="settings-link" href="#prompts">
            前往提示词设置 →
          </a>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.cacheEnabled}
            onChange={(event) =>
              onChange({
                ...settings,
                cacheEnabled: event.target.checked,
              })
            }
          />
          启用翻译缓存
        </label>

        {error ? <p className="error">{error}</p> : null}
        {saved ? <p className="saved">已保存</p> : null}

        <button type="button" onClick={onSave}>
          保存设置
        </button>
      </div>
    </section>
  );
}
