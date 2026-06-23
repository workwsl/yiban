import {
  clearHostMarks,
  clearHostRegistry,
  hostModeToRenderClass,
  isCssLikeSegmentText,
  type ScannedSegment,
} from './dom-scanner';
import { isAnimatedSplitTextBlock, type HostMode } from './host-sniffer';
import { isElementDisplayed } from './visibility';

const STYLE_ID = 'yiban-translation-style';

type RenderContext = 'navLabel' | 'navMenuInline' | 'bodyBlock' | 'bodyInline' | 'metaInline';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .yiban-target-wrapper,
    .yiban-target-wrapper * {
      box-sizing: border-box;
    }

    .yiban-target-wrapper {
      font: inherit;
      color: inherit;
      text-transform: none;
      contain: style;
      --yiban-translation-gap: 0.35em;
    }

    .yiban-target-bodyBlock {
      display: block;
      margin-top: var(--yiban-translation-gap);
      margin-bottom: 0;
      white-space: normal;
      word-break: break-word;
    }

    .yiban-target-navLabel,
    .yiban-target-navMenuInline,
    .yiban-target-metaInline,
    .yiban-target-bodyInline {
      display: inline;
      margin: 0;
      padding: 0;
      white-space: normal;
    }

    .yiban-target-navMenuInline.yiban-target-wrapper,
    .yiban-target-metaInline.yiban-target-wrapper,
    .yiban-target-navLabel.yiban-target-wrapper,
    .yiban-target-bodyInline.yiban-target-wrapper {
      margin-inline-start: var(--yiban-translation-gap);
    }

    .yiban-target-navMenuInline .yiban-target-translation-block-wrapper {
      display: inline;
      vertical-align: baseline;
    }

    .yiban-target-navMenuInline .yiban-target-translation-inline-wrapper {
      display: inline;
    }

    .yiban-target-metaInline {
      white-space: nowrap;
    }

    .yiban-target-navLabel .yiban-target-translation-block-wrapper {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--yiban-translation-gap);
      max-width: 100%;
      vertical-align: baseline;
    }

    .yiban-target-bodyInline .yiban-target-translation-block-wrapper {
      display: block;
      margin-top: var(--yiban-translation-gap);
      width: 100%;
      max-width: 100%;
      white-space: normal;
      word-break: break-word;
    }

    .yiban-target-bodyInline .yiban-target-translation-inline-wrapper {
      display: block;
      width: 100%;
      max-width: 100%;
      white-space: normal;
      word-break: break-word;
    }

    .yiban-target-bodyBlock .yiban-target-translation-block-wrapper,
    .yiban-target-bodyBlock .yiban-target-translation-inline-wrapper {
      display: block;
      width: 100%;
      max-width: 100%;
      white-space: normal;
      word-break: break-word;
    }

    .yiban-nav-bilingual {
      max-width: 100%;
    }

    .yiban-target-loading {
      opacity: 0.55;
    }

    .yiban-loading-spinner {
      display: inline-block;
      width: 0.85em;
      height: 0.85em;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: yiban-spin 0.75s linear infinite;
      vertical-align: -0.1em;
    }

    @keyframes yiban-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.documentElement.appendChild(style);
}

function resolveRenderContext(host: HTMLElement, segment: ScannedSegment): RenderContext {
  const hostMode =
    segment.hostMode ?? (host.dataset.yibanHostMode as HostMode | undefined) ?? 'inline';

  return hostModeToRenderClass(hostMode) as RenderContext;
}

function resolveEffectiveContext(
  host: HTMLElement,
  segment: ScannedSegment,
  text: string,
): RenderContext {
  const context = resolveRenderContext(host, segment);

  if (context === 'navLabel' && wouldBreakHeader(host, text)) {
    return 'bodyInline';
  }

  return context;
}

function createFontElement(className: string): HTMLElement {
  const element = document.createElement('font');
  element.className = `notranslate ${className}`;
  element.setAttribute('translate', 'no');
  return element;
}

function createTranslationWrapper(
  context: RenderContext,
  translatedText: string,
  segmentId: string,
  lang = 'zh-CN',
): HTMLElement {
  const wrapper = createFontElement(`yiban-target-wrapper yiban-target-${context}`);
  wrapper.lang = lang;
  wrapper.dataset.yibanOwned = 'true';
  wrapper.dataset.yibanSegmentId = segmentId;

  const blockWrapper = createFontElement('yiban-target-translation-block-wrapper');
  const inlineWrapper = createFontElement('yiban-target-translation-inline-wrapper');
  const inner = createFontElement('yiban-target-inner');
  inner.textContent = translatedText;

  inlineWrapper.append(inner);
  blockWrapper.append(inlineWrapper);
  wrapper.append(blockWrapper);

  return wrapper;
}

function createLoadingWrapper(context: RenderContext, segmentId: string): HTMLElement {
  const wrapper = createFontElement(`yiban-target-wrapper yiban-target-loading yiban-target-${context}`);
  wrapper.dataset.yibanOwned = 'true';
  wrapper.dataset.yibanLoading = 'true';
  wrapper.dataset.yibanSegmentId = segmentId;

  const spinner = document.createElement('span');
  spinner.className = 'yiban-loading-spinner';
  spinner.setAttribute('aria-label', '翻译中');
  spinner.setAttribute('role', 'status');
  wrapper.append(spinner);

  return wrapper;
}

