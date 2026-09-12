import { dom } from '../../shared/runtime.js';
import { createBrandController } from './FallbackBrand.jsx';
import { createLegacyAdapter } from './legacy.js';
import { createModernAdapter } from './modern.js';
import { findSurface, isTvLayout } from './shared.js';

const MAIN_ROOT_CLASS = 'sleekfin-main-ui';
const ROOT_CLASS = 'sleekfin-header-mounted';
const WINDOW_EVENTS = ['hashchange', 'pageshow', 'popstate', 'resize', 'scroll'];

function createHeaderFeature() {
  const state = {
    mount: null,
    reconcileTimer: 0,
    started: false,
    stopWatching: null,
  };
  const brand = createBrandController(() => state.started);
  const adapters = { legacy: createLegacyAdapter(brand), modern: createModernAdapter(brand) };

  function cleanupMount() {
    if (!state.mount) return;

    adapters[state.mount.kind].cleanup(state.mount);
    state.mount = null;
  }

  function unmount() {
    cleanupMount();
    brand.removeFallback();
    document.documentElement.classList.remove(ROOT_CLASS);
  }

  function reconcile() {
    if (!state.started) return;
    if (isTvLayout() || !document.documentElement.classList.contains(MAIN_ROOT_CLASS)) {
      unmount();
      return;
    }

    const surface = findSurface();
    if (!surface) {
      unmount();
      return;
    }

    const adapter = adapters[surface.kind];
    if (!state.mount || state.mount.kind !== surface.kind || adapter.needsReplacement(state.mount, surface)) {
      cleanupMount();
      brand.removeFallback();
      state.mount = adapter.mount(surface.header);
      document.documentElement.classList.add(ROOT_CLASS);
    }
    adapter.refresh(state.mount);
  }

  function scheduleReconcile() {
    if (!state.started) return;
    if (state.reconcileTimer) {
      window.clearTimeout(state.reconcileTimer);
      state.reconcileTimer = 0;
    }
    if (!document.documentElement.classList.contains(MAIN_ROOT_CLASS)) {
      unmount();
      return;
    }

    state.reconcileTimer = window.setTimeout(() => {
      state.reconcileTimer = 0;
      reconcile();
    }, 60);
  }

  function start() {
    if (state.started || !document.body) return;

    state.started = true;
    state.stopWatching = dom.watchSpa(scheduleReconcile, {
      events: WINDOW_EVENTS,
      passiveEvents: ['scroll'],
      viewshow: true,
    });
    reconcile();
  }

  function stop() {
    state.started = false;
    if (state.reconcileTimer) {
      window.clearTimeout(state.reconcileTimer);
      state.reconcileTimer = 0;
    }
    state.stopWatching?.();
    state.stopWatching = null;
    unmount();
  }

  return { start, stop };
}

const features = (window.SleekFinFeatures = window.SleekFinFeatures || {});
features.header?.stop?.();
features.header = createHeaderFeature();
features.header.start();
