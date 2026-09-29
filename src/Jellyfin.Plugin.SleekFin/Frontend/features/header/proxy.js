import { dom, h, render } from '../../shared/runtime.js';
import { HeaderOverflowDrawer } from './HeaderOverflowDrawer.jsx';
import { cloneSourceTemplate, currentSource, discoverHeaderControls, isDashboardRoute, legacyAlias, refreshRecordVisual } from './inventory.js';
import { mark, setStyle } from './shared.js';

function recordForKey(key, discoveries) {
  return discoveries.find((record) => record.key === key) || legacyAlias(key, discoveries);
}

function resolveRecords(mount, settings) {
  const discoveries = discoverHeaderControls(mount);
  const customized = Boolean(settings.itemOrder.length || settings.hiddenItems.length);
  if (!customized) {
    const records = discoveries.filter((record) => record.inline);
    return { customized: Boolean(records.length), hidden: [], records };
  }

  const hidden = [];
  const hiddenSources = new Set();
  settings.hiddenItems.forEach((key) => {
    const record = recordForKey(key, discoveries);
    if (record && !hiddenSources.has(record.source)) {
      hiddenSources.add(record.source);
      hidden.push(record);
    }
  });

  const records = [];
  const usedKeys = new Set(settings.hiddenItems);
  const usedSources = new Set(hiddenSources);
  settings.itemOrder.forEach((key) => {
    usedKeys.add(key);
    if (key === 'space' || key === 'separator') {
      if (!settings.hiddenItems.includes(key) && (key !== 'separator' || !isDashboardRoute())) records.push({ key, source: null });
      return;
    }

    const record = recordForKey(key, discoveries);
    if (record && !hiddenSources.has(record.source)) {
      usedSources.add(record.source);
      records.push({ ...record, key });
    }
  });

  discoveries.forEach((record) => {
    if (record.inline && !usedKeys.has(record.key) && !usedSources.has(record.source)) {
      usedSources.add(record.source);
      records.push(record);
    }
  });
  return { customized, hidden, records };
}

function createStructuralItem(key) {
  const item = document.createElement('span');
  item.setAttribute(key === 'space' ? 'data-sleekfin-header-space' : 'data-sleekfin-header-separator', 'true');
  return item;
}

function sourceTitle(record) {
  return record.source.getAttribute('title')?.trim() || record.source.getAttribute('aria-label')?.trim() || record.caption;
}

function sourceDisabled(record) {
  return Boolean(record.source.disabled) || record.source.getAttribute('aria-disabled') === 'true';
}

function renderProxyVisual(record) {
  const template = cloneSourceTemplate(record.template);
  record.button.textContent = '';
  while (template.firstChild) record.button.appendChild(template.firstChild);
  const shape = record.template.getAttribute('data-sleekfin-header-source-visual');
  if (shape === 'icon-only') record.button.setAttribute('data-sleekfin-header-icon-only', 'true');
  else record.button.removeAttribute('data-sleekfin-header-icon-only');
  record.button.disabled = sourceDisabled(record);
  record.button.style.display = record.nativeHidden ? 'none' : '';
  record.button.title = sourceTitle(record);
}

function activateSource(mount, record) {
  const route = (window.location.hash || '').toLowerCase();
  const homeRoute = !route || /^#\/home(?:\.html)?(?:[?]|$)/.test(route);
  if (mount.kind === 'legacy' && !homeRoute && record.key.startsWith('sf:')) {
    window.location.hash = `#/home?seerrfinTab=${record.key.slice(3)}`;
    return;
  }
  if (mount.kind === 'legacy' && !homeRoute && record.key.startsWith('je:')) {
    const index = record.source.getAttribute('data-index');
    if (index) {
      window.location.hash = `#/home?tab=${index}`;
      return;
    }
  }
  record.source.click();
}

function createProxyButton(mount, record) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-sleekfin-header-proxy-item', record.key);
  button.setAttribute('data-sleekfin-header-native-hit-target', record.nativeHitTarget ? 'true' : 'false');
  record.button = button;
  renderProxyVisual(record);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (dom.isConnected(record.source) && !sourceDisabled(record)) {
      syncPopupAnchors(mount, record, button);
      activateSource(mount, record);
      window.setTimeout(() => {
        if (mount.active) refreshHeaderProxy(mount);
      }, 0);
    }
  });
  return button;
}

