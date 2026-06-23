import type { RuntimeMessage, RuntimeResponse, TranslateTextRuntimeResponse } from '../shared/messages';
import { DEFAULT_SETTINGS } from '../shared/defaults';
import type { UserSettings } from '../shared/types';

const BUTTON_ID = 'yiban-selection-button';
const POPOVER_ID = 'yiban-selection-popover';
const STYLE_ID = 'yiban-selection-style';
const SETTINGS_STORAGE_KEY = 'yiban.userSettings';

function ensureSelectionStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      z-index: 2147483647;
      border: 0;
      border-radius: 6px;
      background: #176b5b;
      color: #fff;
      cursor: pointer;
      font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 7px 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
    }

    #${POPOVER_ID} {
      position: fixed;
      z-index: 2147483647;
      box-sizing: border-box;
      width: min(360px, calc(100vw - 24px));
      max-height: min(320px, calc(100vh - 24px));
      overflow: auto;
      border: 1px solid #d6dee8;
      border-radius: 8px;
      background: #fff;
      color: #172033;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22);
      font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 12px;
      white-space: pre-wrap;
    }

    #${POPOVER_ID} .yiban-popover-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }

    #${POPOVER_ID} button {
      border: 0;
      border-radius: 6px;
      background: #e7ecef;
      color: #172033;
      cursor: pointer;
      font: 600 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 6px 8px;
    }
  `;
  document.documentElement.appendChild(style);
}

function removeElement(id: string): void {
  document.getElementById(id)?.remove();
}

function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? '';
}

function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  return selection.getRangeAt(0).getBoundingClientRect();
}

function positionElement(element: HTMLElement, rect: DOMRect): void {
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - element.offsetWidth - 12);
  const top = Math.min(Math.max(rect.bottom + 8, 12), window.innerHeight - element.offsetHeight - 12);
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

async function getSettings(): Promise<UserSettings> {
  const response = await chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<UserSettings>>({
    type: 'SETTINGS_GET',
  });

  return response.ok ? response.data : DEFAULT_SETTINGS;
}

async function translateSelection(text: string, rect: DOMRect): Promise<void> {
  removeElement(BUTTON_ID);
  removeElement(POPOVER_ID);
  ensureSelectionStyle();

  const popover = document.createElement('div');
  popover.id = POPOVER_ID;
  popover.textContent = '翻译中...';
  document.documentElement.appendChild(popover);
  positionElement(popover, rect);

  const settings = await getSettings();
  const response = await chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse<TranslateTextRuntimeResponse>>({
    type: 'TEXT_TRANSLATE',
    payload: {
      text,
      targetLanguage: settings.defaultTargetLanguage,
      modelId: settings.defaultModelId,
      promptProfileId: settings.promptProfileId,
    },
  });

  if (response.ok) {
    popover.textContent = response.data.text;
  } else {
    popover.textContent = response.error.message;
  }

  const actions = document.createElement('div');
  actions.className = 'yiban-popover-actions';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '关闭';
  closeButton.addEventListener('click', () => removeElement(POPOVER_ID));

  actions.appendChild(closeButton);
  popover.appendChild(actions);
  positionElement(popover, rect);
}

async function showSelectionButton(): Promise<void> {
  const settings = await getSettings();

  if (!settings.selectionTranslateEnabled) {
    removeElement(BUTTON_ID);
    return;
  }

  if (document.getElementById(POPOVER_ID)) {
    return;
  }

  const text = getSelectedText();
  const rect = getSelectionRect();

  removeElement(BUTTON_ID);

  if (!text || text.length < 2 || !rect) {
    return;
  }

  ensureSelectionStyle();

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = '翻译';
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    void translateSelection(text, rect);
  });

  document.documentElement.appendChild(button);
  positionElement(button, rect);
}

export function initSelectionTranslator(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_STORAGE_KEY]) {
      return;
    }

    const next = changes[SETTINGS_STORAGE_KEY].newValue as UserSettings | undefined;

    if (next && !next.selectionTranslateEnabled) {
      removeElement(BUTTON_ID);
      removeElement(POPOVER_ID);
    }
  });

  document.addEventListener('mouseup', (event) => {
    const target = event.target;

    if (target instanceof Element && target.closest(`#${BUTTON_ID}, #${POPOVER_ID}`)) {
      return;
    }

    window.setTimeout(() => {
      void showSelectionButton();
    }, 0);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      removeElement(BUTTON_ID);
      removeElement(POPOVER_ID);
    }
  });

  document.addEventListener('mousedown', (event) => {
    const target = event.target;

    if (target instanceof Element && (target.closest(`#${BUTTON_ID}`) || target.closest(`#${POPOVER_ID}`))) {
      return;
    }

    removeElement(BUTTON_ID);
  });
}
