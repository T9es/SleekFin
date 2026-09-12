(function (global) {
    'use strict';

    var MODULE_VERSION = '0.4.0';
    var MAIN_ROOT_CLASS = 'sleekfin-main-ui';
    var ROOT_CLASS = 'sleekfin-media-mounted';
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var components = NAMESPACE.components;
    var document = global.document;

    if (!document || !document.documentElement || !components) {
        return;
    }

    if (NAMESPACE.media && NAMESPACE.media.version === MODULE_VERSION) {
        NAMESPACE.media.reconcile();
        return;
    }

    if (NAMESPACE.media && typeof NAMESPACE.media.stop === 'function') {
        NAMESPACE.media.stop();
    }

    var state = {
        cache: new Map(),
        inFlight: new Set(),
        observer: null,
        timer: 0
    };
    var PAGE_SELECTOR = '#indexPage, #moviesPage, #tvshowsPage';

    function facts(item, type, original) {
        var result = [];
        var score = Number(item?.CommunityRating || 0);
        var episode = item?.ParentIndexNumber && item?.IndexNumber
            ? 'S' + item.ParentIndexNumber + ':E' + item.IndexNumber
            : '';
        var date = /^\d{4}(?:\s*-\s*(?:\d{4}|Present))?$/.test(original)
            ? original
            : components.itemYear(item);
        var fallback = components.formatRuntime(item?.RunTimeTicks) || item?.OfficialRating || item?.Status || '';

        if (score > 0) {
            result.push({ accent: true, icon: 'star', text: score.toFixed(1) });
        }
        if (type === 'Episode' && episode) {
            result.push({ text: episode });
        } else if (date) {
            result.push({ text: date });
        }
        if (result.length < 2 && fallback) {
            result.push({ text: fallback });
        }
        result.push({ text: components.itemTypeLabel(type) });
        return result.filter(function (fact) { return fact.text; }).slice(0, 3);
    }

    function metadataElement(card) {
        var element = card.querySelector('[data-sleekfin-media-meta]');
        if (element) {
            return element;
        }

        element = card.querySelector('.cardText-secondary');
        if (element) {
            element.dataset.sleekfinMediaOriginal = element.textContent.trim();
        } else {
            element = document.createElement('div');
            element.className = 'cardText cardText-secondary';
            card.querySelector('.cardText-first')?.after(element);
        }
        element.classList.add('sleekfin-media-meta');
        element.dataset.sleekfinMediaMeta = 'true';
        return element;
    }

    function render(card, item) {
        var type = item?.Type || card.dataset.type || '';
        if (!components.itemTypeLabel(type) || type === 'CollectionFolder') {
            return;
        }

        var element = metadataElement(card);
        var values = facts(item, type, element.dataset.sleekfinMediaOriginal || '');
        var signature = values.map(function (value) { return value.text; }).join('|');
        if (element.dataset.sleekfinMediaValue === signature) {
            return;
        }

        components.renderMeta(element, values);
        element.dataset.sleekfinMediaValue = signature;
    }

    function load(ids) {
        var client = global.ApiClient;
        if (!client || typeof client.getItems !== 'function' || !client.getCurrentUserId()) {
            global.clearTimeout(state.timer);
            state.timer = global.setTimeout(reconcile, 250);
            return;
        }

        while (ids.length) {
            (function (batch) {
                batch.forEach(function (id) { state.inFlight.add(id); });
                client.getItems(client.getCurrentUserId(), {
                    EnableTotalRecordCount: false,
                    Fields: 'CommunityRating,ProductionYear,PremiereDate,RunTimeTicks,IndexNumber,ParentIndexNumber,OfficialRating,Status',
                    Ids: batch.join(',')
                }).then(function (response) {
                    var items = new Map((response.Items || []).map(function (item) { return [item.Id, item]; }));
                    batch.forEach(function (id) { state.cache.set(id, items.get(id) || null); });
                }).catch(function () {
                    batch.forEach(function (id) { state.cache.set(id, null); });
                }).finally(function () {
                    batch.forEach(function (id) { state.inFlight.delete(id); });
                    reconcile();
                });
            }(ids.splice(0, 60)));
        }
    }

    function reconcile() {
        global.clearTimeout(state.timer);
        state.timer = 0;
        if (!document.documentElement.classList.contains(MAIN_ROOT_CLASS)) {
            return;
        }
        var missing = [];
        Array.prototype.forEach.call(document.querySelectorAll(PAGE_SELECTOR), function (page) {
            if (!components.isVisible(page)) {
                return;
            }
            Array.prototype.forEach.call(page.querySelectorAll('.card[data-id][data-type]'), function (card) {
                var id = card.dataset.id;
                render(card, state.cache.get(id));
                if (!state.cache.has(id) && !state.inFlight.has(id)) {
                    missing.push(id);
                }
            });
        });
        if (missing.length) {
            load(Array.from(new Set(missing)));
        }
    }

    function schedule() {
        global.clearTimeout(state.timer);
        document.documentElement.classList.toggle(
            ROOT_CLASS,
            document.documentElement.classList.contains(MAIN_ROOT_CLASS)
        );
        if (!document.documentElement.classList.contains(ROOT_CLASS)) {
            return;
        }
        state.timer = global.setTimeout(reconcile, 40);
    }

    function stop() {
        state.observer?.disconnect();
        global.clearTimeout(state.timer);
        global.removeEventListener('hashchange', schedule);
        document.documentElement.classList.remove(ROOT_CLASS);
    }

    state.observer = new MutationObserver(schedule);
    state.observer.observe(document.querySelector('#reactRoot') || document.body, { childList: true, subtree: true });
    global.addEventListener('hashchange', schedule);
    NAMESPACE.media = { reconcile: schedule, stop: stop, version: MODULE_VERSION };
    schedule();
}(window));