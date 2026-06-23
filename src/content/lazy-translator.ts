import {
  collectSegmentsFromMarkedHosts,
  createSegmentFromElement,
  discoverHostsWithStatus,
  type ScannedSegment,
} from './dom-scanner';
import { renderLoadingPlaceholder, renderTranslation, removeLoadingPlaceholder } from './translation-renderer';
import { isElementDisplayed, isElementInViewport } from './visibility';
import type { RuntimeMessage, RuntimeResponse, TranslateTextRuntimeResponse } from '../shared/messages';
import type { PromptProfileId } from '../shared/types';
import {
  createTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from '../storage/translation-cache';

const MAX_CONCURRENT_TRANSLATIONS = 4;
const IDLE_TIMEOUT_MS = 200;

export interface LazyTranslationProgress {
  total: number;
  completed: number;
  failed: number;
  errorMessage?: string;
  discoverFinished?: boolean;
}

export interface LazyTranslationOptions {
  targetLanguage: string;
  modelId: string | null;
  promptProfileId: PromptProfileId;
  promptFingerprint: string;
  isStopped: () => boolean;
  onProgress: (progress: LazyTranslationProgress) => void;
}

export interface LazyTranslationController {
  stop: () => void;
}

function scheduleIdleWork(callback: (deadline: IdleDeadline) => boolean): void {
  const run = (deadline: IdleDeadline): void => {
    const hasMore = callback(deadline);

    if (hasMore && !deadline.didTimeout) {
      scheduleIdleWork(callback);
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return;
  }

  run({
    didTimeout: true,
    timeRemaining: () => 16,
  } as IdleDeadline);
}

function collectMutationRoots(mutations: MutationRecord[]): Node[] {
  const roots = new Set<Node>();

  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          roots.add(node);
          continue;
        }

        if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          roots.add(node.parentElement);
        }
      }
    }

    if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
      roots.add(mutation.target);
    }
  }

  return [...roots];
}

function dedupeSegmentsByElement(segments: ScannedSegment[]): ScannedSegment[] {
  const seen = new Set<HTMLElement>();
  const result: ScannedSegment[] = [];

  for (const segment of segments) {
    if (seen.has(segment.element)) {
      continue;
    }

    seen.add(segment.element);
    result.push(segment);
  }

  return result;
}

