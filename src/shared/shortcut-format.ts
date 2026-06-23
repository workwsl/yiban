export function formatCommandShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().includes('MAC');

  const parts = shortcut.split('+').map((part) => {
    switch (part) {
      case 'Alt':
        return isMac ? '⌥' : 'Alt';
      case 'Shift':
        return isMac ? '⇧' : 'Shift';
      case 'Ctrl':
        return isMac ? '⌃' : 'Ctrl';
      case 'Command':
      case 'MacCtrl':
        return '⌘';
      default:
        return part;
    }
  });

  return isMac ? parts.join('') : parts.join('+');
}
