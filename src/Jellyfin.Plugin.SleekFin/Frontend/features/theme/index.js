const ROOT_CLASS = 'sleekfin-main-ui';
const WINDOW_EVENTS = ['hashchange', 'pageshow', 'popstate'];

function createThemeFeature() {
  let started = false;

  function isDashboardRoute() {
    const route = (window.location.hash.slice(1) || window.location.pathname).split('?')[0].toLowerCase();
    return route === '/dashboard' || route.startsWith('/dashboard/') || route === '/configurationpage' || route === '/metadata';
  }

  function reconcile() {
    document.documentElement.classList.toggle(ROOT_CLASS, !isDashboardRoute());
  }

  function start() {
    if (started || !document.documentElement) return;

    started = true;
    WINDOW_EVENTS.forEach((eventName) => window.addEventListener(eventName, reconcile));
    reconcile();
  }

  function stop() {
    started = false;
    WINDOW_EVENTS.forEach((eventName) => window.removeEventListener(eventName, reconcile));
    document.documentElement?.classList.remove(ROOT_CLASS);
  }

  return { start, stop };
}

const features = (window.SleekFinFeatures = window.SleekFinFeatures || {});
features.theme?.stop?.();
features.theme = createThemeFeature();
features.theme.start();