export function startLazyPageTranslation(options: LazyTranslationOptions): LazyTranslationController {
  const discoveredElements = new Set<HTMLElement>();
  const queuedElements = new Set<HTMLElement>();
  const observedElements = new WeakSet<HTMLElement>();
  const inFlightElements = new Set<HTMLElement>();
  const pendingSegments: ScannedSegment[] = [];
  const pendingDiscoverRoots: Node[] = [];

  let runningTranslations = 0;
  let discoverScheduled = false;
  let stopped = false;

  let intersectionObserver: IntersectionObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  let progress: LazyTranslationProgress = {
    total: 0,
    completed: 0,
    failed: 0,
  };

  const emitProgress = (): void => {
    options.onProgress({ ...progress });
  };

  const markDiscovered = (element: HTMLElement): void => {
    if (discoveredElements.has(element)) {
      return;
    }

    discoveredElements.add(element);
    progress.total = discoveredElements.size;
    emitProgress();
  };

  const observeElement = (element: HTMLElement): void => {
    if (observedElements.has(element) || !intersectionObserver) {
      return;
    }

    observedElements.add(element);
    intersectionObserver.observe(element);
  };

  const pumpTranslationQueue = (): void => {
    while (runningTranslations < MAX_CONCURRENT_TRANSLATIONS && pendingSegments.length > 0) {
      const segment = pendingSegments.shift();

      if (!segment) {
        break;
      }

      runningTranslations += 1;

      void translateSegment(segment).finally(() => {
        runningTranslations -= 1;
        pumpTranslationQueue();
      });
    }
  };

  const queueSegmentForTranslation = (segment: ScannedSegment): void => {
    if (
      options.isStopped() ||
      segment.element.dataset.yibanHost !== '1' ||
      segment.element.dataset.yibanTranslated === 'true' ||
      segment.element.dataset.yibanTranslating === 'true' ||
      inFlightElements.has(segment.element)
    ) {
      return;
    }

    if (!isElementDisplayed(segment.element) || !isElementInViewport(segment.element)) {
      queuedElements.add(segment.element);
      observeElement(segment.element);
      return;
    }

    pendingSegments.push(segment);
    pumpTranslationQueue();
  };

  const translateSegment = async (segment: ScannedSegment): Promise<void> => {
    if (
      options.isStopped() ||
      segment.element.dataset.yibanHost !== '1' ||
      segment.element.dataset.yibanTranslated === 'true' ||
      segment.element.dataset.yibanTranslating === 'true' ||
      inFlightElements.has(segment.element)
    ) {
      return;
    }

    if (!isElementDisplayed(segment.element) || !isElementInViewport(segment.element)) {
      queuedElements.add(segment.element);
      observeElement(segment.element);
      return;
    }

    inFlightElements.add(segment.element);
    queuedElements.delete(segment.element);
    intersectionObserver?.unobserve(segment.element);

    let loadingShown = false;

    const markRenderOutcome = (): void => {
      if (segment.element.dataset.yibanTranslated === 'true') {
        progress.completed += 1;
        return;
      }

      if (loadingShown) {
        removeLoadingPlaceholder(segment.element);
      }

      progress.failed += 1;
      progress.errorMessage = progress.errorMessage ?? '译文未能插入页面。';
    };

    try {
      const cacheKey = options.modelId
        ? await createTranslationCacheKey(
            segment.text,
            options.targetLanguage,
            options.modelId,
            options.promptProfileId,
            options.promptFingerprint,
          )
        : null;
      const cached = cacheKey ? await getCachedTranslation(cacheKey) : undefined;

      if (options.isStopped()) {
        return;
      }

      if (cached) {
        renderTranslation(segment, cached.translatedText, options.targetLanguage);
        markRenderOutcome();
        emitProgress();
        return;
      }

      renderLoadingPlaceholder(segment);
      loadingShown = segment.element.dataset.yibanTranslating === 'true';

      const response = await chrome.runtime.sendMessage<
        RuntimeMessage,
        RuntimeResponse<TranslateTextRuntimeResponse>
      >({
        type: 'TEXT_TRANSLATE',
        payload: {
          text: segment.text,
          targetLanguage: options.targetLanguage,
          modelId: options.modelId,
          promptProfileId: options.promptProfileId,
        },
      });

      if (options.isStopped()) {
        return;
      }

      if (response.ok) {
        renderTranslation(segment, response.data.text, options.targetLanguage);

        if (response.data.modelId) {
          const key = await createTranslationCacheKey(
            segment.text,
            options.targetLanguage,
            response.data.modelId,
            options.promptProfileId,
            options.promptFingerprint,
          );
          await setCachedTranslation({
            key,
            sourceText: segment.text,
            translatedText: response.data.text,
            targetLanguage: options.targetLanguage,
            modelId: response.data.modelId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            hitCount: 0,
          });
        }

        markRenderOutcome();
      } else {
        if (loadingShown) {
          removeLoadingPlaceholder(segment.element);
        }

        progress.failed += 1;
        progress.errorMessage = response.error.message;
      }

      emitProgress();
    } catch (error) {
      if (options.isStopped()) {
        return;
      }

      if (loadingShown) {
        removeLoadingPlaceholder(segment.element);
      }

      progress.failed += 1;
      progress.errorMessage = error instanceof Error ? error.message : '翻译请求失败。';
      emitProgress();
    } finally {
      if (options.isStopped() && loadingShown) {
        removeLoadingPlaceholder(segment.element);
      }

      inFlightElements.delete(segment.element);
    }
  };

  const enqueueSegment = (segment: ScannedSegment): void => {
    if (
      options.isStopped() ||
      segment.element.dataset.yibanHost !== '1' ||
      segment.element.dataset.yibanTranslated === 'true'
    ) {
      return;
    }

    markDiscovered(segment.element);
    queueSegmentForTranslation(segment);
  };

  const discoverAndEnqueue = (
    roots: Node[],
    deadline?: IdleDeadline,
  ): { incomplete: boolean; enqueued: number } => {
    const discoverOptions = deadline ? { deadline } : {};
    const { segments: sniffed, incomplete } = discoverHostsWithStatus(roots, discoverOptions);
    const marked = collectSegmentsFromMarkedHosts(roots);
    const segments = dedupeSegmentsByElement([...sniffed, ...marked]);

    for (const segment of segments) {
      enqueueSegment(segment);
    }

    return { incomplete, enqueued: segments.length };
  };

  const recheckQueuedElement = (element: HTMLElement): void => {
    if (!element.isConnected || element.dataset.yibanTranslated === 'true') {
      queuedElements.delete(element);
      intersectionObserver?.unobserve(element);
      return;
    }

    const segment = createSegmentFromElement(element);

    if (!segment) {
      queuedElements.delete(element);
      intersectionObserver?.unobserve(element);
      return;
    }

    if (isElementDisplayed(element) && isElementInViewport(element)) {
      queueSegmentForTranslation(segment);
    }
  };

  const runDiscoverPass = (deadline?: IdleDeadline): boolean => {
    if (options.isStopped()) {
      return false;
    }

    const roots = pendingDiscoverRoots.length > 0 ? pendingDiscoverRoots.splice(0) : [document.body];
    const { incomplete, enqueued } = discoverAndEnqueue(roots, deadline);

    if (incomplete && enqueued === 0 && deadline) {
      setTimeout(() => {
        if (stopped || options.isStopped()) {
          return;
        }

        discoverAndEnqueue(roots);
      }, 0);
    }

    if (deadline) {
      for (const element of queuedElements) {
        if (deadline.timeRemaining() < 1) {
          return true;
        }

        recheckQueuedElement(element);
      }
    } else {
      for (const element of queuedElements) {
        recheckQueuedElement(element);
      }
    }

    return incomplete || pendingDiscoverRoots.length > 0;
  };

  const runInitialDiscover = (): void => {
    discoverAndEnqueue([document.body]);

    if (discoveredElements.size === 0) {
      options.onProgress({ ...progress, discoverFinished: true });
    }
  };

  const scheduleDiscover = (roots: Node[] = []): void => {
    if (stopped) {
      return;
    }

    pendingDiscoverRoots.push(...roots);

    if (discoverScheduled) {
      return;
    }

    discoverScheduled = true;

    scheduleIdleWork((deadline) => {
      discoverScheduled = false;
      const hasMore = runDiscoverPass(deadline);

      if (hasMore) {
        scheduleDiscover();
      }

      return false;
    });
  };

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const element = entry.target;

        if (!(element instanceof HTMLElement)) {
          continue;
        }

        const segment = createSegmentFromElement(element);

        if (!segment) {
          intersectionObserver?.unobserve(element);
          queuedElements.delete(element);
          continue;
        }

        queueSegmentForTranslation(segment);
      }
    },
    {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0,
    },
  );

  const isOwnMutation = (mutation: MutationRecord): boolean => {
    const target = mutation.target;

    if (
      mutation.type === 'childList' &&
      mutation.addedNodes.length > 0 &&
      [...mutation.addedNodes].every(
        (node) =>
          node instanceof HTMLElement &&
          (node.dataset.yibanOwned === 'true' ||
            node.classList.contains('notranslate') ||
            node.classList.contains('yiban-target-wrapper')),
      )
    ) {
      return true;
    }

    if (target instanceof HTMLElement) {
      return (
        target.dataset.yibanOwned === 'true' ||
        target.classList.contains('notranslate') ||
        target.closest('[data-yiban-owned="true"], .yiban-target-wrapper') !== null
      );
    }

    return false;
  };

  mutationObserver = new MutationObserver((mutations) => {
    if (mutations.every(isOwnMutation)) {
      return;
    }

    const roots = collectMutationRoots(mutations);

    if (roots.length === 0) {
      for (const mutation of mutations) {
        if (mutation.target instanceof HTMLElement && mutation.target.dataset.yibanHost === '1') {
          recheckQueuedElement(mutation.target);
        }
      }
      return;
    }

    scheduleDiscover(roots);
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'class',
      'style',
      'hidden',
      'open',
      'aria-hidden',
      'aria-expanded',
      'data-state',
      'data-open',
      'data-yiban-host',
    ],
  });

  runInitialDiscover();

  return {
    stop: () => {
      stopped = true;
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
      intersectionObserver = null;
      mutationObserver = null;
      queuedElements.clear();
      inFlightElements.clear();
      pendingSegments.length = 0;
      pendingDiscoverRoots.length = 0;
    },
  };
}
