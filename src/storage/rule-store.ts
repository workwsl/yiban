import type { SiteRule } from '../shared/types';

const SITE_RULES_KEY = 'yiban.siteRules';

export async function getSiteRules(): Promise<SiteRule[]> {
  const result = await chrome.storage.local.get(SITE_RULES_KEY);
  return (result[SITE_RULES_KEY] as SiteRule[] | undefined) ?? [];
}

export async function saveSiteRules(rules: SiteRule[]): Promise<SiteRule[]> {
  const normalized = rules
    .map((rule) => ({
      domain: rule.domain.trim().toLowerCase(),
      rule: rule.rule,
    }))
    .filter((rule) => rule.domain.length > 0);

  await chrome.storage.local.set({ [SITE_RULES_KEY]: normalized });
  return normalized;
}
