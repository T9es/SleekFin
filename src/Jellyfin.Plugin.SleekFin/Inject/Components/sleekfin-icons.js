(function (global) {
    'use strict';

    var MODULE_VERSION = '0.2.0';
    var NAMESPACE = global.SleekFin = global.SleekFin || {};
    var document = global.document;

    if (!document || !document.documentElement) {
        return;
    }

    if (NAMESPACE.icons && NAMESPACE.icons.version === MODULE_VERSION) {
        return;
    }

    var SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
    var STROKE_WIDTHS = {
        download: 2,
        info: 2,
        star: 2
    };
    var ICONS = {
        arrowDownAz: [
            ['path', { d: 'm3 16 4 4 4-4' }],
            ['path', { d: 'M7 20V4' }],
            ['path', { d: 'M20 8h-5' }],
            ['path', { d: 'M15 10V6.5a2.5 2.5 0 0 1 5 0V10' }],
            ['path', { d: 'M15 14h5l-5 6h5' }]
        ],
        arrowLeft: [
            ['path', { d: 'm12 19-7-7 7-7' }],
            ['path', { d: 'M19 12H5' }]
        ],
        arrowUpAz: [
            ['path', { d: 'm3 8 4-4 4 4' }],
            ['path', { d: 'M7 4v16' }],
            ['path', { d: 'M20 8h-5' }],
            ['path', { d: 'M15 10V6.5a2.5 2.5 0 0 1 5 0V10' }],
            ['path', { d: 'M15 14h5l-5 6h5' }]
        ],
        bookmark: [
            ['path', { d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' }]
        ],
        bookmarkCheck: [
            ['path', { d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' }],
            ['path', { d: 'm9 10 2 2 4-4' }]
        ],
        download: [
            ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
            ['polyline', { points: '7 10 12 15 17 10' }],
            ['line', { x1: '12', x2: '12', y1: '15', y2: '3' }]
        ],
        grid: [
            ['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1' }],
            ['rect', { width: '7', height: '7', x: '14', y: '3', rx: '1' }],
            ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '1' }],
            ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '1' }]
        ],
        info: [
            ['circle', { cx: '12', cy: '12', r: '10' }],
            ['path', { d: 'M12 16v-4' }],
            ['path', { d: 'M12 8h.01' }]
        ],
        list: [
            ['line', { x1: '8', x2: '21', y1: '6', y2: '6' }],
            ['line', { x1: '8', x2: '21', y1: '12', y2: '12' }],
            ['line', { x1: '8', x2: '21', y1: '18', y2: '18' }],
            ['line', { x1: '3', x2: '3.01', y1: '6', y2: '6' }],
            ['line', { x1: '3', x2: '3.01', y1: '12', y2: '12' }],
            ['line', { x1: '3', x2: '3.01', y1: '18', y2: '18' }]
        ],
        play: [
            ['polygon', { points: '5,3 19,12 5,21' }]
        ],
        search: [
            ['circle', { cx: '11', cy: '11', r: '8' }],
            ['path', { d: 'm21 21-4.3-4.3' }]
        ],
        star: [
            ['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }]
        ]
    };

    function create(name, strokeWidth) {
        var nodes = ICONS[name];
        if (!nodes) {
            return null;
        }

        var svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.classList.add('sleekfin-icon');
        svg.dataset.sleekfinIcon = name;
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', name === 'play' || name === 'star' ? 'currentColor' : 'none');
        svg.setAttribute('stroke', name === 'play' ? 'none' : 'currentColor');
        svg.setAttribute('stroke-width', String(strokeWidth || STROKE_WIDTHS[name] || 1.75));
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        nodes.forEach(function (definition) {
            var node = document.createElementNS(SVG_NAMESPACE, definition[0]);
            Object.keys(definition[1]).forEach(function (attribute) {
                node.setAttribute(attribute, definition[1][attribute]);
            });
            svg.appendChild(node);
        });
        return svg;
    }

    NAMESPACE.icons = {
        create: create,
        version: MODULE_VERSION
    };
}(window));