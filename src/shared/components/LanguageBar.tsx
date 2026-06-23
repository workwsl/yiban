import './language-bar.css';

const TARGET_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

interface LanguageBarProps {
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
}

export function LanguageBar({ targetLanguage, onTargetLanguageChange }: LanguageBarProps) {
  const hasPreset = TARGET_LANGUAGES.some((lang) => lang.value === targetLanguage);

  return (
    <div className="lang-bar">
      <div className="lang-cell is-static">
        <span className="lang-cell-label">原文语言</span>
        <span className="lang-cell-value">自动检测</span>
      </div>

      <span className="lang-arrow" aria-hidden="true">
        →
      </span>

      <div className="lang-cell">
        <span className="lang-cell-label">目标语言</span>
        <select
          className="lang-select"
          value={hasPreset ? targetLanguage : 'zh-CN'}
          onChange={(event) => onTargetLanguageChange(event.target.value)}
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
