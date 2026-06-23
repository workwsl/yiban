function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;

  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.closest('[contenteditable="true"]') !== null;
}

function isAltA(event: KeyboardEvent): boolean {
  if (event.repeat) {
    return false;
  }

  return (
    event.altKey &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.code === 'KeyA'
  );
}

export function initKeyboardShortcut(onToggle: () => void): void {
  const handler = (event: KeyboardEvent) => {
    if (!isAltA(event) || isEditableTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    onToggle();
  };

  // capture on window so we receive the event even when focus is on documentElement/body
  window.addEventListener('keydown', handler, true);
}