function createOverflowToggle() {
  const button = document.createElement('button');
  const caret = document.createElement('span');
  button.type = 'button';
  button.title = 'More header items';
  button.setAttribute('data-sleekfin-header-overflow-toggle', 'true');
  button.setAttribute('data-sleekfin-header-overflow-hidden', 'true');
  caret.setAttribute('data-sleekfin-header-overflow-caret', 'true');
  button.appendChild(caret);
  return button;
}

function nativeTargetAvailable(record) {
  return (
    record.nativeHitTarget &&
    !record.fallback &&
    dom.isConnected(record.source) &&
    dom.isConnected(record.button) &&
    !sourceDisabled(record) &&
    !record.button.disabled &&
    record.button.style.display !== 'none'
  );
}

function refreshNativeTargetMode(mount) {
  const enabled = mount.kind === 'modern' && mount.header.classList.contains('osdHeader');
  mark(mount, mount.header, 'data-sleekfin-header-native-targets', enabled ? 'true' : 'false');
  if (mount.nativePointerTargets === enabled) return;

  mount.nativePointerTargets = enabled;
  mount.proxyRecords.forEach((record) => {
    record.nativeHitTarget = enabled && Boolean(record.source) && !record.fallback;
    record.button?.setAttribute('data-sleekfin-header-native-hit-target', record.nativeHitTarget ? 'true' : 'false');
    if (record.nativeHitTarget) {
      mark(mount, record.source, 'data-sleekfin-header-source-hidden', 'false');
    } else {
      mark(mount, record.source, 'data-sleekfin-header-source-hit-target', 'false');
    }
  });
}

function addNativeTargetArea(areas, source, rectangle) {
  if (rectangle.right <= rectangle.left || rectangle.bottom <= rectangle.top) return;
  const rectangles = areas.get(source) || [];
  rectangles.push(rectangle);
  areas.set(source, rectangles);
}

function inlineNativeTargetAreas(mount) {
  const areas = new Map();
  mount.proxyRecords.filter(nativeTargetAvailable).forEach((record) => {
    if (record.button.getAttribute('data-sleekfin-header-overflowed') !== 'true') {
      addNativeTargetArea(areas, record.source, record.button.getBoundingClientRect());
    }
  });
  return areas;
}

function cssPathNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function applyNativeTargetArea(mount, source, rectangles) {
  if (!rectangles.length) {
    mark(mount, source, 'data-sleekfin-header-source-hit-target', 'false');
    return;
  }

  const left = Math.min(...rectangles.map((rectangle) => rectangle.left));
  const top = Math.min(...rectangles.map((rectangle) => rectangle.top));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.right));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.bottom));
  setStyle(mount, source, 'left', `${left}px`, 'important');
  setStyle(mount, source, 'top', `${top}px`, 'important');
  setStyle(mount, source, 'height', `${bottom - top}px`, 'important');
  setStyle(mount, source, 'width', `${right - left}px`, 'important');
  const path = rectangles.map((rectangle) => {
    const x1 = cssPathNumber(rectangle.left - left);
    const y1 = cssPathNumber(rectangle.top - top);
    const x2 = cssPathNumber(rectangle.right - left);
    const y2 = cssPathNumber(rectangle.bottom - top);
    return `M ${x1} ${y1} H ${x2} V ${y2} H ${x1} Z`;
  }).join(' ');
  setStyle(mount, source, 'clip-path', rectangles.length > 1 ? `path("${path}")` : 'none', 'important');
  mark(mount, source, 'data-sleekfin-header-source-hit-target', 'true');
}

function applyNativeTargetAreas(mount, areas, preserveSource) {
  const sources = new Set(mount.proxyRecords.filter((record) => record.nativeHitTarget).map((record) => record.source));
  sources.forEach((source) => {
    if (source !== preserveSource) applyNativeTargetArea(mount, source, areas.get(source) || []);
  });
}

