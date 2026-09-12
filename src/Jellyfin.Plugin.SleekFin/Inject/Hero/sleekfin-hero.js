(function (global) {
    'use strict';

    var MODULE_VERSION = '0.3.0';
    var ITEM_FIELDS = 'Overview,Genres,PremiereDate,ProductionYear,ImageTags,BackdropImageTags';
    var WINDOW_EVENTS = ['hashchange', 'popstate', 'pageshow'];
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var components = NAMESPACE.components;
    var document = global.document;

    if (!document || !document.documentElement || !components) {
        return;
    }

    var appendText = components.appendText;

    if (NAMESPACE.hero && NAMESPACE.hero.version === MODULE_VERSION) {
        NAMESPACE.hero.reconcile();
        return;
    }

    if (NAMESPACE.hero && typeof NAMESPACE.hero.stop === 'function') {
        NAMESPACE.hero.stop();
    }

    var state = {
        activeIndex: 0,
        generation: 0,
        loadingHost: null,
        mount: null,
        observer: null,
        reconcileTimer: 0,
        rotationTimer: 0,
        started: false,
        touchStartX: null
    };

    function isHomeRoute() {
        var match = global.location.hash.match(/^#\/(?:home)?(?:\?([^#]*))?$/);
        if (!match) {
            return false;
        }

        var tab = new URLSearchParams(match[1] || '').get('tab');
        return !tab || tab === '0';
    }

    function findHost() {
        if (!isHomeRoute()) {
            return null;
        }

        return Array.prototype.find.call(document.querySelectorAll('#indexPage #homeTab.is-active .sections'), components.isVisible) || null;
    }

    function itemQuery(options) {
        options.Fields = ITEM_FIELDS;
        options.Recursive = true;
        options.Limit = 10;
        options.EnableTotalRecordCount = false;
        return global.ApiClient.getItems(global.ApiClient.getCurrentUserId(), options).then(function (result) {
            return result.Items || [];
        });
    }

    function loadSource(source) {
        switch (source) {
            case 'ContinueWatching':
                return itemQuery({
                    IncludeItemTypes: 'Movie,Episode',
                    Filters: 'IsResumable',
                    SortBy: 'DatePlayed',
                    SortOrder: 'Descending'
                });
            case 'NextUp':
                return global.ApiClient.getNextUpEpisodes({
                    UserId: global.ApiClient.getCurrentUserId(),
                    Limit: 10,
                    Fields: ITEM_FIELDS,
                    EnableTotalRecordCount: false
                }).then(function (result) {
                    return result.Items || [];
                });
            case 'LatestMovies':
                return itemQuery({
                    IncludeItemTypes: 'Movie',
                    SortBy: 'DateCreated',
                    SortOrder: 'Descending'
                });
            case 'LatestShows':
                return itemQuery({
                    IncludeItemTypes: 'Series',
                    SortBy: 'DateCreated',
                    SortOrder: 'Descending'
                });
            case 'Favorites':
                return itemQuery({
                    IncludeItemTypes: 'Movie,Series',
                    Filters: 'IsFavorite',
                    SortBy: 'SortName',
                    SortOrder: 'Ascending'
                });
            default:
                return Promise.resolve([]);
        }
    }

    function shuffle(items) {
        var shuffled = items.slice();
        var index;
        for (index = shuffled.length - 1; index > 0; index--) {
            var randomIndex = Math.floor(Math.random() * (index + 1));
            var value = shuffled[index];
            shuffled[index] = shuffled[randomIndex];
            shuffled[randomIndex] = value;
        }

        return shuffled;
    }

    function collectItems(settings) {
        return Promise.all(settings.contentOrder.map(function (source) {
            return loadSource(source).catch(function () { return []; });
        })).then(function (sources) {
            var seen = new Set();
            var items = [];
            sources.forEach(function (sourceItems) {
                sourceItems.forEach(function (item) {
                    var identity = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
                    if (identity && !seen.has(identity)) {
                        seen.add(identity);
                        items.push(item);
                    }
                });
            });

            return (settings.randomized ? shuffle(items) : items).slice(0, 5);
        });
    }

    function prepareItem(item) {
        var displayPromise = item.Type === 'Episode' && item.SeriesId
            ? global.ApiClient.getItem(global.ApiClient.getCurrentUserId(), item.SeriesId).catch(function () { return item; })
            : Promise.resolve(item);

        return displayPromise.then(function (displayItem) {
            return {
                display: displayItem,
                play: item
            };
        });
    }

    function jellyfinImage(item, type) {
        var options = { type: type };
        if (type === 'Backdrop') {
            options.index = 0;
            options.tag = item.BackdropImageTags && item.BackdropImageTags[0];
        } else {
            options.tag = item.ImageTags && item.ImageTags[type];
        }

        return options.tag ? global.ApiClient.getImageUrl(item.Id, options) : '';
    }

    function createButton(kind, text, action, item) {
        var button = components.createButton(kind === 'play' ? 'primary' : 'control', kind, text);
        button.classList.add('sleekfin-hero-button');
        components.setItemAction(button, item, action);
        return button;
    }

    function createSlide(entry, index) {
        var item = entry.display;
        var slide = document.createElement('section');
        var vignette = document.createElement('div');
        var seam = document.createElement('div');
        var content = document.createElement('div');
        var stack = document.createElement('div');
        var titleBox = document.createElement('div');
        var logoUrl = jellyfinImage(item, 'Logo');
        var backdropUrl = jellyfinImage(item, 'Backdrop');
        var facts = document.createElement('div');
        var description = document.createElement('p');
        var actions = document.createElement('div');
        var rating = Number(item.CommunityRating || 0);
        var releaseYear = components.itemYear(item);
        var genres = item.Genres || [];

        slide.className = 'sleekfin-hero-slide';
        slide.dataset.active = index === 0 ? 'true' : 'false';

        if (backdropUrl) {
            var backdrop = document.createElement('img');
            backdrop.className = 'sleekfin-hero-backdrop';
            backdrop.src = backdropUrl;
            slide.appendChild(backdrop);
        }

        vignette.className = 'sleekfin-hero-vignette';
        seam.className = 'sleekfin-hero-seam';
        slide.appendChild(vignette);
        slide.appendChild(seam);
        content.className = 'sleekfin-hero-content';
        stack.className = 'sleekfin-hero-stack';
        titleBox.className = 'sleekfin-hero-title-box';
        if (logoUrl) {
            var logo = document.createElement('img');
            logo.className = 'sleekfin-hero-title-logo';
            logo.src = logoUrl;
            logo.addEventListener('error', function () {
                logo.remove();
                appendText(titleBox, 'sleekfin-hero-title', item.Name || '');
            }, { once: true });
            titleBox.appendChild(logo);
        } else {
            appendText(titleBox, 'sleekfin-hero-title', item.Name || '');
        }

        facts.className = 'sleekfin-hero-facts';
        if (rating > 0) {
            components.appendFact(facts, rating.toFixed(1), { className: 'sleekfin-hero-score', icon: 'star' });
        }
        if (releaseYear) {
            components.appendFact(facts, String(releaseYear));
        }
        components.appendFact(facts, components.itemTypeLabel(item.Type));
        genres.slice(0, 2).forEach(function (genre) { components.appendFact(facts, genre); });

        description.className = 'sleekfin-hero-description';
        description.textContent = item.Overview || '';

        actions.className = 'sleekfin-hero-actions';
        actions.appendChild(createButton('play', 'Play', 'play', entry.play));
        actions.appendChild(createButton('info', 'More info', 'link', item));

        stack.appendChild(titleBox);
        stack.appendChild(facts);
        if (description.textContent) {
            stack.appendChild(description);
        }
        stack.appendChild(actions);
        content.appendChild(stack);
        slide.appendChild(content);
        return slide;
    }

    function showSlide(index) {
        if (!state.mount || !state.mount.isConnected) {
            return;
        }

        var slides = state.mount.querySelectorAll('.sleekfin-hero-slide');
        if (!slides.length) {
            return;
        }

        state.activeIndex = (index + slides.length) % slides.length;
        Array.prototype.forEach.call(slides, function (slide, slideIndex) {
            slide.dataset.active = slideIndex === state.activeIndex ? 'true' : 'false';
        });
    }

    function startRotation() {
        global.clearInterval(state.rotationTimer);
        if (!state.mount || state.mount.children.length < 2) {
            return;
        }

        state.rotationTimer = global.setInterval(function () {
            if (!document.hidden && state.touchStartX === null) {
                showSlide(state.activeIndex + 1);
            }
        }, 10000);
    }

    function bindSwipe(root) {
        root.addEventListener('pointerdown', function (event) {
            if (event.pointerType !== 'mouse' || event.button === 0) {
                state.touchStartX = event.clientX;
            }
        });
        root.addEventListener('pointerup', function (event) {
            if (state.touchStartX === null) {
                return;
            }

            var distance = event.clientX - state.touchStartX;
            state.touchStartX = null;
            if (Math.abs(distance) >= 72) {
                showSlide(state.activeIndex + (distance < 0 ? 1 : -1));
                startRotation();
            }
        });
        root.addEventListener('pointercancel', function () { state.touchStartX = null; });
    }

    function render(host, entries, generation) {
        if (generation !== state.generation || !host.isConnected || !isHomeRoute() || !entries.length) {
            return;
        }

        // Jellyfin's customized items container is upgraded only when its `is` attribute is parsed.
        var shell = document.createElement('div');
        shell.innerHTML = '<div is="emby-itemscontainer" class="sleekfin-hero itemsContainer"></div>';
        var root = shell.firstElementChild;
        entries.forEach(function (entry, index) { root.appendChild(createSlide(entry, index)); });
        host.parentNode.insertBefore(root, host);
        state.mount = root;
        state.activeIndex = 0;
        bindSwipe(root);
        if (global.CustomElements && typeof global.CustomElements.upgradeSubtree === 'function') {
            global.CustomElements.upgradeSubtree(root);
        }
        startRotation();
    }

    function unmount() {
        state.generation++;
        global.clearInterval(state.rotationTimer);
        state.rotationTimer = 0;
        state.loadingHost = null;
        state.mount?.remove();
        state.mount = null;
    }

    function mount(host) {
        var generation = ++state.generation;
        state.loadingHost = host;
        global.ApiClient.ajax({
            type: 'GET',
            url: global.ApiClient.getUrl('SleekFin/Hero/Settings'),
            dataType: 'json'
        })
            .then(function (settings) {
                if (!settings.enabled || !settings.contentOrder || !settings.contentOrder.length) {
                    return [];
                }
                return collectItems(settings);
            })
            .then(function (items) { return Promise.all(items.map(prepareItem)); })
            .then(function (entries) {
                state.loadingHost = null;
                render(host, entries, generation);
            })
            .catch(function () { state.loadingHost = null; });
    }

    function reconcile() {
        if (!state.started || !global.ApiClient) {
            return;
        }

        var host = findHost();
        if (!host) {
            unmount();
            return;
        }
        if (state.mount && state.mount.isConnected && state.mount.nextElementSibling === host) {
            return;
        }
        if (state.loadingHost === host) {
            return;
        }

        unmount();
        mount(host);
    }

    function scheduleReconcile() {
        global.clearTimeout(state.reconcileTimer);
        state.reconcileTimer = global.setTimeout(reconcile, 80);
    }

    function start() {
        if (state.started) {
            scheduleReconcile();
            return;
        }

        state.started = true;
        state.observer = new MutationObserver(scheduleReconcile);
        state.observer.observe(document.getElementById('reactRoot') || document.body, { childList: true, subtree: true });
        WINDOW_EVENTS.forEach(function (eventName) {
            global.addEventListener(eventName, scheduleReconcile);
        });
        document.addEventListener('viewshow', scheduleReconcile);
        scheduleReconcile();
    }

    function stop() {
        state.started = false;
        global.clearTimeout(state.reconcileTimer);
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
        WINDOW_EVENTS.forEach(function (eventName) {
            global.removeEventListener(eventName, scheduleReconcile);
        });
        document.removeEventListener('viewshow', scheduleReconcile);
        unmount();
    }

    NAMESPACE.hero = {
        version: MODULE_VERSION,
        reconcile: reconcile,
        stop: stop
    };

    start();
}(window));