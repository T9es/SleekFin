import { dom } from '../../shared/runtime.js';

export function isTvLayout() {
  return document.documentElement.classList.contains('layout-tv') || Boolean(document.body?.classList.contains('layout-tv'));
}

export function layoutMode() {
  return window.innerWidth < 900 || document.documentElement.classList.contains('layout-mobile') ? 'compact' : 'desktop';
}

function findVisibleHeader(selector, childSelector) {
  return Array.from(document.querySelectorAll(selector)).find((header) => dom.isVisible(header) && Boolean(header.querySelector(childSelector))) || null;
}

export function findSurface() {
  const modern = findVisibleHeader('header.MuiAppBar-root', '.MuiToolbar-root');
  if (modern) return { header: modern, kind: 'modern' };

  const legacy = findVisibleHeader('.skinHeader', '.headerTop');
  return legacy ? { header: legacy, kind: 'legacy' } : null;
}

function ownAttribute(mount, element, name) {
  const existing = mount.ownedAttributes.find((record) => record.element === element && record.name === name);
  if (!existing) {
    mount.ownedAttributes.push({
      element,
      hadValue: element.hasAttribute(name),
      name,
      value: element.getAttribute(name),
    });
  }
}

function ownStyle(mount, element, name) {
  const existing = mount.ownedStyles.find((record) => record.element === element && record.name === name);
  if (!existing) {
    mount.ownedStyles.push({
      element,
      name,
      priority: element.style.getPropertyPriority(name),
      value: element.style.getPropertyValue(name),
    });
  }
}

export function mark(mount, element, name, value) {
  if (!element) return;

  ownAttribute(mount, element, name);
  const nextValue = value === undefined ? 'true' : value;
  if (element.getAttribute(name) !== nextValue) {
    element.setAttribute(name, nextValue);
  }
}

export function setStyle(mount, element, name, value, priority) {
  if (!element) return;

  ownStyle(mount, element, name);
  const nextPriority = priority || '';
  if (element.style.getPropertyValue(name) !== value || element.style.getPropertyPriority(name) !== nextPriority) {
    element.style.setProperty(name, value, nextPriority);
  }
}

export function applySettings(mount, settings) {
  const root = document.documentElement;
  const variables = {
    '--sleekfin-header-active-background': settings.activeItemBackgroundColor,
    '--sleekfin-header-active-opacity': String(settings.activeItemOpacity / 100),
    '--sleekfin-header-active-text': settings.activeItemTextColor,
    '--sleekfin-header-bar-padding': `${settings.barPadding}px`,
    '--sleekfin-header-bar-top': `${(settings.height - settings.itemHeight - 2 * settings.barPadding) / 2}px`,
    '--sleekfin-header-brand-gap': `${settings.brandSpacing}px`,
    '--sleekfin-header-brand-top': `${(settings.height - settings.logoHeight) / 2}px`,
    '--sleekfin-header-height': `${settings.height}px`,
    '--sleekfin-header-hover-opacity': String(settings.hoverOpacity / 100),
    '--sleekfin-header-item-background': settings.itemBackgroundColor,
    '--sleekfin-header-item-height': `${settings.itemHeight}px`,
    '--sleekfin-header-item-spacing': `${settings.itemSpacing}px`,
    '--sleekfin-header-item-text': settings.itemTextColor,
    '--sleekfin-header-logo-height': `${settings.logoHeight}px`,
    '--sleekfin-header-menu-top': `${(settings.height - 32) / 2}px`,
    '--sleekfin-header-name-color': settings.serverNameColor,
  };

  Object.keys(variables).forEach((name) => setStyle(mount, root, name, variables[name]));
  mark(mount, root, 'data-sleekfin-header-bar-position', settings.barPosition.toLowerCase());
  mark(mount, root, 'data-sleekfin-header-brand-display', settings.brandDisplay.toLowerCase());
  mark(mount, root, 'data-sleekfin-header-brand-position', settings.brandPosition.toLowerCase());
}

