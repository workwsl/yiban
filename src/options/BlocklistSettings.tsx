import type { SiteRule } from '../shared/types';

interface BlocklistSettingsProps {
  siteRules: SiteRule[];
  newBlockedDomain: string;
  error: string | null;
  onNewBlockedDomainChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (domain: string) => void;
}

export function BlocklistSettings({
  siteRules,
  newBlockedDomain,
  error,
  onNewBlockedDomainChange,
  onAdd,
  onRemove,
}: BlocklistSettingsProps) {
  return (
    <section className="content-section">
      <header className="content-header">
        <h2>网站黑名单</h2>
        <p className="content-description">加入黑名单的网站将不会自动翻译。</p>
      </header>

      <div className="content-card">
        <div className="inline-form">
          <input
            placeholder="example.com"
            value={newBlockedDomain}
            onChange={(event) => onNewBlockedDomainChange(event.target.value)}
          />
          <button type="button" onClick={onAdd}>
            添加
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="rule-list">
          {siteRules.length === 0 ? <p className="muted">暂无黑名单网站</p> : null}
          {siteRules.map((rule) => (
            <div className="rule-item" key={rule.domain}>
              <span>{rule.domain}</span>
              <button type="button" className="secondary compact" onClick={() => onRemove(rule.domain)}>
                删除
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
