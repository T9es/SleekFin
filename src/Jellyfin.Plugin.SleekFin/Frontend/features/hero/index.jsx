import { dom, h, render } from '../../shared/runtime.js';
import { Hero } from './Hero.jsx';
import { loadEntries, loadSettings } from './source.js';

const WINDOW_EVENTS = ['hashchange', 'popstate', 'pageshow'];
const ROOT_BOOT_LOADING_CLASS = 'sleekfin-hero-boot-loading';
const ROOT_LOADING_CLASS = 'sleekfin-hero-loading';
const features = (window.SleekFinFeatures = window.SleekFinFeatures || {});

features.hero?.stop?.();

const state = {
  failedHost: null,
  generation: 0,
  loadingTimer: 0,
  mount: null,
  readyFrame: 0,
  reconcileTimer: 0,
  started: false,
  stopWatching: null,
};

function finishLoading() {
  window.clearTimeout(state.loadingTimer);
  state.loadingTimer = 0;
  document.documentElement.classList.remove(ROOT_BOOT_LOADING_CLASS, ROOT_LOADING_CLASS);
}

function prepareLoading() {
  const root = document.documentElement;
  if (root.classList.contains(ROOT_BOOT_LOADING_CLASS) || (state.loadingTimer && root.classList.contains(ROOT_LOADING_CLASS))) return;
  root.classList.add(ROOT_LOADING_CLASS);
  state.loadingTimer = window.setTimeout(finishLoading, 4000);
}

function isHomeRoute() {
  const match = window.location.hash.match(/^#\/(?:home)?(?:\?([^#]*))?$/);
  if (!match) return false;

  const tab = new URLSearchParams(match[1] || '').get('tab');
  return !tab || tab === '0';
}

function findHost() {
  if (!isHomeRoute()) return null;
  return Array.from(document.querySelectorAll('#indexPage #homeTab.is-active .sections')).find(dom.isVisible) || null;
}

function removeMount() {
  if (!state.mount) return;
  window.cancelAnimationFrame(state.readyFrame);
  state.readyFrame = 0;
  render(null, state.mount);
  state.mount.remove();
  state.mount = null;
}

function unmount() {
  state.generation += 1;
  state.failedHost = null;
  removeMount();
}

function createRoot(host) {
  // Jellyfin's customized items container is upgraded only when its `is` attribute is parsed.
  const root = dom.element('<div is="emby-itemscontainer" class="sleekfin-hero itemsContainer" data-contextmenu="false" data-multiselect="false" data-state="loading"></div>');
  host.parentNode.insertBefore(root, host);
  state.mount = root;
  finishLoading();
  if (window.CustomElements && typeof window.CustomElements.upgradeSubtree === 'function') {
    window.CustomElements.upgradeSubtree(root);
  }
  return root;
}

function renderHero(root, entries) {
  if (state.mount !== root || !dom.isConnected(root) || !isHomeRoute() || !entries.length) return;

  render(h(Hero, { entries, root }), root);
  state.readyFrame = window.requestAnimationFrame(() => {
    state.readyFrame = 0;
    if (state.mount === root && dom.isConnected(root)) root.dataset.state = 'ready';
  });
}

function mount(host) {
  const client = window.ApiClient;
  const generation = ++state.generation;
  const root = createRoot(host);
  loadSettings(client)
    .then((settings) => loadEntries(client, settings))
    .then((entries) => {
      if (generation !== state.generation) return;
      if (entries.length) {
        renderHero(root, entries);
      } else {
        state.failedHost = host;
        removeMount();
      }
    })
    .catch(() => {
      if (generation === state.generation) {
        state.failedHost = host;
        removeMount();
      }
    });
}

function reconcile() {
  if (!state.started || !window.ApiClient) return;

  const host = findHost();
  if (!host) {
    unmount();
    return;
  }
  if (state.mount && dom.isConnected(state.mount) && state.mount.nextElementSibling === host) return;
  if (state.failedHost === host) return;

  unmount();
  mount(host);
}

function scheduleReconcile() {
  const home = isHomeRoute();
  const loading = home && !dom.isConnected(state.mount) && (!state.failedHost || state.failedHost !== findHost());
  if (!loading) finishLoading();
  else prepareLoading();
  if (state.reconcileTimer) return;
  state.reconcileTimer = window.setTimeout(() => {
    state.reconcileTimer = 0;
    reconcile();
  }, 0);
}

function start() {
  if (state.started) return;

  state.started = true;
  state.stopWatching = dom.watchSpa(scheduleReconcile, {
    events: WINDOW_EVENTS,
    viewshow: true,
  });
  scheduleReconcile();
}

function stop() {
  state.started = false;
  window.clearTimeout(state.reconcileTimer);
  state.reconcileTimer = 0;
  state.stopWatching?.();
  state.stopWatching = null;
  unmount();
  finishLoading();
}

features.hero = { start, stop };

start();