export function updateLayoutMeasurements(mount, container, brandElement, settings) {
  const style = window.getComputedStyle(container);
  const rootStyle = window.getComputedStyle(document.documentElement);
  const gutter = Number.parseFloat(rootStyle.getPropertyValue('--sleekfin-page-gutter'));
  mount.layoutPadding ||= { left: Number.parseFloat(style.paddingLeft) || 0, right: Number.parseFloat(style.paddingRight) || 0 };
  const baseLeft = Number.isFinite(gutter) ? gutter : mount.layoutPadding.left;
  const baseRight = Number.isFinite(gutter) ? gutter : mount.layoutPadding.right;
  const containerRect = container.getBoundingClientRect();
  const contentLeft = containerRect.left + baseLeft;
  const contentRight = containerRect.right - baseRight;
  let safeLeft = contentLeft;
  let safeRight = contentRight;
  if (dom.isVisible(mount.menu)) safeLeft = Math.max(safeLeft, mount.menu.getBoundingClientRect().right + 10);
  if (dom.isVisible(brandElement)) {
    const brandRect = brandElement.getBoundingClientRect();
    if (settings.brandPosition === 'Left') safeLeft = Math.max(safeLeft, brandRect.right + 12);
    else if (settings.brandPosition === 'Right') safeRight = Math.min(safeRight, brandRect.left - 12);
    else if (settings.barPosition === 'Left') safeRight = Math.min(safeRight, brandRect.left - 12);
    else if (settings.barPosition === 'Right') safeLeft = Math.max(safeLeft, brandRect.right + 12);
    else {
      const leftSpace = brandRect.left - 12 - safeLeft;
      const rightSpace = safeRight - brandRect.right - 12;
      if (rightSpace >= leftSpace) safeLeft = Math.max(safeLeft, brandRect.right + 12);
      else safeRight = Math.min(safeRight, brandRect.left - 12);
    }
  }

  safeLeft = Math.max(contentLeft, Math.min(contentRight, safeLeft));
  safeRight = Math.max(safeLeft, Math.min(contentRight, safeRight));
  const leftReserve = Math.ceil(safeLeft - contentLeft);
  const rightReserve = Math.ceil(contentRight - safeRight);
  setStyle(mount, document.documentElement, '--sleekfin-header-left-reserve', `${leftReserve}px`);
  setStyle(mount, document.documentElement, '--sleekfin-header-right-reserve', `${rightReserve}px`);
  setStyle(mount, container, 'padding-left', `${baseLeft + leftReserve}px`, 'important');
  setStyle(mount, container, 'padding-right', `${baseRight + rightReserve}px`, 'important');
}

export function directChildren(element) {
  return element ? Array.from(element.children) : [];
}

export function rememberMove(mount, element) {
  mount.movedNodes.push({
    element,
    nextSibling: element.nextSibling,
    parent: element.parentNode,
  });
}

export function move(mount, element, destination) {
  if (!element || !destination || element.parentNode === destination) return;

  rememberMove(mount, element);
  destination.appendChild(element);
}

export function updateScrolledState(mount) {
  mark(mount, mount.header, 'data-sleekfin-scrolled', window.scrollY > 20 ? 'true' : 'false');
}

function restoreOwnedAttributes(mount) {
  mount.ownedAttributes
    .slice()
    .reverse()
    .forEach((record) => {
      if (record.hadValue) {
        record.element.setAttribute(record.name, record.value);
      } else {
        record.element.removeAttribute(record.name);
      }
    });
}

function restoreMovedNodes(mount) {
  for (let index = mount.movedNodes.length - 1; index >= 0; index -= 1) {
    const record = mount.movedNodes[index];
    if (!dom.isConnected(record.element) || !dom.isConnected(record.parent)) {
      continue;
    }

    const nextSibling = record.nextSibling?.parentNode === record.parent ? record.nextSibling : null;
    record.parent.insertBefore(record.element, nextSibling);
  }
}

function restoreOwnedStyles(mount) {
  mount.ownedStyles
    .slice()
    .reverse()
    .forEach((record) => {
      if (record.value) {
        record.element.style.setProperty(record.name, record.value, record.priority);
      } else {
        record.element.style.removeProperty(record.name);
      }
    });
}

export function cleanup(mount) {
  if (!mount) return;

  mount.active = false;
  if (mount.animationFrame) {
    window.cancelAnimationFrame(mount.animationFrame);
    mount.animationFrame = 0;
  }
  mount.resizeObserver?.disconnect();
  restoreOwnedAttributes(mount);
  restoreOwnedStyles(mount);
  restoreMovedNodes(mount);
  mount.proxy?.remove();
  mount.cluster?.remove();
}

export function createMount(values) {
  return {
    active: true,
    animationFrame: 0,
    movedNodes: [],
    ownedAttributes: [],
    ownedStyles: [],
    ...values,
  };
}