function createOverflowController(mount, toggle) {
  const root = document.createElement('div');
  let open = false;
  let records = [];
  let drawerTargetFrame = 0;
  document.body.appendChild(root);

  function syncDrawerNativeTargets() {
    if (!mount.nativePointerTargets || !open) return;
    const drawer = root.querySelector('[data-sleekfin-header-overflow-drawer]');
    if (!drawer) {
      applyNativeTargetAreas(mount, inlineNativeTargetAreas(mount));
      return;
    }

    const bounds = drawer.getBoundingClientRect();
    const clip = {
      bottom: Math.min(window.innerHeight, bounds.top + drawer.clientTop + drawer.clientHeight),
      left: Math.max(0, bounds.left + drawer.clientLeft),
      right: Math.min(window.innerWidth, bounds.left + drawer.clientLeft + drawer.clientWidth),
      top: Math.max(0, bounds.top + drawer.clientTop),
    };
    const areas = inlineNativeTargetAreas(mount);
    const buttons = new Map(Array.from(root.querySelectorAll('[data-sleekfin-header-overflow-item]')).map((button) => [button.getAttribute('data-sleekfin-header-overflow-index'), button]));
    records.forEach((record, index) => {
      const button = buttons.get(String(index));
      if (!nativeTargetAvailable(record) || !button || button.disabled) return;

      const buttonBounds = button.getBoundingClientRect();
      const left = Math.max(clip.left, buttonBounds.left);
      const top = Math.max(clip.top, buttonBounds.top);
      const right = Math.min(clip.right, buttonBounds.right);
      const bottom = Math.min(clip.bottom, buttonBounds.bottom);
      addNativeTargetArea(areas, record.source, { bottom, left, right, top });
    });
    applyNativeTargetAreas(mount, areas);
  }

  function scheduleDrawerNativeTargets() {
    if (!mount.nativePointerTargets || !open || drawerTargetFrame) return;
    drawerTargetFrame = window.requestAnimationFrame(() => {
      drawerTargetFrame = 0;
      syncDrawerNativeTargets();
    });
  }

  function close(preserveSource) {
    if (!open) return;
    open = false;
    if (drawerTargetFrame) {
      window.cancelAnimationFrame(drawerTargetFrame);
      drawerTargetFrame = 0;
    }
    render(null, root);
    if (mount.nativePointerTargets) {
      mark(mount, mount.header, 'data-sleekfin-header-overflow-open', 'false');
      if (preserveSource) {
        mark(mount, preserveSource, 'data-sleekfin-header-source-hit-target', 'false');
        applyNativeTargetAreas(mount, inlineNativeTargetAreas(mount), preserveSource);
      } else {
        syncPopupAnchors(mount);
      }
    }
  }

  function activate(record, anchor) {
    if (!record.source || !dom.isConnected(record.source) || sourceDisabled(record)) return;
    syncPopupAnchors(mount, record, anchor);
    close(mount.nativePointerTargets && record.nativeHitTarget && record.popup ? record.source : null);
    activateSource(mount, record);
    window.setTimeout(() => {
      if (mount.active) refreshHeaderProxy(mount);
    }, 0);
  }

  function draw() {
    if (!open) return;
    if (!records.length || !dom.isConnected(toggle)) {
      close();
      return;
    }
    render(h(HeaderOverflowDrawer, { anchor: toggle, onActivate: activate, onClose: close, records }), root);
    if (mount.nativePointerTargets) {
      mark(mount, mount.header, 'data-sleekfin-header-overflow-open', 'true');
      syncDrawerNativeTargets();
    }
  }

  function nativeOccurrenceAtPoint(source, event) {
    const containsPoint = (rectangle) => event.clientX >= rectangle.left && event.clientX <= rectangle.right && event.clientY >= rectangle.top && event.clientY <= rectangle.bottom;
    const inline = mount.proxyRecords
      .filter((record) => record.source === source && nativeTargetAvailable(record) && record.button.getAttribute('data-sleekfin-header-overflowed') !== 'true')
      .map((record) => record.button.getBoundingClientRect())
      .find(containsPoint);
    if (inline) return inline;
    if (!open) return null;

    const buttons = new Map(Array.from(root.querySelectorAll('[data-sleekfin-header-overflow-item]')).map((button) => [button.getAttribute('data-sleekfin-header-overflow-index'), button]));
    const index = records.findIndex((record, row) => {
      if (record.source !== source || !nativeTargetAvailable(record)) return false;
      const button = buttons.get(String(row));
      return Boolean(button && !button.disabled && containsPoint(button.getBoundingClientRect()));
    });
    if (index < 0) return null;
    return buttons.get(String(index))?.getBoundingClientRect() || null;
  }

  function closeOnNativeTargetClick(event) {
    if (!mount.nativePointerTargets) return;
    const record = mount.proxyRecords.find((candidate) => candidate.nativeHitTarget && candidate.source.contains(event.target));
    if (!record) return;
    const preserveSource = record.popup && event.detail > 0 ? record.source : null;
    if (preserveSource) {
      const rectangle = nativeOccurrenceAtPoint(preserveSource, event);
      if (rectangle) applyNativeTargetArea(mount, preserveSource, [rectangle]);
    }
    if (open) window.queueMicrotask(() => {
      if (mount.active) close(preserveSource);
    });
  }

  function restoreNativeTargetsOnProxyPointerOver(event) {
    if (mount.nativePointerTargets && event.target?.closest?.('[data-sleekfin-header-proxy-item], [data-sleekfin-header-overflow-item]')) syncPopupAnchors(mount);
  }

  if (mount.kind === 'modern') document.addEventListener('click', closeOnNativeTargetClick, true);
  if (mount.kind === 'modern') document.addEventListener('pointerover', restoreNativeTargetsOnProxyPointerOver, true);
  if (mount.kind === 'modern') root.addEventListener('scroll', scheduleDrawerNativeTargets, true);

  function sync(nextRecords) {
    records = nextRecords.map((record) => ({ ...record, current: record.source ? currentSource(record) : false, disabled: record.source ? sourceDisabled(record) : false }));
    draw();
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!records.length) return;
    open = !open;
    draw();
  });

  return {
    close,
    destroy() {
      render(null, root);
      root.remove();
      if (mount.kind === 'modern') {
        document.removeEventListener('click', closeOnNativeTargetClick, true);
        document.removeEventListener('pointerover', restoreNativeTargetsOnProxyPointerOver, true);
        root.removeEventListener('scroll', scheduleDrawerNativeTargets, true);
      }
      if (drawerTargetFrame) window.cancelAnimationFrame(drawerTargetFrame);
    },
    sync,
    syncNativeTargets: syncDrawerNativeTargets,
  };
}

