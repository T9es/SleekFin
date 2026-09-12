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

export function mark(mount, element, name, value) {
  if (!element) return;

  ownAttribute(mount, element, name);
  const nextValue = value === undefined ? 'true' : value;
  if (element.getAttribute(name) !== nextValue) {
    element.setAttribute(name, nextValue);
  }
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

export function cleanup(mount) {
  if (!mount) return;

  mount.active = false;
  if (mount.animationFrame) {
    window.cancelAnimationFrame(mount.animationFrame);
    mount.animationFrame = 0;
  }
  mount.resizeObserver?.disconnect();
  restoreOwnedAttributes(mount);
  restoreMovedNodes(mount);
  mount.cluster?.remove();
}

export function createMount(values) {
  return {
    active: true,
    animationFrame: 0,
    movedNodes: [],
    ownedAttributes: [],
    ...values,
  };
}
