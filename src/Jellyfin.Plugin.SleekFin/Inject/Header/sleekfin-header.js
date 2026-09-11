(function (global) {
    'use strict';

    var MODULE_VERSION = '0.1.0';
    var ROOT_CLASS = 'sleekfin-header-mounted';
    var WINDOW_EVENTS = ['hashchange', 'pageshow', 'popstate', 'resize', 'scroll'];
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var document = global.document;

    if (!document || !document.documentElement) {
        return;
    }

    if (NAMESPACE.header && NAMESPACE.header.version === MODULE_VERSION) {
        NAMESPACE.header.reconcile();
        return;
    }

    if (NAMESPACE.header && typeof NAMESPACE.header.stop === 'function') {
        NAMESPACE.header.stop();
    }

    var state = {
        animationFrame: 0,
        fallbackBrand: null,
        mount: null,
        mutationObserver: null,
        reconcileTimer: 0,
        serverName: '',
        serverNameRequested: false,
        started: false
    };

    function isTvLayout() {
        return document.documentElement.classList.contains('layout-tv')
            || Boolean(document.body && document.body.classList.contains('layout-tv'));
    }

    function layoutMode() {
        return global.innerWidth < 900 || document.documentElement.classList.contains('layout-mobile')
            ? 'compact'
            : 'desktop';
    }

    function isVisible(element) {
        if (!element || !element.isConnected || element.getClientRects().length === 0) {
            return false;
        }

        var style = global.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function findVisibleModernHeader() {
        return Array.prototype.find.call(
            document.querySelectorAll('header.MuiAppBar-root'),
            function (header) {
                return isVisible(header) && Boolean(header.querySelector('.MuiToolbar-root'));
            }
        ) || null;
    }

    function findVisibleLegacyHeader() {
        return Array.prototype.find.call(
            document.querySelectorAll('.skinHeader'),
            function (header) {
                return isVisible(header) && Boolean(header.querySelector('.headerTop'));
            }
        ) || null;
    }

    function findSurface() {
        var modern = findVisibleModernHeader();
        if (modern) {
            return { header: modern, kind: 'modern' };
        }

        var legacy = findVisibleLegacyHeader();
        return legacy ? { header: legacy, kind: 'legacy' } : null;
    }

    function mark(mount, element, name, value) {
        if (!element) {
            return;
        }

        element.setAttribute(name, value || 'true');
        mount.markedNodes.add(element);
    }

    function clearMarkers(mount) {
        mount.markedNodes.forEach(function (element) {
            Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
                if (attribute.name.indexOf('data-sleekfin-') === 0) {
                    element.removeAttribute(attribute.name);
                }
            });
        });

        if (mount.toolbar) {
            mount.toolbar.style.removeProperty('--sleekfin-header-pill-left');
            mount.toolbar.style.removeProperty('--sleekfin-header-pill-width');
        }
    }

    function updateActiveControls(mount) {
        var links = mount.header.querySelectorAll('[data-sleekfin-header-segment] a[href]:not([data-sleekfin-header-brand])');

        Array.prototype.forEach.call(links, function (link) {
            var href = link.getAttribute('href') || '';
            mark(
                mount,
                link,
                'data-sleekfin-current',
                href && global.location.href.indexOf(href) !== -1 ? 'true' : 'false'
            );
        });

        Array.prototype.forEach.call(mount.header.querySelectorAll('button[id*="-link-"]'), function (button) {
            var tab = document.getElementById(button.id.replace('-link-', '-btn-'));
            mark(
                mount,
                button,
                'data-sleekfin-current',
                tab && tab.classList.contains('emby-tab-button-active') ? 'true' : 'false'
            );
        });
    }

    function readServerName(nativeBrand) {
        if (nativeBrand) {
            var nativeText = nativeBrand.textContent.trim();
            if (nativeText) {
                state.serverName = nativeText;
            }
        }

        if (!state.serverName) {
            state.serverName = (document.title || 'Jellyfin').replace(/\s+[|·-]\s+Jellyfin$/i, '').trim() || 'Jellyfin';
        }

        return state.serverName;
    }

    function updateFallbackBrandName() {
        if (!state.fallbackBrand || !state.fallbackBrand.isConnected || !state.serverName) {
            return;
        }

        var label = state.fallbackBrand.querySelector('span');
        if (label) {
            label.textContent = state.serverName;
        }

        state.fallbackBrand.setAttribute('aria-label', state.serverName + ' home');
    }

    function requestServerName() {
        if (state.serverNameRequested || typeof global.fetch !== 'function') {
            return;
        }

        var systemInfoUrl;
        if (global.ApiClient && typeof global.ApiClient.getUrl === 'function') {
            systemInfoUrl = global.ApiClient.getUrl('/System/Info/Public');
        } else {
            systemInfoUrl = new URL('../System/Info/Public', document.baseURI).toString();
        }

        state.serverNameRequested = true;
        global.fetch(systemInfoUrl, { credentials: 'same-origin' })
            .then(function (response) {
                return response.ok ? response.json() : null;
            })
            .then(function (systemInfo) {
                if (!state.started) {
                    return;
                }

                var serverName = systemInfo && typeof systemInfo.ServerName === 'string'
                    ? systemInfo.ServerName.trim()
                    : '';
                if (serverName) {
                    state.serverName = serverName;
                    updateFallbackBrandName();
                }
            })
            .catch(function () {
                return undefined;
            });
    }

    function findBrandImageSource() {
        var nativeImage = document.querySelector('a[href="#/"] img');

        if (nativeImage && nativeImage.currentSrc) {
            return nativeImage.currentSrc;
        }

        if (nativeImage && nativeImage.src) {
            return nativeImage.src;
        }

        var icons = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]'));
        var preferredIcon = icons.find(function (icon) {
            return /icon-transparent|apple-touch|192|512/i.test(icon.getAttribute('href') || '');
        }) || icons[icons.length - 1];

        return preferredIcon ? preferredIcon.href : '';
    }

    function removeFallbackBrand() {
        if (state.fallbackBrand && state.fallbackBrand.isConnected) {
            state.fallbackBrand.remove();
        }

        state.fallbackBrand = null;
    }

    function ensureFallbackBrand() {
        requestServerName();

        if (state.fallbackBrand && state.fallbackBrand.isConnected) {
            return;
        }

        var brand = document.createElement('a');
        var image = document.createElement('img');
        var label = document.createElement('span');
        var serverName = readServerName(null);

        brand.className = 'sleekfin-header-fallback-brand';
        brand.href = '#/';
        brand.setAttribute('aria-label', serverName + ' home');
        image.alt = '';
        image.src = findBrandImageSource();
        label.textContent = serverName;
        brand.appendChild(image);
        brand.appendChild(label);
        document.body.appendChild(brand);
        state.fallbackBrand = brand;
    }

    function updateScrolledState(mount) {
        mount.header.setAttribute('data-sleekfin-scrolled', global.scrollY > 20 ? 'true' : 'false');
    }

    function directChildren(element) {
        return Array.prototype.slice.call(element.children);
    }

    function scheduleModernMeasurement(mount) {
        if (state.animationFrame) {
            global.cancelAnimationFrame(state.animationFrame);
        }

        state.animationFrame = global.requestAnimationFrame(function () {
            state.animationFrame = 0;
            if (state.mount !== mount || !mount.toolbar.isConnected) {
                return;
            }

            var candidates = mount.clusterItems.filter(isVisible);
            if (candidates.length === 0) {
                mount.toolbar.removeAttribute('data-sleekfin-header-measured');
                return;
            }

            var toolbarRect = mount.toolbar.getBoundingClientRect();
            var firstRect = candidates[0].getBoundingClientRect();
            var lastRect = candidates[candidates.length - 1].getBoundingClientRect();
            var left = firstRect.left - toolbarRect.left;
            var right = lastRect.right - toolbarRect.left;

            mount.toolbar.style.setProperty('--sleekfin-header-pill-left', Math.round(left) + 'px');
            mount.toolbar.style.setProperty('--sleekfin-header-pill-width', Math.max(40, Math.round(right - left)) + 'px');
            mount.toolbar.setAttribute('data-sleekfin-header-measured', 'true');
            mount.markedNodes.add(mount.toolbar);
        });
    }

    function findModernParts(toolbar) {
        var children = directChildren(toolbar);
        var nav = children.find(function (element) {
            return element.classList.contains('MuiStack-root');
        }) || null;
        var brand = nav && Array.prototype.find.call(nav.querySelectorAll('a[href]'), function (link) {
            var href = link.getAttribute('href') || '';
            return href === '#/' || /#\/$/.test(href);
        });
        var boxes = children.filter(function (element) {
            return element.classList.contains('MuiBox-root');
        });
        var actions = boxes.length > 1 ? boxes[0] : null;
        var profile = boxes.length ? boxes[boxes.length - 1] : null;

        return {
            actions: actions,
            brand: brand,
            nav: nav,
            profile: profile
        };
    }

    function mountModern(header) {
        var toolbar = header.querySelector('.MuiToolbar-root');
        var parts = findModernParts(toolbar);
        var mount = {
            actions: parts.actions,
            brand: parts.brand,
            header: header,
            kind: 'modern',
            layoutMode: layoutMode(),
            markedNodes: new Set(),
            nav: parts.nav,
            navLinkCount: parts.nav ? parts.nav.querySelectorAll('a[href]').length : 0,
            profile: parts.profile,
            toolbar: toolbar
        };

        mark(mount, header, 'data-sleekfin-header', 'modern');
        mark(mount, toolbar, 'data-sleekfin-header-toolbar');

        if (parts.brand) {
            readServerName(parts.brand);
            mark(mount, parts.brand, 'data-sleekfin-header-brand');
        }

        if (parts.nav) {
            mark(mount, parts.nav, 'data-sleekfin-header-segment');
            mark(mount, parts.nav, 'data-sleekfin-header-nav');
            Array.prototype.forEach.call(parts.nav.querySelectorAll('a[href]'), function (link) {
                if (link !== parts.brand) {
                    mark(mount, link, 'data-sleekfin-header-link');
                }
            });
        }

        if (parts.actions && parts.actions !== parts.profile) {
            mark(mount, parts.actions, 'data-sleekfin-header-segment');
            mark(mount, parts.actions, 'data-sleekfin-header-actions');
        }

        if (parts.profile) {
            mark(mount, parts.profile, 'data-sleekfin-header-segment');
            mark(mount, parts.profile, 'data-sleekfin-header-profile');
        }

        mount.clusterItems = directChildren(toolbar).filter(function (child) {
            return child === parts.actions
                || child === parts.profile
                || (child === parts.nav && mount.layoutMode === 'desktop');
        });

        if (mount.clusterItems.length) {
            mark(mount, mount.clusterItems[0], 'data-sleekfin-header-first-cluster');
        }

        document.documentElement.classList.add(ROOT_CLASS);
        removeFallbackBrand();
        updateActiveControls(mount);
        updateScrolledState(mount);
        scheduleModernMeasurement(mount);

        if (typeof global.ResizeObserver === 'function') {
            mount.resizeObserver = new global.ResizeObserver(function () {
                scheduleModernMeasurement(mount);
            });
            mount.resizeObserver.observe(toolbar);
        }

        return mount;
    }

    function rememberMove(mount, element) {
        mount.movedNodes.push({
            element: element,
            nextSibling: element.nextSibling,
            parent: element.parentNode
        });
    }

    function moveIntoCluster(mount, cluster, element) {
        if (!element || element.parentNode === cluster) {
            return;
        }

        rememberMove(mount, element);
        cluster.appendChild(element);
    }

    function mountLegacy(header) {
        var top = header.querySelector('.headerTop');
        var left = header.querySelector('.headerLeft');
        var right = header.querySelector('.headerRight');
        var tabs = header.querySelector('.headerTabs');
        var cluster = document.createElement('div');
        var mount = {
            cluster: cluster,
            header: header,
            kind: 'legacy',
            layoutMode: layoutMode(),
            markedNodes: new Set(),
            movedNodes: []
        };

        cluster.setAttribute('data-sleekfin-legacy-cluster', 'true');
        top.appendChild(cluster);
        mark(mount, header, 'data-sleekfin-header', 'legacy');
        mark(mount, top, 'data-sleekfin-legacy-top');
        mark(mount, left, 'data-sleekfin-legacy-left');

        if (left) {
            directChildren(left).filter(function (element) {
                return element.matches('button, .headerButton, .paper-icon-button-light');
            }).forEach(function (element) {
                moveIntoCluster(mount, cluster, element);
            });
        }

        if (tabs && mount.layoutMode === 'desktop') {
            moveIntoCluster(mount, cluster, tabs);
        }

        moveIntoCluster(mount, cluster, right);
        document.documentElement.classList.add(ROOT_CLASS);
        ensureFallbackBrand();
        updateScrolledState(mount);
        return mount;
    }

    function cleanupMount(mount) {
        if (!mount) {
            return;
        }

        if (mount.resizeObserver) {
            mount.resizeObserver.disconnect();
        }

        clearMarkers(mount);

        var movedNodes = mount.movedNodes || [];
        for (var index = movedNodes.length - 1; index >= 0; index -= 1) {
            var move = movedNodes[index];
            if (!move.element.isConnected || !move.parent || !move.parent.isConnected) {
                continue;
            }

            var nextSibling = move.nextSibling && move.nextSibling.parentNode === move.parent
                ? move.nextSibling
                : null;
            move.parent.insertBefore(move.element, nextSibling);
        }

        if (mount.cluster && mount.cluster.isConnected) {
            mount.cluster.remove();
        }
    }

    function mountNeedsReplacement(surface) {
        if (!state.mount) {
            return true;
        }

        if (state.mount.kind !== surface.kind || state.mount.header !== surface.header) {
            return true;
        }

        if (state.mount.layoutMode !== layoutMode()) {
            return true;
        }

        if (surface.kind === 'modern') {
            var currentParts = findModernParts(state.mount.toolbar);
            return !state.mount.toolbar.isConnected
                || !state.mount.toolbar.hasAttribute('data-sleekfin-header-toolbar')
                || state.mount.actions !== currentParts.actions
                || state.mount.brand !== currentParts.brand
                || state.mount.nav !== currentParts.nav
                || state.mount.profile !== currentParts.profile
                || state.mount.navLinkCount !== (currentParts.nav ? currentParts.nav.querySelectorAll('a[href]').length : 0)
                || state.mount.clusterItems.some(function (element) { return !element.isConnected; });
        }

        return !state.mount.cluster || !state.mount.cluster.isConnected;
    }

    function unmount() {
        cleanupMount(state.mount);
        state.mount = null;
        removeFallbackBrand();
        document.documentElement.classList.remove(ROOT_CLASS);
    }

    function reconcile() {
        if (!state.started) {
            return;
        }

        if (isTvLayout()) {
            unmount();
            return;
        }

        var surface = findSurface();
        if (!surface) {
            unmount();
            return;
        }

        if (mountNeedsReplacement(surface)) {
            cleanupMount(state.mount);
            removeFallbackBrand();
            state.mount = surface.kind === 'modern'
                ? mountModern(surface.header)
                : mountLegacy(surface.header);
        } else {
            updateScrolledState(state.mount);
            if (state.mount.kind === 'modern') {
                updateActiveControls(state.mount);
                scheduleModernMeasurement(state.mount);
            }
        }
    }

    function scheduleReconcile() {
        if (state.reconcileTimer) {
            global.clearTimeout(state.reconcileTimer);
        }

        state.reconcileTimer = global.setTimeout(function () {
            state.reconcileTimer = 0;
            reconcile();
        }, 60);
    }

    function start() {
        if (state.started || !document.body) {
            return;
        }

        state.started = true;
        var observationRoot = document.getElementById('reactRoot') || document.body;
        state.mutationObserver = new MutationObserver(scheduleReconcile);
        state.mutationObserver.observe(observationRoot, { childList: true, subtree: true });
        WINDOW_EVENTS.forEach(function (eventName) {
            global.addEventListener(eventName, scheduleReconcile, eventName === 'scroll' ? { passive: true } : false);
        });
        document.addEventListener('viewshow', scheduleReconcile);
        reconcile();
    }

    function stop() {
        state.started = false;
        if (state.reconcileTimer) {
            global.clearTimeout(state.reconcileTimer);
            state.reconcileTimer = 0;
        }

        if (state.animationFrame) {
            global.cancelAnimationFrame(state.animationFrame);
            state.animationFrame = 0;
        }

        if (state.mutationObserver) {
            state.mutationObserver.disconnect();
            state.mutationObserver = null;
        }

        WINDOW_EVENTS.forEach(function (eventName) {
            global.removeEventListener(eventName, scheduleReconcile);
        });
        document.removeEventListener('viewshow', scheduleReconcile);
        unmount();
    }

    NAMESPACE.header = {
        reconcile: function () {
            scheduleReconcile();
        },
        stop: stop,
        version: MODULE_VERSION
    };

    start();
}(window));