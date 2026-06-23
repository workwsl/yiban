export type OptionsSection = 'general' | 'models' | 'blocklist' | 'prompts';

export const OPTIONS_SECTIONS: { id: OptionsSection; label: string }[] = [
  { id: 'general', label: '通用设置' },
  { id: 'prompts', label: '提示词设置' },
  { id: 'models', label: '模型配置' },
  { id: 'blocklist', label: '网站黑名单' },
];

export function parseSectionFromHash(): OptionsSection {
  const hash = window.location.hash.replace('#', '');

  if (hash === 'models' || hash === 'blocklist' || hash === 'general' || hash === 'prompts') {
    return hash;
  }

  return 'general';
}
