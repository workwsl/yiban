import {
  isBreadcrumbItem,
  isDirectoryListItem,
  isDirectoryOrSidebarItem,
  isElementDisplayed,
  isInMenuUi,
  isMenuListItem,
  isSidebarDirectoryContext,
  isTopLevelNavBarItem,
} from './visibility';

const NAV_CONTEXT_SELECTOR = 'nav, header, [role="navigation"], [role="banner"]';
const META_CONTEXT_SELECTOR = 'aside, [role="complementary"], [data-testid*="metadata"], [class*="meta"]';

const BLOCK_TAGS = new Set([
  'P',
  'LI',
  'BLOCKQUOTE',
  'TD',
  'TH',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'DT',
  'DD',
  'FIGCAPTION',
]);

const INLINE_TAGS = new Set(['A', 'LABEL', 'SPAN', 'FONT']);
const NAV_LABEL_MAX_LENGTH = 32;

export type HostMode = 'block' | 'inline' | 'navLabel' | 'navMenu' | 'meta';

export interface TranslationHost {
  element: HTMLElement;
  mode: HostMode;
}

export interface SniffHostsOptions {
  deadline?: IdleDeadline;
  isSkippableText?: (text: string) => boolean;
  shouldSkipHost?: (element: HTMLElement) => boolean;
  shouldRejectTextNode?: (node: Node) => boolean;
}

function isNavContext(element: HTMLElement): boolean {
  return element.closest(NAV_CONTEXT_SELECTOR) !== null;
}

function isMetaContext(element: HTMLElement): boolean {
  return element.closest(META_CONTEXT_SELECTOR) !== null;
}

function isCompactText(text: string): boolean {
  return text.trim().length <= 48;
}

function hasBlockDescendant(element: HTMLElement): boolean {
  for (const tag of BLOCK_TAGS) {
    if (element.querySelector(tag.toLowerCase()) !== null) {
      return true;
    }
  }

  return false;
}

