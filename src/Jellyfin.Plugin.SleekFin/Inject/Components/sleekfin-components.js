(function (global) {
    'use strict';

    var MODULE_VERSION = '0.2.0';
    var ITEM_TYPE_LABELS = {
        Episode: 'Episode',
        Movie: 'Movie',
        Season: 'Season',
        Series: 'TV Show'
    };
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var document = global.document;

    if (!document || !document.documentElement || !NAMESPACE.icons) {
        return;
    }

    if (NAMESPACE.components && NAMESPACE.components.version === MODULE_VERSION) {
        return;
    }

    function appendText(parent, className, text, tagName) {
        var element = document.createElement(tagName || 'span');
        element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function setIcon(parent, name, strokeWidth) {
        var current = parent.querySelector(':scope > .sleekfin-icon');
        if (current?.dataset.sleekfinIcon === name) {
            return current;
        }

        var icon = NAMESPACE.icons.create(name, strokeWidth);
        if (!icon) {
            return null;
        }
        current?.replaceWith(icon);
        if (!current) {
            parent.prepend(icon);
        }
        return icon;
    }

    function setButtonContent(parent, iconName, label) {
        setIcon(parent, iconName);
        var labelElement = parent.querySelector(':scope > .sleekfin-button-label');
        if (!labelElement) {
            appendText(parent, 'sleekfin-button-label', label);
            return;
        }
        labelElement.textContent = label;
    }

    function createButton(variant, iconName, label) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'sleekfin-button sleekfin-button-' + variant;
        if (variant === 'control') {
            button.classList.add('sleekfin-control-3d');
        }
        setButtonContent(button, iconName, label);
        return button;
    }

    function createSectionHeading(title, subtitle) {
        var heading = document.createElement('div');
        var rail = document.createElement('span');
        var copy = document.createElement('div');
        heading.className = 'sleekfin-section-heading';
        rail.className = 'sleekfin-section-rail';
        copy.className = 'sleekfin-section-copy';
        appendText(copy, 'sleekfin-section-title', title, 'h2');
        if (subtitle) {
            appendText(copy, 'sleekfin-section-subtitle', subtitle, 'p');
        }
        heading.appendChild(rail);
        heading.appendChild(copy);
        return heading;
    }

    function appendFact(parent, text, options) {
        if (!text) {
            return null;
        }
        if (parent.childElementCount) {
            appendText(parent, 'sleekfin-fact-dot', '·');
        }

        var fact = document.createElement('span');
        fact.className = 'sleekfin-fact' + (options?.className ? ' ' + options.className : '');
        if (options?.icon) {
            fact.appendChild(NAMESPACE.icons.create(options.icon));
        }
        fact.append(text);
        parent.appendChild(fact);
        return fact;
    }

    function renderMeta(parent, values) {
        parent.replaceChildren();
        parent.classList.add('sleekfin-meta');
        values.filter(function (value) { return value.text; }).forEach(function (value, index) {
            var item = document.createElement('span');
            var content = document.createElement('span');
            item.className = 'sleekfin-meta-item';
            content.className = 'sleekfin-meta-content' + (value.accent ? ' sleekfin-meta-accent' : '');
            if (index) {
                appendText(item, 'sleekfin-meta-separator', '·');
            }
            if (value.icon) {
                content.appendChild(NAMESPACE.icons.create(value.icon));
            }
            content.append(value.text);
            item.appendChild(content);
            parent.appendChild(item);
        });
    }

    function formatRuntime(ticks) {
        var minutes = Math.round(Number(ticks || 0) / 600000000);
        if (!minutes) {
            return '';
        }

        var hours = Math.floor(minutes / 60);
        return hours ? hours + 'h ' + (minutes % 60) + 'm' : minutes + 'm';
    }

    function itemYear(item) {
        if (item?.ProductionYear) {
            return String(item.ProductionYear);
        }
        return item?.PremiereDate ? String(new Date(item.PremiereDate).getFullYear()) : '';
    }

    function itemTypeLabel(type) {
        return ITEM_TYPE_LABELS[type] || type || '';
    }

    function isVisible(element) {
        return Boolean(element && element.isConnected && element.getClientRects().length);
    }

    function setItemAction(element, item, action) {
        var position = Number(item.UserData?.PlaybackPositionTicks || 0);
        element.classList.add('itemAction');
        element.dataset.action = action || (position > 0 ? 'resume' : 'play');
        element.dataset.id = item.Id;
        element.dataset.serverid = item.ServerId || global.ApiClient.serverId();
        element.dataset.type = item.Type;
        element.dataset.mediatype = item.MediaType || 'Video';
        element.dataset.isfolder = String(Boolean(item.IsFolder));
        if (!action) {
            element.dataset.positionticks = String(position);
        }
    }

    NAMESPACE.components = {
        appendFact: appendFact,
        appendText: appendText,
        createButton: createButton,
        createSectionHeading: createSectionHeading,
        formatRuntime: formatRuntime,
        itemTypeLabel: itemTypeLabel,
        itemYear: itemYear,
        isVisible: isVisible,
        renderMeta: renderMeta,
        setButtonContent: setButtonContent,
        setIcon: setIcon,
        setItemAction: setItemAction,
        version: MODULE_VERSION
    };
}(window));