function proxyContentOverflows(mount) {
  const proxyBounds = mount.proxy.getBoundingClientRect();
  let left = Math.max(0, proxyBounds.left);
  let right = Math.min(window.innerWidth, proxyBounds.right);
  let parent = mount.proxy.parentElement;
  while (parent) {
    if (/^(?:auto|clip|hidden|scroll)$/.test(window.getComputedStyle(parent).overflowX)) {
      const parentBounds = parent.getBoundingClientRect();
      left = Math.max(left, parentBounds.left);
      right = Math.min(right, parentBounds.right);
    }
    parent = parent.parentElement;
  }
  const children = [...mount.proxyEntries.map((entry) => entry.element), mount.overflowToggle].filter(
    (element) => element.getAttribute('data-sleekfin-header-overflowed') !== 'true' && element.getAttribute('data-sleekfin-header-overflow-hidden') !== 'true',
  );
  return mount.proxy.scrollWidth > mount.proxy.clientWidth + 1 || children.some((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left < left - 1 || bounds.right > right + 1;
  });
}

function updateOverflow(mount) {
  if (!mount.proxy) return;

  mount.proxyEntries.forEach((entry) => entry.element.setAttribute('data-sleekfin-header-overflowed', 'false'));
  mount.overflowToggle.setAttribute('data-sleekfin-header-overflow-hidden', 'true');
  if (!proxyContentOverflows(mount)) {
    mount.proxy.setAttribute('data-sleekfin-header-overflow-active', 'false');
    mount.overflow.sync([]);
    mount.updateBrandOverlap?.();
    return;
  }

  mount.proxy.setAttribute('data-sleekfin-header-overflow-active', 'true');
  mount.overflowToggle.setAttribute('data-sleekfin-header-overflow-hidden', 'false');
  for (let index = mount.proxyEntries.length - 1; index >= 0 && proxyContentOverflows(mount); index -= 1) {
    mount.proxyEntries[index].element.setAttribute('data-sleekfin-header-overflowed', 'true');
  }
  const records = mount.proxyEntries.filter((entry) => entry.element.getAttribute('data-sleekfin-header-overflowed') === 'true').map((entry) => entry.record);
  const hasItems = records.some((record) => record.source);
  if (!hasItems) mount.overflowToggle.setAttribute('data-sleekfin-header-overflow-hidden', 'true');
  mount.overflow.sync(hasItems ? records : []);
  mount.updateBrandOverlap?.();
}

