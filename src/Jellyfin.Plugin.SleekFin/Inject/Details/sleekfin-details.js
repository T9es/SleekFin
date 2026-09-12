(function (global) {
    'use strict';

    var MODULE_VERSION = '0.4.1';
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var components = NAMESPACE.components;
    var document = global.document;
    var icons = NAMESPACE.icons;
    var SUPPORTED_TYPES = ['Movie', 'Series', 'Season', 'Episode'];
    var WINDOW_EVENTS = ['hashchange', 'popstate', 'pageshow'];

    if (!document || !document.documentElement || !components || !icons) {
        return;
    }

    var appendText = components.appendText;
    var createIcon = icons.create;

    if (NAMESPACE.details && NAMESPACE.details.version === MODULE_VERSION) {
        NAMESPACE.details.reconcile();
        return;
    }

    if (NAMESPACE.details && typeof NAMESPACE.details.stop === 'function') {
        NAMESPACE.details.stop();
    }

    var state = {
        currentId: '',
        buttonObserver: null,
        generation: 0,
        item: null,
        loadingId: '',
        mount: null,
        moved: [],
        observer: null,
        reconcileTimer: 0,
        retryTimer: 0,
        selectedSeasonId: '',
        similar: [],
        sortDescending: false,
        started: false
    };

    function routeId() {
        var match = global.location.hash.match(/^#\/details\?([^#]*)/);
        return match ? new URLSearchParams(match[1]).get('id') || '' : '';
    }

    function findPage() {
        var id = routeId();
        if (!id) {
            return null;
        }

        return Array.prototype.find.call(document.querySelectorAll('#itemDetailPage'), function (page) {
            if (!components.isVisible(page)) {
                return false;
            }

            var type = page.querySelector('.btnPlaystate')?.dataset.type;
            return SUPPORTED_TYPES.includes(type);
        }) || null;
    }

    function clear(element) {
        element.replaceChildren();
    }

    function move(element, destination) {
        if (!element) {
            return;
        }

        state.moved.push({ element: element, parent: element.parentNode, next: element.nextSibling });
        destination.appendChild(element);
    }

    function restoreMoved() {
        state.moved.reverse().forEach(function (record) {
            if (!record.element.isConnected) {
                return;
            }
            if (record.parent?.isConnected) {
                record.parent.insertBefore(record.element, record.next?.parentNode === record.parent ? record.next : null);
            } else {
                record.element.remove();
            }
        });
        state.moved = [];
    }

    function createBackButton() {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'sleekfin-details-back sleekfin-control-3d sleekfin-icon-button';
        button.title = 'Back';
        button.appendChild(createIcon('arrowLeft'));
        button.addEventListener('click', function () {
            if (global.history.length > 1) {
                global.history.back();
            } else {
                global.location.hash = '#/home';
            }
        });
        return button;
    }

    function addFact(parent, text, className, icon) {
        components.appendFact(parent, text, { className: className, icon: icon });
    }

    function renderChildTitle(item) {
        if (!state.mount) {
            return;
        }

        var childTitle = state.mount.childTitle;
        var isChild = item.Type === 'Season' || item.Type === 'Episode';
        clear(childTitle);
        childTitle.hidden = !isChild;
        state.mount.hero.classList.toggle('sleekfin-details-has-child-title', isChild);
        if (!isChild) {
            return;
        }

        var kicker = item.SeriesName || 'TV Show';
        if (item.Type === 'Episode') {
            var season = item.SeasonName || (item.ParentIndexNumber ? 'Season ' + item.ParentIndexNumber : '');
            var episode = item.IndexNumber ? 'Episode ' + item.IndexNumber : '';
            kicker = [season, episode].filter(Boolean).join(' · ') || kicker;
        }
        appendText(childTitle, 'sleekfin-details-child-kicker', kicker);
        appendText(childTitle, 'sleekfin-details-child-name', item.Name || '', 'h1');
    }

    function renderHeroFacts(item, seasons) {
        if (!state.mount) {
            return;
        }

        var facts = state.mount.facts;
        var genres = state.mount.genres;
        var backdrop = imageUrl(item, 'Backdrop', Math.max(960, global.innerWidth));
        var download = state.mount.actions.querySelector('.btnDownload');
        renderChildTitle(item);
        clear(facts);
        clear(genres);
        if (backdrop) {
            state.mount.backdrop.style.backgroundImage = 'url("' + backdrop.replace(/["\\]/g, '\\$&') + '")';
        }
        download?.classList.toggle('hide', !['Movie', 'Episode'].includes(item.Type) || !item.CanDownload);

        if (Number(item.CommunityRating) > 0) {
            addFact(facts, Number(item.CommunityRating).toFixed(1), 'sleekfin-details-score', 'star');
        }
        addFact(facts, components.itemYear(item));
        if (item.Type === 'Series') {
            var seasonCount = seasons.filter(function (season) { return Number(season.IndexNumber) > 0; }).length;
            addFact(facts, seasonCount ? seasonCount + (seasonCount === 1 ? ' Season' : ' Seasons') : 'Series');
        } else if (item.Type === 'Season') {
            var episodeCount = Number(item.ChildCount || item.RecursiveItemCount || 0);
            addFact(facts, episodeCount ? episodeCount + (episodeCount === 1 ? ' Episode' : ' Episodes') : 'Season');
        } else {
            addFact(facts, components.formatRuntime(item.RunTimeTicks));
        }
        addFact(facts, item.OfficialRating, 'sleekfin-details-certification');

        (item.Genres || []).forEach(function (genre) { addFact(genres, genre); });
    }

    function syncHero() {
        if (!state.mount) {
            return;
        }

        var source = Array.prototype.find.call(state.mount.page.querySelectorAll('.backdropImage'), function (backdrop) {
            return getComputedStyle(backdrop).backgroundImage !== 'none';
        });
        var background = source && getComputedStyle(source).backgroundImage;
        if (background && background !== 'none') {
            state.mount.backdrop.style.backgroundImage = background;
        }
        state.mount.hero.classList.toggle(
            'sleekfin-details-has-logo',
            Boolean(state.mount.logo && getComputedStyle(state.mount.logo).backgroundImage !== 'none')
        );
    }

    function decorateButtons() {
        if (!state.mount) {
            return;
        }

        var buttons = state.mount.actions.querySelectorAll('.btnPlay, .btnReplay, .btnDownload, .btnUserRating');
        var hasEpisodeResume = state.item?.Type === 'Episode' && Array.prototype.some.call(buttons, function (button) {
            return button.dataset.action === 'resume' && !button.classList.contains('hide');
        });
        Array.prototype.forEach.call(buttons, function (button) {
            var content = button.querySelector('.detailButton-content') || button;
            var kind = button.classList.contains('btnUserRating')
                ? (button.dataset.isfavorite === 'true' ? 'bookmarkCheck' : 'bookmark')
                : button.classList.contains('btnDownload') ? 'download' : 'play';
            var label = button.classList.contains('btnUserRating')
                ? (button.dataset.isfavorite === 'true' ? 'In watchlist' : 'Add to watchlist')
                : kind === 'download' ? 'Download'
                    : button.dataset.action === 'resume' ? 'Resume' : 'Play';
            var primary = kind === 'play';
            button.classList.toggle('sleekfin-details-suppressed-action', hasEpisodeResume && button.dataset.action === 'play');
            button.classList.add('sleekfin-button', primary ? 'sleekfin-button-primary' : 'sleekfin-button-control');
            button.classList.toggle('sleekfin-control-3d', !primary);
            content.classList.add('sleekfin-button-content');
            components.setButtonContent(content, kind, label);
        });
    }

    function addSectionHeading(section, title, subtitle) {
        if (!section || section.querySelector(':scope > .sleekfin-section-heading')) {
            return;
        }

        var original = section.querySelector(':scope > .sectionTitle');
        var heading = components.createSectionHeading(title, subtitle);
        section.insertBefore(heading, original || section.firstChild);
        original?.classList.add('sleekfin-details-original-heading');
    }

    function decorateSections(page) {
        addSectionHeading(page.querySelector('#castCollapsible'), 'Cast', 'The cast behind this title');
        addSectionHeading(page.querySelector('#similarCollapsible'), 'You may like', 'More titles like this one');
        if (state.similar.length) {
            decorateSimilar(page);
        }
    }

    function imageUrl(item, type, width) {
        var tags = type === 'Backdrop' ? item.BackdropImageTags : item.ImageTags && [item.ImageTags[type]];
        var tag = tags && tags[0];
        var ownerId = item.Id;
        if (type === 'Backdrop' && !tag) {
            tag = item.ParentBackdropImageTags && item.ParentBackdropImageTags[0];
            ownerId = item.ParentBackdropItemId || item.SeriesId || item.ParentId;
        }
        if (!tag || !ownerId || !global.ApiClient) {
            return '';
        }
        return global.ApiClient.getImageUrl(ownerId, {
            index: type === 'Backdrop' ? 0 : undefined,
            maxWidth: width,
            quality: 90,
            tag: tag,
            type: type
        });
    }

    function decorateSimilar(page) {
        var byId = new Map(state.similar.map(function (item) { return [item.Id, item]; }));
        Array.prototype.forEach.call(page.querySelectorAll('#similarCollapsible .card[data-id]'), function (card) {
            var item = byId.get(card.dataset.id);
            if (!item) {
                return;
            }

            var image = card.querySelector('.cardImageContainer');
            var backdrop = imageUrl(item, 'Backdrop', 840);
            var poster = imageUrl(item, 'Primary', 342);
            if (image && (backdrop || poster)) {
                if (backdrop) {
                    image.style.setProperty('--sleekfin-similar-backdrop', 'url("' + backdrop.replace(/["\\]/g, '\\$&') + '")');
                }
                if (poster) {
                    image.style.setProperty('--sleekfin-similar-poster', 'url("' + poster.replace(/["\\]/g, '\\$&') + '")');
                }
                image.classList.remove('lazy-hidden');
            }

            var cardBox = card.querySelector('.cardBox');
            var meta = cardBox?.querySelector('.sleekfin-details-similar-meta');
            if (!meta && cardBox) {
                meta = document.createElement('div');
                meta.className = 'sleekfin-details-similar-meta';
                cardBox.appendChild(meta);
            }
            if (!meta) {
                return;
            }

            var values = [];
            if (Number(item.CommunityRating) > 0) {
                values.push({ accent: true, icon: 'star', text: Number(item.CommunityRating).toFixed(1) });
            }
            values.push({ text: components.itemYear(item) });
            values.push({ text: components.itemTypeLabel(item.Type) || 'Movie' });
            components.renderMeta(meta, values);
        });
    }

    function createEpisodeCard(item) {
        var card = document.createElement('article');
        var action = document.createElement('button');
        var shade = document.createElement('span');
        var copy = document.createElement('span');
        var footer = document.createElement('span');
        var score = Number(item.CommunityRating || 0);
        var url = imageUrl(item, 'Primary', 840);

        card.className = 'sleekfin-details-episode';
        action.type = 'button';
        action.className = 'sleekfin-details-episode-action';
        components.setItemAction(action, item);
        if (url) {
            var image = document.createElement('img');
            image.src = url;
            action.appendChild(image);
        }
        shade.className = 'sleekfin-details-episode-shade';
        copy.className = 'sleekfin-details-episode-copy';
        appendText(copy, 'sleekfin-details-episode-number', 'Episode ' + (item.IndexNumber || ''));
        appendText(copy, 'sleekfin-details-episode-title', item.Name || '');
        appendText(copy, 'sleekfin-details-episode-overview', item.Overview || '');
        footer.className = 'sleekfin-details-episode-footer';
        var runtimeElement = appendText(footer, 'sleekfin-details-episode-runtime', components.formatRuntime(item.RunTimeTicks));
        runtimeElement.prepend(createIcon('play'));
        if (score > 0) {
            var scoreElement = appendText(footer, 'sleekfin-details-episode-score', score.toFixed(1));
            scoreElement.prepend(createIcon('star'));
        }
        copy.appendChild(footer);
        action.appendChild(shade);
        action.appendChild(copy);
        card.appendChild(action);

        if (item.CanDownload && typeof global.ApiClient.getItemDownloadUrl === 'function') {
            var download = document.createElement('button');
            download.type = 'button';
            download.className = 'sleekfin-details-episode-download sleekfin-control-3d sleekfin-icon-button';
            download.title = 'Download';
            download.appendChild(createIcon('download', 1.75));
            download.addEventListener('click', function () {
                var link = document.createElement('a');
                link.href = global.ApiClient.getItemDownloadUrl(item.Id);
                link.download = '';
                document.body.appendChild(link);
                link.click();
                link.remove();
            });
            card.appendChild(download);
        }
        return card;
    }

    function filteredEpisodes() {
        var query = state.mount?.episodeSearch.value.trim().toLocaleLowerCase() || '';
        var episodes = (state.mount?.episodes || []).filter(function (episode) {
            return !query || (episode.Name || '').toLocaleLowerCase().includes(query)
                || (episode.Overview || '').toLocaleLowerCase().includes(query)
                || String(episode.IndexNumber || '').includes(query);
        });
        if (state.sortDescending) {
            episodes.reverse();
        }
        return episodes;
    }

    function renderEpisodes() {
        if (!state.mount?.episodeList) {
            return;
        }

        var episodes = filteredEpisodes();
        var list = state.mount.episodeList;
        clear(list);
        episodes.forEach(function (episode) { list.appendChild(createEpisodeCard(episode)); });
        state.mount.episodeCount.textContent = episodes.length + (episodes.length === 1 ? ' episode' : ' episodes');
        if (global.CustomElements && typeof global.CustomElements.upgradeSubtree === 'function') {
            global.CustomElements.upgradeSubtree(list);
        }
    }

    function loadEpisodes(seasonId) {
        var client = global.ApiClient;
        var generation = state.generation;
        var seriesId = state.item.Type === 'Series' ? state.item.Id : state.item.SeriesId;
        if (!seriesId) {
            state.mount.episodeCount.textContent = 'Episodes unavailable';
            return;
        }
        state.selectedSeasonId = seasonId;
        state.mount.episodeCount.textContent = 'Loading episodes';
        client.getEpisodes(seriesId, {
            seasonId: seasonId,
            userId: client.getCurrentUserId(),
            Fields: 'Overview,ImageTags,CommunityRating,RunTimeTicks,IndexNumber,CanDownload',
            EnableImages: true,
            EnableUserData: true
        }).then(function (result) {
            if (generation !== state.generation || seasonId !== state.selectedSeasonId || !state.mount) {
                return;
            }
            state.mount.episodes = result.Items || [];
            renderEpisodes();
        }).catch(function () {
            if (generation === state.generation && state.mount) {
                state.mount.episodes = [];
                state.mount.episodeCount.textContent = 'Episodes unavailable';
            }
        });
    }

    function setEpisodeView(view) {
        if (!state.mount?.episodeList) {
            return;
        }
        state.mount.episodeList.dataset.view = view;
        Array.prototype.forEach.call(state.mount.episodeViewButtons, function (button) {
            button.dataset.active = button.dataset.view === view ? 'true' : 'false';
        });
    }

    function createControl(kind, label, raised) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'sleekfin-details-control sleekfin-icon-button' + (raised ? ' sleekfin-control-3d' : '');
        button.title = label;
        button.appendChild(createIcon(kind));
        return button;
    }

    function createEpisodeSection(page, seasons) {
        state.mount.episodeSection?.remove();
        var section = document.createElement('section');
        var header = document.createElement('div');
        var heading = document.createElement('div');
        var rail = document.createElement('span');
        var copy = document.createElement('div');
        var select = null;
        var count = document.createElement('span');
        var controls = document.createElement('div');
        var searchWrap = document.createElement('div');
        var searchButton = createControl('search', 'Search episodes');
        var search = document.createElement('input');
        var sort = createControl('arrowDownAz', 'Reverse episode order', true);
        var views = document.createElement('span');
        var grid = createControl('grid', 'Grid view');
        var listButton = createControl('list', 'List view');
        var shell = document.createElement('div');

        section.className = 'sleekfin-details-episodes';
        header.className = 'sleekfin-details-episodes-header';
        heading.className = 'sleekfin-section-heading';
        rail.className = 'sleekfin-section-rail';
        copy.className = 'sleekfin-section-copy';
        if (state.item.Type === 'Series') {
            var selectWrap = document.createElement('span');
            select = document.createElement('select');
            selectWrap.className = 'sleekfin-details-season-select';
            select.className = 'sleekfin-details-season-native';
            seasons.forEach(function (season) {
                var option = document.createElement('option');
                option.value = season.Id;
                option.textContent = season.Name || 'Season ' + (season.IndexNumber || '');
                select.appendChild(option);
            });
            selectWrap.appendChild(select);
            copy.appendChild(selectWrap);
        } else {
            var currentSeason = seasons[0];
            var seasonName = currentSeason?.Name || 'Episodes';
            var seasonTitle = document.createElement('h2');
            seasonTitle.className = 'sleekfin-details-season-title';
            seasonTitle.textContent = state.item.Type === 'Episode' ? 'More from ' + seasonName : seasonName;
            copy.appendChild(seasonTitle);
        }
        count.className = 'sleekfin-section-subtitle';
        copy.appendChild(count);
        heading.appendChild(rail);
        heading.appendChild(copy);

        controls.className = 'sleekfin-details-episode-controls';
        searchWrap.className = 'sleekfin-details-search sleekfin-control-3d';
        search.type = 'search';
        search.placeholder = 'Search episodes';
        searchWrap.appendChild(searchButton);
        searchWrap.appendChild(search);
        views.className = 'sleekfin-details-view-controls sleekfin-control-3d';
        grid.dataset.view = 'grid';
        listButton.dataset.view = 'list';
        views.appendChild(grid);
        views.appendChild(listButton);
        controls.appendChild(searchWrap);
        controls.appendChild(sort);
        controls.appendChild(views);
        header.appendChild(heading);
        header.appendChild(controls);
        section.appendChild(header);

        shell.innerHTML = '<div is="emby-itemscontainer" class="sleekfin-details-episode-list" data-view="grid"></div>';
        section.appendChild(shell.firstElementChild);
        page.querySelector('.detailPageWrapperContainer').insertBefore(section, page.querySelector('.detailPageSecondaryContainer'));

        state.mount.episodeSection = section;
        state.mount.episodeList = section.querySelector('.sleekfin-details-episode-list');
        state.mount.episodeCount = count;
        state.mount.episodeSearch = search;
        state.mount.episodeViewButtons = [grid, listButton];
        state.mount.episodes = [];

        if (select) {
            select.addEventListener('change', function () { loadEpisodes(select.value); });
        }
        searchButton.addEventListener('click', function () {
            searchWrap.classList.toggle('sleekfin-details-search-open');
            if (searchWrap.classList.contains('sleekfin-details-search-open')) {
                search.focus();
            } else {
                search.value = '';
                renderEpisodes();
            }
        });
        search.addEventListener('input', renderEpisodes);
        sort.addEventListener('click', function () {
            state.sortDescending = !state.sortDescending;
            sort.dataset.active = state.sortDescending ? 'true' : 'false';
            components.setIcon(sort, state.sortDescending ? 'arrowUpAz' : 'arrowDownAz');
            renderEpisodes();
        });
        [grid, listButton].forEach(function (button) {
            button.addEventListener('click', function () { setEpisodeView(button.dataset.view); });
        });
        setEpisodeView('grid');

        var firstSeason = seasons.find(function (season) { return Number(season.IndexNumber) > 0; }) || seasons[0];
        if (firstSeason) {
            if (select) {
                select.value = firstSeason.Id;
            }
            loadEpisodes(firstSeason.Id);
        }
    }

    function loadSeasons(client, userId, item) {
        if (item.Type === 'Series') {
            return client.getSeasons(item.Id, { userId: userId });
        }
        if (item.Type === 'Season') {
            return Promise.resolve({ Items: [item] });
        }
        if (item.Type === 'Episode' && item.SeasonId) {
            return client.getItem(userId, item.SeasonId).then(function (season) {
                return { Items: [season] };
            });
        }
        return Promise.resolve({ Items: [] });
    }

    function loadItem(id) {
        var client = global.ApiClient;
        if (!client || state.loadingId === id) {
            if (!client) {
                global.clearTimeout(state.retryTimer);
                state.retryTimer = global.setTimeout(scheduleReconcile, 250);
            }
            return;
        }

        var generation = state.generation;
        var userId = client.getCurrentUserId();
        state.loadingId = id;
        Promise.all([
            client.getItem(userId, id),
            client.getSimilarItems(id, {
                userId: userId,
                limit: 12,
                fields: 'ImageTags,BackdropImageTags,CommunityRating,ProductionYear'
            }).catch(function () { return { Items: [] }; })
        ]).then(function (results) {
            if (generation !== state.generation || id !== state.currentId || !state.mount) {
                return null;
            }
            state.item = results[0];
            state.similar = results[1].Items || [];
            decorateButtons();
            return loadSeasons(client, userId, state.item);
        }).then(function (result) {
            if (!result || generation !== state.generation || id !== state.currentId || !state.mount) {
                return;
            }
            var seasons = result.Items || [];
            renderHeroFacts(state.item, seasons);
            decorateSimilar(state.mount.page);
            if (['Series', 'Season', 'Episode'].includes(state.item.Type) && seasons.length) {
                createEpisodeSection(state.mount.page, seasons);
            }
            state.loadingId = '';
        }).catch(function () {
            if (generation === state.generation) {
                state.loadingId = '';
            }
        });
    }

    function resetItem(id) {
        state.generation++;
        state.currentId = id;
        state.item = null;
        state.loadingId = '';
        state.selectedSeasonId = '';
        state.similar = [];
        state.sortDescending = false;
        if (state.mount) {
            clear(state.mount.facts);
            clear(state.mount.genres);
            clear(state.mount.childTitle);
            state.mount.childTitle.hidden = true;
            state.mount.hero.classList.remove('sleekfin-details-has-child-title');
            state.mount.episodeSection?.remove();
            state.mount.episodeSection = null;
        }
        loadItem(id);
    }

    function mount(page, id) {
        var hero = document.createElement('div');
        var stack = document.createElement('div');
        var title = document.createElement('div');
        var childTitle = document.createElement('div');
        var facts = document.createElement('div');
        var genres = document.createElement('div');
        var logo = page.querySelector('.detailLogo');
        var name = page.querySelector('.nameContainer');
        var overview = page.querySelector('.overview');
        var actions = page.querySelector('.mainDetailButtons');

        hero.className = 'sleekfin-details-hero';
        stack.className = 'sleekfin-details-stack';
        title.className = 'sleekfin-details-title';
        childTitle.className = 'sleekfin-details-child-title';
        childTitle.hidden = true;
        facts.className = 'sleekfin-details-facts';
        genres.className = 'sleekfin-details-genres';
        hero.appendChild(createBackButton());
        move(logo, title);
        move(name, title);
        stack.appendChild(title);
        stack.appendChild(childTitle);
        stack.appendChild(facts);
        stack.appendChild(genres);
        move(overview, stack);
        move(actions, stack);
        hero.appendChild(stack);
        page.insertBefore(hero, page.querySelector('.detailPageWrapperContainer'));

        state.mount = {
            actions: actions,
            backdrop: page.querySelector('#itemBackdrop'),
            backdropOriginal: page.querySelector('#itemBackdrop').style.backgroundImage,
            childTitle: childTitle,
            downloadWasHidden: actions.querySelector('.btnDownload')?.classList.contains('hide'),
            facts: facts,
            genres: genres,
            hero: hero,
            logo: logo,
            page: page
        };
        page.dataset.sleekfinDetails = 'true';
        document.documentElement.classList.add('sleekfin-details-mounted');
        state.buttonObserver = new MutationObserver(decorateButtons);
        state.buttonObserver.observe(actions, { attributes: true, subtree: true, attributeFilter: ['data-isfavorite'] });
        syncHero();
        decorateButtons();
        decorateSections(page);
        resetItem(id);
    }

    function unmount() {
        state.generation++;
        global.clearTimeout(state.retryTimer);
        state.currentId = '';
        state.item = null;
        state.loadingId = '';
        state.selectedSeasonId = '';
        state.similar = [];
        state.buttonObserver?.disconnect();
        state.buttonObserver = null;
        if (state.mount) {
            state.mount.page.querySelectorAll('.sleekfin-section-heading').forEach(function (heading) { heading.remove(); });
            state.mount.page.querySelectorAll('.sleekfin-details-original-heading').forEach(function (heading) {
                heading.classList.remove('sleekfin-details-original-heading');
            });
            state.mount.actions.querySelectorAll('.sleekfin-details-suppressed-action').forEach(function (button) {
                button.classList.remove('sleekfin-details-suppressed-action');
            });
            state.mount.episodeSection?.remove();
            state.mount.backdrop.style.backgroundImage = state.mount.backdropOriginal;
            state.mount.actions.querySelector('.btnDownload')?.classList.toggle('hide', state.mount.downloadWasHidden);
            restoreMoved();
            state.mount.hero.remove();
            state.mount.page.removeAttribute('data-sleekfin-details');
        }
        state.mount = null;
        document.documentElement.classList.remove('sleekfin-details-mounted');
    }

    function reconcile() {
        if (!state.started) {
            return;
        }

        var page = findPage();
        var id = routeId();
        if (!page || !id) {
            if (state.mount) {
                unmount();
            }
            return;
        }
        if (!state.mount || state.mount.page !== page || !state.mount.hero.isConnected) {
            unmount();
            mount(page, id);
            return;
        }
        if (state.currentId !== id) {
            resetItem(id);
        } else if (!state.item) {
            loadItem(id);
        }
        syncHero();
        decorateButtons();
        decorateSections(page);
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
        global.clearTimeout(state.retryTimer);
        state.observer?.disconnect();
        state.observer = null;
        WINDOW_EVENTS.forEach(function (eventName) {
            global.removeEventListener(eventName, scheduleReconcile);
        });
        document.removeEventListener('viewshow', scheduleReconcile);
        unmount();
    }

    NAMESPACE.details = {
        version: MODULE_VERSION,
        reconcile: reconcile,
        stop: stop
    };
    start();
}(window));