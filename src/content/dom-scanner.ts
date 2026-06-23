import type { TranslationSegment } from '../shared/types';
import {
  clearTranslationHostMarks,
  hostModeToRenderClass,
  isAnimatedSplitTextBlock,
  isBodyBlockHost,
  isSplitTextContainer,
  markTranslationHost,
  resolveHostConflicts,
  sniffTranslationHosts,
  type HostMode,
  type TranslationHost,
} from './host-sniffer';
import { isElementDisplayed } from './visibility';

const EXCLUDED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'PRE',
  'CODE',
  'KBD',
  'SAMP',
  'SVG',
  'CANVAS',
  'TEMPLATE',
]);

const NAV_CONTEXT_SELECTOR = 'header, nav, [role="navigation"], [role="banner"]';

const BLOCK_HEADING = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

export interface ScannedSegment extends TranslationSegment {
  element: HTMLElement;
  hostMode?: HostMode;
}

export interface DiscoverHostsOptions {
  markHosts?: boolean;
  deadline?: IdleDeadline;
}

const hostRegistry = new Map<HTMLElement, ScannedSegment>();

function isCssLikeText(text: string): boolean {
  const normalized = text.trim();
  return /^[@.{#[]/.test(normalized) && normalized.includes('{') && normalized.includes(':');
}

export function isCssLikeSegmentText(text: string): boolean {
  return isCssLikeText(text);
}

function isSkippableText(text: string): boolean {
  const normalized = text.trim();

  if (isCssLikeText(normalized)) {
    return true;
  }

  if (normalized.length < 3) {
    if (normalized.length > 0 && /^[/|·>\-–—]+$/.test(normalized)) {
      return true;
    }

    return normalized.length < 3;
  }

  if (/^\d+([.,:/-]\d+)*$/.test(normalized)) {
    return true;
  }

  if (/^https?:\/\/\S+$/i.test(normalized) || /^www\.\S+$/i.test(normalized)) {
    return true;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return true;
  }

  return false;
}

function isVisible(element: HTMLElement): boolean {
  return isElementDisplayed(element);
}

function isOwnedElement(element: HTMLElement): boolean {
  return (
    element.dataset.yibanOwned === 'true' ||
    element.classList.contains('notranslate') ||
    element.classList.contains('yiban-target-wrapper') ||
    element.classList.contains('yiban-target-loading') ||
    element.classList.contains('yiban-loading-spinner') ||
    element.classList.contains('yiban-target-inner') ||
    element.classList.contains('yiban-translation-wrapper') ||
    element.classList.contains('yiban-translation-inline') ||
    element.classList.contains('yiban-translation-block')
  );
}

function hasExcludedAncestor(node: Node): boolean {
  let current: Node | null = node.parentNode;

  while (current && current instanceof HTMLElement) {
    if (EXCLUDED_TAGS.has(current.tagName)) {
      return true;
    }

    if (current.isContentEditable) {
      return true;
    }

    if (isOwnedElement(current)) {
      return true;
    }

    if (current.dataset.yibanHost === '1' || current.dataset.yibanTranslated === 'true') {
      return true;
    }

    current = current.parentNode;
  }

  return false;
}

function isNavigationContext(element: HTMLElement): boolean {
  return element.closest(NAV_CONTEXT_SELECTOR) !== null;
}

function shouldSkipHost(element: HTMLElement): boolean {
  if (element.tagName === 'BUTTON' && !isNavigationContext(element)) {
    return true;
  }

  if (element.getAttribute('role') === 'button' && !isNavigationContext(element)) {
    return true;
  }

  if (isOwnedElement(element)) {
    return true;
  }

  if (element.dataset.yibanTranslated === 'true') {
    return true;
  }

  if (element.closest('[data-yiban-owned="true"]') !== null && element.dataset.yibanHost !== '1') {
    return true;
  }

  return false;
}

function isTextNodeUnderOwnedSubtree(node: Node, host: HTMLElement): boolean {
  let current: Node | null = node.parentNode;

  while (current && current !== host) {
    if (current instanceof HTMLElement && isOwnedElement(current)) {
      return true;
    }

    current = current.parentNode;
  }

  return false;
}

function isTextNodeUnderNestedHost(node: Node, host: HTMLElement): boolean {
  let current: Node | null = node.parentNode;

  while (current && current !== host) {
    if (current instanceof HTMLElement && current.dataset.yibanHost === '1') {
      return true;
    }

    current = current.parentNode;
  }

  return false;
}

function getHostTextSkipRoots(host: HTMLElement): HTMLElement[] {
  const selectors = [
    ':scope > [role="menu"]',
    ':scope > [role="menu"][aria-hidden="true"]',
    ':scope > [role="listbox"]',
    ':scope > [role="dialog"]',
    ':scope > [role="dialog"][aria-hidden="true"]',
    ':scope > [data-state]',
    ':scope > .mega-menu',
  ];

  if (host.closest('nav, header, [role="navigation"]')) {
    selectors.push(':scope > ul', ':scope > ol');
  }

  const roots: HTMLElement[] = [];

  for (const selector of selectors) {
    host.querySelectorAll(selector).forEach((node) => {
      if (node instanceof HTMLElement) {
        roots.push(node);
      }
    });
  }

  return roots;
}

function isTextNodeUnderSkipRoots(node: Node, host: HTMLElement, skipRoots: HTMLElement[]): boolean {
  if (isTextNodeUnderOwnedSubtree(node, host) || isTextNodeUnderNestedHost(node, host)) {
    return true;
  }

  return skipRoots.some((root) => root !== host && root.contains(node));
}

function getAccessibleTextFallback(host: HTMLElement): string {
  return host.getAttribute('aria-label')?.trim() ?? host.getAttribute('title')?.trim() ?? '';
}

export function extractHostText(host: HTMLElement): string {
  const skipRoots = getHostTextSkipRoots(host);
  const parts: string[] = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (hasExcludedAncestor(node) || isTextNodeUnderSkipRoots(node, host, skipRoots)) {
        return NodeFilter.FILTER_REJECT;
      }

      const text = node.textContent ?? '';

      if (!text.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();

  while (current) {
    parts.push((current.textContent ?? '').replace(/\s+/g, ' ').trim());
    current = walker.nextNode();
  }

  const walked = parts.join(' ').replace(/\s+/g, ' ').trim();

  if (walked) {
    return walked;
  }

  if (isAnimatedSplitTextBlock(host) || BLOCK_HEADING.has(host.tagName)) {
    return getAccessibleTextFallback(host);
  }

  return '';
}

export { isBodyBlockHost, isSplitTextContainer, hostModeToRenderClass };
export type { HostMode };

function createSegment(host: HTMLElement, text: string, hostMode: HostMode, index: number): ScannedSegment {
  return {
    id: `seg_${index}_${Date.now()}`,
    text,
    element: host,
    hostMode,
  };
}

function sniffOptions(options: DiscoverHostsOptions) {
  return {
    deadline: options.deadline,
    isSkippableText,
    shouldSkipHost,
    shouldRejectTextNode: hasExcludedAncestor,
  };
}

function sniffFromRoot(root: Node, options: DiscoverHostsOptions): { hosts: TranslationHost[]; incomplete: boolean } {
  return sniffTranslationHosts(root, sniffOptions(options));
}

function hostsToSegments(hosts: TranslationHost[], options: DiscoverHostsOptions): ScannedSegment[] {
  const segments: ScannedSegment[] = [];

  for (const host of hosts) {
    const text = extractHostText(host.element);

    if (isSkippableText(text)) {
      continue;
    }

    if (options.markHosts !== false) {
      markTranslationHost(host);
    }

    const segment = createSegment(host.element, text, host.mode, segments.length + 1);
    hostRegistry.set(host.element, segment);
    segments.push(segment);
  }

  return segments;
}

function normalizeRoots(roots: Node | Iterable<Node>): Node[] {
  if (roots instanceof Node) {
    return [roots];
  }

  return [...roots];
}

export function discoverHosts(
  roots: Node | Iterable<Node> = document.body,
  options: DiscoverHostsOptions = {},
): ScannedSegment[] {
  const allHosts: TranslationHost[] = [];

  for (const root of normalizeRoots(roots)) {
    const { hosts } = sniffFromRoot(root, options);
    allHosts.push(...hosts);
  }

  return hostsToSegments(resolveHostConflicts(allHosts), options);
}

export function discoverHostsWithStatus(
  roots: Node | Iterable<Node> = document.body,
  options: DiscoverHostsOptions = {},
): { segments: ScannedSegment[]; incomplete: boolean } {
  const allHosts: TranslationHost[] = [];
  let incomplete = false;

  for (const root of normalizeRoots(roots)) {
    const result = sniffFromRoot(root, options);
    allHosts.push(...result.hosts);

    if (result.incomplete) {
      incomplete = true;
    }
  }

  return {
    segments: hostsToSegments(resolveHostConflicts(allHosts), options),
    incomplete,
  };
}

export function createSegmentFromElement(element: HTMLElement): ScannedSegment | null {
  if (element.dataset.yibanHost !== '1') {
    return null;
  }

  const host = element;

  if (!host.isConnected || !isVisible(host) || shouldSkipHost(host)) {
    return null;
  }

  if (host.dataset.yibanTranslated === 'true') {
    return null;
  }

  const cached = hostRegistry.get(host);

  if (cached && cached.element.isConnected) {
    return cached;
  }

  const text = extractHostText(host);

  if (isSkippableText(text)) {
    return null;
  }

  const hostMode = (host.dataset.yibanHostMode as HostMode | undefined) ?? 'inline';
  const segment = createSegment(host, text, hostMode, hostRegistry.size + 1);
  hostRegistry.set(host, segment);

  return segment;
}

export function collectSegmentsFromMarkedHosts(
  roots: Node | Iterable<Node> = document.body,
): ScannedSegment[] {
  const segments: ScannedSegment[] = [];
  const seen = new Set<HTMLElement>();

  for (const root of normalizeRoots(roots)) {
    const scope = root instanceof HTMLElement ? root : document.body;

    scope
      .querySelectorAll('[data-yiban-host="1"]:not([data-yiban-translated="true"])')
      .forEach((node) => {
        if (!(node instanceof HTMLElement) || seen.has(node)) {
          return;
        }

        seen.add(node);
        const segment = createSegmentFromElement(node);

        if (segment) {
          segments.push(segment);
        }
      });
  }

  return segments;
}

export function scanTranslatableSegments(): ScannedSegment[] {
  return discoverHosts(document.body);
}

export function clearHostRegistry(): void {
  hostRegistry.clear();
}

export function clearHostMarks(): void {
  clearTranslationHostMarks();
}