function scheduleHeaderProxyLayout(mount) {
  if (!mount.proxy || !mount.active || mount.proxyFrame) return;
  mount.proxyFrame = window.requestAnimationFrame(() => {
    mount.proxyFrame = 0;
    if (mount.active && dom.isConnected(mount.proxy)) updateOverflow(mount);
  });
}

function markEmptySegments(mount) {
  const sources = new Set([...mount.proxyRecords, ...mount.hiddenRecords].filter((record) => !record.fallback).map((record) => record.source));
  const markSegment = (segment) => {
    if (!segment) return;
    const controls = Array.from(segment.querySelectorAll('button, a[href]')).filter(
      (source) =>
        !source.closest('[data-sleekfin-header-proxy]') &&
        !source.matches('[data-sleekfin-header-brand], .je-header-more-toggle, .mainDrawerButton'),
    );
    mark(mount, segment, 'data-sleekfin-header-all-proxied', controls.every((source) => sources.has(source)) ? 'true' : 'false');
  };
  markSegment(mount.nav);
  markSegment(mount.actions);
  markSegment(mount.profile);
}

function hideProviderWrappers(mount) {
  const randomContainer = mount.header.querySelector('#randomItemButtonContainer');
  if (randomContainer) {
    mark(mount, randomContainer, 'data-sleekfin-header-source-hidden', mount.hiddenSources.has(randomContainer.querySelector('#randomItemButton')) ? 'true' : 'false');
  }

  const enhancedGroup = mount.header.querySelector('#je-native-tabs-group');
  if (enhancedGroup) {
    const hasUnmanagedButton = Array.from(enhancedGroup.querySelectorAll('button')).some((button) => !mount.hiddenSources.has(button));
    mark(mount, enhancedGroup.querySelector('#je-native-tabs-separator'), 'data-sleekfin-header-source-hidden', hasUnmanagedButton ? 'false' : 'true');
  }

  const enhancedTray = mount.header.querySelector('#je-header-buttons-group');
  if (enhancedTray) {
    const hasUnmanagedButton = Array.from(enhancedTray.querySelectorAll('button, a')).some(
      (button) => !button.classList.contains('je-header-more-toggle') && !mount.hiddenSources.has(button),
    );
    const hasPopupAnchor = Boolean(enhancedTray.querySelector('[data-sleekfin-header-source-anchor]'));
    mark(mount, enhancedTray, 'data-sleekfin-header-source-hidden', !hasUnmanagedButton && !hasPopupAnchor ? 'true' : 'false');
    mark(mount, enhancedTray, 'data-sleekfin-header-all-proxied', !hasUnmanagedButton ? 'true' : 'false');
  }
}

function hideSources(mount) {
  mount.hiddenSources = new Set();
  mount.proxyRecords.forEach((record) => {
    if (record.fallback) return;
    mount.hiddenSources.add(record.source);
    if (record.nativeHitTarget || record.popup) {
      mark(mount, record.source, 'data-sleekfin-header-source-anchor');
      mark(mount, record.source, 'tabindex', '-1');
      if (record.nativeHitTarget) mark(mount, record.source, 'data-sleekfin-header-source-hit-target', 'false');
    } else {
      mark(mount, record.source, 'data-sleekfin-header-source-hidden');
    }
  });
  mount.hiddenRecords.forEach((record) => {
    if (!record.fallback) {
      mount.hiddenSources.add(record.source);
      mark(mount, record.source, 'data-sleekfin-header-source-hidden');
    }
  });
  hideProviderWrappers(mount);
  markEmptySegments(mount);
}

