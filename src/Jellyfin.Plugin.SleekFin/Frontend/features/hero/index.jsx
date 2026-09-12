import { dom, h, render } from '../../shared/runtime.js';
import { Hero } from './Hero.jsx';
import { loadEntries, loadSettings } from './source.js';

const WINDOW_EVENTS = ['hashchange', 'popstate', 'pageshow'];
const features = (window.SleekFinFeatures = window.SleekFinFeatures || {});

features.hero?.stop?.();

const state = {
  generation: 0,
  loadingHost: null,
  mount: null,
  reconcileTimer: 0,
  started: false,
  stopWatching: null,
};

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
  render(null, state.mount);
  state.mount.remove();
  state.mount = null;
}

function unmount() {
  state.generation += 1;
  state.loadingHost = null;
  removeMount();
}

function renderHero(host, entries) {
  if (!dom.isConnected(host) || !isHomeRoute() || !entries.length) return;

  // Jellyfin's customized items container is upgraded only when its `is` attribute is parsed.
  const root = dom.element('<div is="emby-itemscontainer" class="sleekfin-hero itemsContainer" data-contextmenu="false" data-multiselect="false"></div>');
  render(h(Hero, { entries, root }), root);
  host.parentNode.insertBefore(root, host);
  state.mount = root;
  if (window.CustomElements && typeof window.CustomElements.upgradeSubtree === 'function') {
    window.CustomElements.upgradeSubtree(root);
  }
}

function mount(host) {
  const client = window.ApiClient;
  const generation = ++state.generation;
  state.loadingHost = host;
  loadSettings(client)
    .then((settings) => loadEntries(client, settings))
    .then((entries) => {
      if (generation !== state.generation) return;
      state.loadingHost = null;
      renderHero(host, entries);
    })
    .catch(() => {
      if (generation === state.generation) {
        state.loadingHost = null;
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
  if (state.loadingHost === host) return;

  unmount();
  mount(host);
}

function scheduleReconcile() {
  window.clearTimeout(state.reconcileTimer);
  state.reconcileTimer = window.setTimeout(reconcile, 80);
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
}

features.hero = { start, stop };

start();