function getMenuPanelReference(host: HTMLElement): Element | null {
  if (isAnimatedSplitTextBlock(host)) {
    return null;
  }

  return host.querySelector(
    ':scope > [role="menu"], :scope > [role="listbox"], :scope > [role="dialog"], :scope > [data-state], :scope > .mega-menu',
  );
}

function insertBodyBlockNodes(host: HTMLElement, lineBreak: HTMLElement, wrapper: HTMLElement): void {
  const reference = getMenuPanelReference(host);

  if (reference) {
    host.insertBefore(lineBreak, reference);
    host.insertBefore(wrapper, reference);
    return;
  }

  host.append(lineBreak);
  host.append(wrapper);
}

function insertLoadingInside(
  host: HTMLElement,
  wrapper: HTMLElement,
  context: RenderContext,
): void {
  host.dataset.yibanTranslating = 'true';

  if (context === 'bodyBlock') {
    const lineBreak = document.createElement('br');
    lineBreak.dataset.yibanOwned = 'true';
    insertBodyBlockNodes(host, lineBreak, wrapper);
    return;
  }

  const reference = getMenuPanelReference(host);

  if (reference) {
    host.insertBefore(wrapper, reference);
    return;
  }

  host.append(wrapper);
}

function insertTranslationInside(
  host: HTMLElement,
  wrapper: HTMLElement,
  context: RenderContext,
  segmentId: string,
): void {
  host.dataset.yibanTranslated = 'true';
  delete host.dataset.yibanHost;
  delete host.dataset.yibanHostMode;
  host.dataset.yibanSegmentId = segmentId;
  host.classList.toggle('yiban-nav-bilingual', context === 'navLabel');

  if (context === 'bodyBlock') {
    const lineBreak = document.createElement('br');
    lineBreak.dataset.yibanOwned = 'true';
    insertBodyBlockNodes(host, lineBreak, wrapper);
    return;
  }

  const reference = getMenuPanelReference(host);

  if (reference) {
    host.insertBefore(wrapper, reference);
    return;
  }

  host.append(wrapper);
}

function wouldBreakHeader(source: HTMLElement, sourceText: string): boolean {
  const header = source.closest('header, nav, [role="navigation"], [role="banner"]');

  if (!(header instanceof HTMLElement)) {
    return false;
  }

  return sourceText.trim().length > 32;
}

export function removeLoadingPlaceholder(host: HTMLElement): void {
  const loading = host.querySelector(':scope > [data-yiban-loading="true"]');

  if (loading) {
    const previous = loading.previousElementSibling;

    if (
      previous instanceof HTMLElement &&
      previous.tagName === 'BR' &&
      previous.dataset.yibanOwned === 'true'
    ) {
      previous.remove();
    }

    loading.remove();
  }

  delete host.dataset.yibanTranslating;
}

export function removeExistingTranslations(): void {
  document
    .querySelectorAll(
      '.yiban-target-wrapper, .yiban-translation-inline, .yiban-translation-block, [data-yiban-loading="true"]',
    )
    .forEach((node) => {
      node.remove();
    });

  document.querySelectorAll('[data-yiban-owned="true"]').forEach((node) => {
    node.remove();
  });

  document.querySelectorAll('[data-yiban-translated="true"], [data-yiban-translating="true"]').forEach((node) => {
    if (node instanceof HTMLElement) {
      delete node.dataset.yibanTranslated;
      delete node.dataset.yibanTranslating;
      delete node.dataset.yibanSegmentId;
      node.classList.remove('yiban-nav-bilingual');
    }
  });

  clearHostMarks();
  clearHostRegistry();
}

export function renderLoadingPlaceholder(segment: ScannedSegment): void {
  ensureStyle();

  const host = segment.element;

  if (
    !host.isConnected ||
    host.dataset.yibanTranslated === 'true' ||
    host.querySelector(':scope > [data-yiban-loading="true"]') !== null
  ) {
    return;
  }

  if (!isElementDisplayed(host)) {
    return;
  }

  if (isCssLikeSegmentText(segment.text)) {
    return;
  }

  if (segment.text.trim().length <= 2) {
    return;
  }

  const context = resolveEffectiveContext(host, segment, segment.text);

  removeLoadingPlaceholder(host);
  insertLoadingInside(host, createLoadingWrapper(context, segment.id), context);
}

export function renderTranslation(
  segment: ScannedSegment,
  translatedText: string,
  targetLanguage = 'zh-CN',
): void {
  ensureStyle();

  const host = segment.element;

  if (!host.isConnected || host.dataset.yibanTranslated === 'true') {
    return;
  }

  if (!isElementDisplayed(host)) {
    return;
  }

  if (isCssLikeSegmentText(segment.text)) {
    return;
  }

  if (segment.text.trim().length <= 2) {
    return;
  }

  const context = resolveEffectiveContext(host, segment, segment.text);
  const translation = createTranslationWrapper(context, translatedText, segment.id, targetLanguage);

  removeLoadingPlaceholder(host);
  insertTranslationInside(host, translation, context, segment.id);
}
