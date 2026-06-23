const VIEWPORT_PREFETCH_PX = 200;

function parseOpacity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

function isCollapsedByTransform(transform: string): boolean {
  if (!transform || transform === 'none') {
    return false;
  }

  return /scale(?:3d|X|Y)?\(\s*0(?:[,\s]|$)/.test(transform);
}

function isCollapsedByClipPath(clipPath: string): boolean {
  if (!clipPath || clipPath === 'none') {
    return false;
  }

  return /inset\(\s*100%|circle\(\s*0|polygon\(\s*0/.test(clipPath);
}

function isInsideClosedDetails(element: HTMLElement): boolean {
  const details = element.closest('details');

  if (!details || details.open) {
    return false;
  }

  const summary = details.querySelector(':scope > summary');

  if (summary instanceof HTMLElement && (element === summary || summary.contains(element))) {
    return false;
  }

  return true;
}

function hasClosedStateAttribute(element: HTMLElement): boolean {
  if (element.getAttribute('data-state') === 'closed') {
    return true;
  }

  if (element.getAttribute('data-open') === 'false') {
    return true;
  }

  return false;
}

export function getNavRoot(element: HTMLElement): HTMLElement | null {
  return element.closest('header, nav, [role="navigation"], [role="banner"]');
}

export function isNavPanelOpen(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (current.matches(':hover, :focus-within')) {
      return true;
    }

    if (current.getAttribute('data-state') === 'open') {
      return true;
    }

    if (current.getAttribute('aria-expanded') === 'true') {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

export function isTopLevelNavBarItem(element: HTMLElement): boolean {
  const navRoot = getNavRoot(element);

  if (!navRoot) {
    return false;
  }

  const elementRect = element.getBoundingClientRect();
  const navRect = navRoot.getBoundingClientRect();

  if (elementRect.top > navRect.bottom - 4) {
    return false;
  }

  if (elementRect.bottom < navRect.top + 4) {
    return false;
  }

  const menu = element.closest('[role="menu"], [role="listbox"], [role="dialog"]');

  if (menu instanceof HTMLElement && menu !== element && !isNavPanelOpen(menu)) {
    return false;
  }

  return true;
}

export function isBreadcrumbItem(element: HTMLElement): boolean {
  if (String(element.className).toLowerCase().includes('breadcrumb')) {
    return true;
  }

  if (
    element.closest(
      '[class*="breadcrumb" i], [itemprop="breadcrumb"], nav[aria-label*="breadcrumb" i]',
    ) !== null
  ) {
    return true;
  }

  const currentPage = element.closest('[aria-current="page"]');

  if (currentPage instanceof HTMLElement) {
    const list = currentPage.closest('nav ol, nav ul, ol, ul');

    if (list?.closest('nav') !== null) {
      return true;
    }
  }

  return false;
}

const SIDEBAR_DIRECTORY_SELECTOR = [
  'aside',
  '[role="complementary"]',
  '[role="doc-toc"]',
  '[class*="sidebar" i]',
  '[class*="side-bar" i]',
  '[class*="toc" i]',
  '[class*="table-of-contents" i]',
  '[class*="post_details" i]',
  '[class*="details_list" i]',
  '[class*="blog_post_details" i]',
  '[class*="directory" i]',
  '[class*="catalog" i]',
].join(', ');

export function isDirectoryListItem(element: HTMLElement): boolean {
  if (element.tagName !== 'LI') {
    return false;
  }

  const list = element.parentElement;

  if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) {
    return false;
  }

  if (list.getAttribute('role') !== 'list') {
    return false;
  }

  if (list.closest('nav, header, [role="navigation"], [role="menu"], [role="menubar"]')) {
    return false;
  }

  if (list.matches('ol.steps') || list.closest('article ol.steps, main ol.steps')) {
    return false;
  }

  return isSidebarDirectoryContext(element);
}

export function isSidebarDirectoryContext(element: HTMLElement): boolean {
  return element.closest(SIDEBAR_DIRECTORY_SELECTOR) !== null;
}

export function isDirectoryOrSidebarItem(element: HTMLElement): boolean {
  return isDirectoryListItem(element) || isSidebarDirectoryContext(element);
}

const NAV_MENU_CONTAINER_SELECTOR = [
  '[role="menu"]',
  '[role="menubar"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[data-radix-popper-content-wrapper]',
  '[data-radix-menu-content]',
  '[data-radix-dropdown-menu-content]',
  '.mega-menu',
  '[class*="mega-menu"]',
  '[class*="dropdown-menu"]',
  '[class*="DropdownMenu"]',
].join(', ');

export function isMenuListItem(element: HTMLElement): boolean {
  if (element.tagName !== 'LI') {
    return false;
  }

  const list = element.parentElement;

  if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) {
    return false;
  }

  return list.closest(NAV_MENU_CONTAINER_SELECTOR) !== null || list.closest('nav, header, [role="navigation"]') !== null;
}

export function isInMenuUi(element: HTMLElement): boolean {
  if (isMenuListItem(element)) {
    return true;
  }

  const menuContainer = element.closest(NAV_MENU_CONTAINER_SELECTOR);

  if (menuContainer) {
    const navRoot = getNavRoot(element);

    if (navRoot && isTopLevelNavBarItem(element)) {
      return false;
    }

    return true;
  }

  const navRoot = getNavRoot(element);

  if (!navRoot) {
    return false;
  }

  if (isTopLevelNavBarItem(element)) {
    return false;
  }

  if (element.closest('nav, header, [role="navigation"]') !== null) {
    const elementRect = element.getBoundingClientRect();
    const navRect = navRoot.getBoundingClientRect();

    if (elementRect.top >= navRect.bottom - 1) {
      return true;
    }
  }

  return false;
}

/** @deprecated Use isInMenuUi — kept for call-site clarity */
export function isNavMenuContext(element: HTMLElement): boolean {
  return isInMenuUi(element);
}

export function isInsideClosedNavPanel(element: HTMLElement): boolean {
  const navRoot = getNavRoot(element);

  if (!navRoot) {
    return false;
  }

  if (isTopLevelNavBarItem(element)) {
    return false;
  }

  const elementRect = element.getBoundingClientRect();
  const navRect = navRoot.getBoundingClientRect();

  if (elementRect.top >= navRect.bottom - 1 && !isNavPanelOpen(element)) {
    return true;
  }

  let current: HTMLElement | null = element;

  while (current && current !== navRoot && current !== document.documentElement) {
    const role = current.getAttribute('role');

    if (role === 'menu' || role === 'listbox' || role === 'dialog') {
      if (hasClosedStateAttribute(current)) {
        return true;
      }

      if (current.getAttribute('aria-hidden') === 'true') {
        return true;
      }

      if (!isNavPanelOpen(current)) {
        return true;
      }
    }

    if (hasClosedStateAttribute(current) && !current.hasAttribute('aria-haspopup')) {
      return true;
    }

    const style = window.getComputedStyle(current);

    if (style.pointerEvents === 'none') {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

export function isElementDisplayed(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return false;
  }

  if (element.hasAttribute('hidden') || element.closest('[hidden]') !== null) {
    return false;
  }

  if (element.closest('[inert]') !== null) {
    return false;
  }

  if (isInsideClosedDetails(element)) {
    return false;
  }

  if (isInsideClosedNavPanel(element)) {
    return false;
  }

  let current: HTMLElement | null = element;

  while (current && current !== document.documentElement) {
    if (hasClosedStateAttribute(current)) {
      return false;
    }

    if (current.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    const style = window.getComputedStyle(current);

    if (style.display === 'none') {
      return false;
    }

    if (style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false;
    }

    if (parseOpacity(style.opacity) <= 0) {
      return false;
    }

    if (style.contentVisibility === 'hidden') {
      return false;
    }

    if (style.pointerEvents === 'none' && getNavRoot(current) !== null) {
      return false;
    }

    if (isCollapsedByTransform(style.transform)) {
      return false;
    }

    if (isCollapsedByClipPath(style.clipPath)) {
      return false;
    }

    const rect = current.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    if (style.maxHeight === '0px' || style.height === '0px') {
      return false;
    }

    current = current.parentElement;
  }

  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0;
}

export function isElementInViewport(
  element: HTMLElement,
  prefetchPx = VIEWPORT_PREFETCH_PX,
): boolean {
  const rect = element.getBoundingClientRect();

  return (
    rect.bottom >= -prefetchPx &&
    rect.top <= window.innerHeight + prefetchPx &&
    rect.right >= -prefetchPx &&
    rect.left <= window.innerWidth + prefetchPx
  );
}
