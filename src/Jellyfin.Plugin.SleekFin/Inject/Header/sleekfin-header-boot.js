(function () {
    'use strict';

    var root = document.documentElement;
    var concealingClass = 'sleekfin-header-concealing';
    var mountedClass = 'sleekfin-header-mounted';

    if (!root || root.hasAttribute('data-sleekfin-header-boot')) return;
    root.setAttribute('data-sleekfin-header-boot', 'true');

    // Jellyfin paints its own header first and SleekFin adopts and restyles that same element about
    // 1.3s later, so the native chrome is visible unless it is concealed from the first paint. That
    // is why this runs as a blocking script in the head, and why the conceal lifts on the mount class
    // rather than on a replacement element appearing. SleekFin restyles the element in place, so a
    // conceal that outlived the mount would hide the finished header too.
    //
    // Concealing is guarded so it cannot feed itself: the observer watches the class attribute this
    // script writes, so concealing again in response to its own write would never settle. It writes
    // the class at most once, `settled` latches on every exit, and the observer disconnects as soon
    // as the conceal is released. The failsafe covers a header that never mounts, which would
    // otherwise stay concealed. The CSS gives the mounted rule priority, so an adopted header is
    // visible even in the task where both classes overlap.
    var settled = false;
    var failsafe = 0;
    var observer = null;

    function release() {
        settled = true;
        window.clearTimeout(failsafe);
        failsafe = 0;
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        root.classList.remove(concealingClass);
    }

    function sync() {
        if (settled) return;
        if (root.classList.contains(mountedClass)) {
            release();
            return;
        }
        if (root.classList.contains(concealingClass)) return;

        root.classList.add(concealingClass);
        failsafe = window.setTimeout(release, 4000);
    }

    if (root.classList.contains(mountedClass)) {
        settled = true;
        return;
    }

    observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    sync();
})();
