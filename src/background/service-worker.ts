import { handleRuntimeMessage } from './message-router';
import type { RuntimeMessage } from '../shared/messages';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'yiban-translate-selection',
    title: '译伴：翻译选中文本',
    contexts: ['selection'],
  });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleRuntimeMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown background error',
        },
      });
    });

  return true;
});