function syncPopupAnchors(mount, activeRecord, activeAnchor) {
  if (activeRecord) {
    if (activeRecord.nativeHitTarget) {
      if (activeRecord.popup && nativeTargetAvailable(activeRecord) && dom.isConnected(activeAnchor)) {
        applyNativeTargetArea(mount, activeRecord.source, [activeAnchor.getBoundingClientRect()]);
      }
      return;
    }
    if (!activeRecord.popup || activeRecord.fallback || !dom.isConnected(activeAnchor)) return;
    const rectangle = activeAnchor.getBoundingClientRect();
    setStyle(mount, activeRecord.source, 'left', `${Math.round(rectangle.left)}px`, 'important');
    setStyle(mount, activeRecord.source, 'top', `${Math.round(rectangle.top)}px`, 'important');
    setStyle(mount, activeRecord.source, 'height', `${Math.max(1, Math.round(rectangle.height))}px`, 'important');
    setStyle(mount, activeRecord.source, 'width', `${Math.max(1, Math.round(rectangle.width))}px`, 'important');
    return;
  }

  if (mount.nativePointerTargets) {
    applyNativeTargetAreas(mount, inlineNativeTargetAreas(mount));
    mount.overflow?.syncNativeTargets();
  }
  mount.proxyRecords.filter((record) => record.popup && !record.nativeHitTarget && !record.fallback && dom.isConnected(record.button)).forEach((record) => {
    if (record.button.getAttribute('data-sleekfin-header-overflowed') === 'true') return;
    const rectangle = record.button.getBoundingClientRect();
    setStyle(mount, record.source, 'left', `${Math.round(rectangle.left)}px`, 'important');
    setStyle(mount, record.source, 'top', `${Math.round(rectangle.top)}px`, 'important');
    setStyle(mount, record.source, 'height', `${Math.max(1, Math.round(rectangle.height))}px`, 'important');
    setStyle(mount, record.source, 'width', `${Math.max(1, Math.round(rectangle.width))}px`, 'important');
  });
}

export function createHeaderProxy(mount, parent, before, settings) {
  const resolved = resolveRecords(mount, settings);
  if (!resolved.customized) return null;
  mount.nativePointerTargets = mount.kind === 'modern' && mount.header.classList.contains('osdHeader');
  mark(mount, mount.header, 'data-sleekfin-header-native-targets', mount.nativePointerTargets ? 'true' : 'false');
  resolved.records.forEach((record) => {
    record.nativeHitTarget = mount.nativePointerTargets && Boolean(record.source) && !record.fallback;
  });

  const proxy = document.createElement('div');
  proxy.setAttribute('data-sleekfin-header-proxy', mount.kind);
  mount.proxyEntries = resolved.records.map((record) => {
    const element = record.source ? createProxyButton(mount, record) : createStructuralItem(record.key);
    proxy.appendChild(element);
    return { element, record };
  });
  mount.overflowToggle = createOverflowToggle();
  proxy.appendChild(mount.overflowToggle);
  parent.insertBefore(proxy, before || null);
  mount.proxyRecords = resolved.records.filter((record) => record.source);
  mount.hiddenRecords = resolved.hidden;
  mount.overflow = createOverflowController(mount, mount.overflowToggle);
  mark(mount, mount.header, 'data-sleekfin-header-proxy-active');
  hideSources(mount);
  window.requestAnimationFrame(() => {
    if (mount.active) {
      updateOverflow(mount);
      syncPopupAnchors(mount);
    }
  });
  return proxy;
}

export function needsProxyReplacement(mount, settings) {
  const resolved = resolveRecords(mount, settings);
  if (Boolean(mount.proxy) !== resolved.customized) return true;
  if (!mount.proxy) return false;
  if (!dom.isConnected(mount.proxy) || resolved.records.length !== mount.proxyEntries.length || resolved.hidden.length !== mount.hiddenRecords.length) return true;
  if (resolved.hidden.some((record, index) => record.source !== mount.hiddenRecords[index].source)) return true;
  return resolved.records.some((record, index) => record.key !== mount.proxyEntries[index].record.key || record.source !== mount.proxyEntries[index].record.source);
}

export function refreshHeaderProxy(mount) {
  if (!mount.proxy) return;

  refreshNativeTargetMode(mount);
  hideSources(mount);
  mount.proxyRecords.forEach((record) => {
    if (refreshRecordVisual(record)) renderProxyVisual(record);
    record.button.disabled = sourceDisabled(record);
    record.button.style.display = record.nativeHidden ? 'none' : '';
    record.button.setAttribute('data-sleekfin-current', currentSource(record) ? 'true' : 'false');
  });
  syncPopupAnchors(mount);
  scheduleHeaderProxyLayout(mount);
}
