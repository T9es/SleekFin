(function (global) {
    'use strict';

    var MODULE_VERSION = '0.2.0';
    var ROOT_CLASS = 'sleekfin-main-ui';
    var WINDOW_EVENTS = ['hashchange', 'pageshow', 'popstate'];
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var document = global.document;

    if (!document || !document.documentElement) {
        return;
    }

    if (NAMESPACE.theme && NAMESPACE.theme.version === MODULE_VERSION) {
        NAMESPACE.theme.reconcile();
        return;
    }

    if (NAMESPACE.theme && typeof NAMESPACE.theme.stop === 'function') {
        NAMESPACE.theme.stop();
    }

    function isDashboardRoute() {
        var route = (global.location.hash.slice(1) || global.location.pathname).split('?')[0].toLowerCase();
        return route === '/dashboard'
            || route.indexOf('/dashboard/') === 0
            || route === '/configurationpage';
    }

    function reconcile() {
        document.documentElement.classList.toggle(ROOT_CLASS, !isDashboardRoute());
    }

    function stop() {
        WINDOW_EVENTS.forEach(function (eventName) {
            global.removeEventListener(eventName, reconcile);
        });
        document.documentElement.classList.remove(ROOT_CLASS);
    }

    WINDOW_EVENTS.forEach(function (eventName) {
        global.addEventListener(eventName, reconcile);
    });
    NAMESPACE.theme = { reconcile: reconcile, stop: stop, version: MODULE_VERSION };
    reconcile();
}(window));