function findBodyBlockHost(textNode: Node): HTMLElement | null {
  let current = textNode.parentElement;

  while (current && current !== document.body) {
    if (BLOCK_TAGS.has(current.tagName)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findInlineContainer(textNode: Node): HTMLElement | null {
  let current = textNode.parentElement;

  while (current && current !== document.body) {
    if (INLINE_TAGS.has(current.tagName)) {
      return current;
    }

    if (current.tagName === 'DIV' && !hasBlockDescendant(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function isMenuHeadingHost(element: HTMLElement): boolean {
  if (!BLOCK_TAGS.has(element.tagName)) {
    return false;
  }

  if (!['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
    return false;
  }

  return isInMenuUi(element) && element.closest('article, main, [role="main"]') === null;
}

function shouldUseBodyBlockHost(element: HTMLElement): boolean {
  if (!BLOCK_TAGS.has(element.tagName)) {
    return false;
  }

  if (isInMenuUi(element)) {
    return false;
  }

  if (element.tagName === 'LI' && isMenuListItem(element)) {
    return false;
  }

  if (element.tagName === 'LI' && isDirectoryOrSidebarItem(element)) {
    return false;
  }

  if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
    if (element.closest('nav, header, [role="navigation"], [role="menu"]') !== null) {
      return element.closest('article, main, [role="main"]') !== null;
    }
  }

  return true;
}

export function isSplitTextContainer(element: HTMLElement): boolean {
  const spans = [...element.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.tagName === 'SPAN' &&
      (child.textContent?.trim().length ?? 0) <= 2,
  );

  return spans.length >= 3;
}

const SPLIT_TEXT_TOKEN_CLASS_PATTERN = /\b(word|char|line|token|split)\b/i;

function isSplitTextTokenElement(child: HTMLElement): boolean {
  if (child.getAttribute('aria-hidden') !== 'true') {
    return false;
  }

  if (child.tagName !== 'DIV' && child.tagName !== 'SPAN') {
    return false;
  }

  if (SPLIT_TEXT_TOKEN_CLASS_PATTERN.test(String(child.className))) {
    return true;
  }

  const style = child.style;

  if (style.display === 'inline-block' || style.display === 'inline') {
    return true;
  }

  return (child.textContent?.trim().length ?? 0) <= 24;
}

export function isAnimatedSplitTextBlock(element: HTMLElement): boolean {
  const directChildren = [...element.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (directChildren.length < 2) {
    return false;
  }

  const hiddenTokens = directChildren.filter(isSplitTextTokenElement);

  if (hiddenTokens.length >= 2) {
    return true;
  }

  const ariaLabel = element.getAttribute('aria-label')?.trim();

  if (ariaLabel && directChildren.some((child) => child.getAttribute('aria-hidden') === 'true')) {
    return true;
  }

  return false;
}

function resolveInlineHostMode(element: HTMLElement, text: string): HostMode {
  const normalizedText = text.trim();

  if (isBreadcrumbItem(element)) {
    return 'inline';
  }

  if (isDirectoryListItem(element) || isSidebarDirectoryContext(element)) {
    return isCompactText(normalizedText) ? 'meta' : 'inline';
  }

  if (isNavContext(element) && isTopLevelNavBarItem(element) && normalizedText.length <= NAV_LABEL_MAX_LENGTH) {
    return 'navLabel';
  }

  if (isNavContext(element) && isTopLevelNavBarItem(element)) {
    return 'inline';
  }

  if (isInMenuUi(element)) {
    return 'navMenu';
  }

  if (isMetaContext(element) && isCompactText(normalizedText)) {
    return 'meta';
  }

  return 'inline';
}

export function resolveHostForTextNode(textNode: Node): TranslationHost | null {
  const blockHost = findBodyBlockHost(textNode);

  if (blockHost) {
    if (shouldUseBodyBlockHost(blockHost)) {
      const parent = blockHost.parentElement;

      if (parent && isSplitTextContainer(parent)) {
        return { element: parent, mode: 'navLabel' };
      }

      return { element: blockHost, mode: 'block' };
    }

    if (isMenuHeadingHost(blockHost)) {
      return { element: blockHost, mode: 'navMenu' };
    }
  }

  const inlineHost = findInlineContainer(textNode);

  if (!inlineHost) {
    return null;
  }

  const parent = inlineHost.parentElement;

  if (parent && isSplitTextContainer(parent)) {
    return { element: parent, mode: 'navLabel' };
  }

  const text = inlineHost.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  return {
    element: inlineHost,
    mode: resolveInlineHostMode(inlineHost, text),
  };
}

export function resolveHostConflicts(hosts: TranslationHost[]): TranslationHost[] {
  const unique = new Map<HTMLElement, TranslationHost>();

  for (const host of hosts) {
    unique.set(host.element, host);
  }

  const list = [...unique.values()];

  return list.filter(
    (host) =>
      !list.some((other) => {
        if (other === host || other.element === host.element) {
          return false;
        }

        if (!other.element.contains(host.element)) {
          return false;
        }

        return other.mode === 'block' || other.mode === 'navLabel';
      }),
  );
}

export function isInsideMarkedHost(node: Node): boolean {
  let current: Node | null = node.parentNode;

  while (current && current instanceof HTMLElement) {
    if (current.dataset.yibanHost === '1' || current.dataset.yibanTranslated === 'true') {
      return true;
    }

    current = current.parentNode;
  }

  return false;
}

function normalizeSniffRoot(root: Node): HTMLElement | null {
  if (root instanceof HTMLElement) {
    return root;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    return root.parentElement;
  }

  if (root.nodeType === Node.DOCUMENT_NODE) {
    return document.body;
  }

  return null;
}

export function sniffTranslationHosts(
  root: Node = document.body,
  options: SniffHostsOptions = {},
): { hosts: TranslationHost[]; incomplete: boolean } {
  const walkRoot = normalizeSniffRoot(root);

  if (!walkRoot) {
    return { hosts: [], incomplete: false };
  }

  const isSkippable = options.isSkippableText ?? (() => false);
  const shouldSkip = options.shouldSkipHost ?? (() => false);
  const rejectTextNode = options.shouldRejectTextNode ?? (() => false);
  const candidates: TranslationHost[] = [];
  const seenElements = new Set<HTMLElement>();
  let incomplete = false;

  const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (
        rejectTextNode(node) ||
        isInsideMarkedHost(node) ||
        isSkippable(node.textContent ?? '')
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      const host = resolveHostForTextNode(node);

      if (!host || !isElementDisplayed(host.element) || shouldSkip(host.element)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  let processed = 0;

  while (current) {
    if (options.deadline && processed > 0 && options.deadline.timeRemaining() < 1) {
      incomplete = true;
      break;
    }

    const host = resolveHostForTextNode(current);

    if (host && !seenElements.has(host.element)) {
      seenElements.add(host.element);
      candidates.push(host);
    }

    processed += 1;
    current = walker.nextNode();
  }

  return { hosts: resolveHostConflicts(candidates), incomplete };
}

export function markTranslationHost(host: TranslationHost): void {
  if (host.element.dataset.yibanTranslated === 'true') {
    return;
  }

  host.element.dataset.yibanHost = '1';
  host.element.dataset.yibanHostMode = host.mode;
}

export function markTranslationHosts(hosts: TranslationHost[]): void {
  for (const host of hosts) {
    markTranslationHost(host);
  }
}

export function clearTranslationHostMarks(): void {
  document.querySelectorAll('[data-yiban-host="1"]').forEach((node) => {
    if (node instanceof HTMLElement) {
      delete node.dataset.yibanHost;
      delete node.dataset.yibanHostMode;
    }
  });
}

export function isBodyBlockHost(element: HTMLElement): boolean {
  return BLOCK_TAGS.has(element.tagName) && shouldUseBodyBlockHost(element);
}

export function hostModeToRenderClass(mode: HostMode): string {
  switch (mode) {
    case 'block':
      return 'bodyBlock';
    case 'navLabel':
      return 'navLabel';
    case 'navMenu':
      return 'navMenuInline';
    case 'meta':
      return 'metaInline';
    case 'inline':
      return 'bodyInline';
  }
}
