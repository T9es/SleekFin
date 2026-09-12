export function element(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

export function isConnected(target) {
  if (!target) return false;
  return typeof target.isConnected === 'boolean' ? target.isConnected : Boolean(document.documentElement?.contains(target));
}

export function isVisible(target) {
  if (!isConnected(target) || target.getClientRects().length === 0) return false;

  const style = window.getComputedStyle(target);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function insertAfter(reference, element) {
  reference?.parentNode?.insertBefore(element, reference.nextSibling);
}

export function replace(current, replacement) {
  current?.parentNode?.replaceChild(replacement, current);
}

function observationRoot() {
  return document.getElementById('reactRoot') || document.body || document.documentElement;
}

export function watchSpa(callback, options) {
  const settings = options || {};
  const eventNames = settings.events || [];
  const passiveEvents = new Set(settings.passiveEvents || []);
  const observer = new MutationObserver(callback);
  observer.observe(observationRoot(), { childList: true, subtree: true });
  eventNames.forEach((eventName) => {
    window.addEventListener(eventName, callback, passiveEvents.has(eventName) ? { passive: true } : false);
  });
  if (settings.viewshow) {
    document.addEventListener('viewshow', callback);
  }

  return function stopWatching() {
    observer.disconnect();
    eventNames.forEach((eventName) => {
      window.removeEventListener(eventName, callback);
    });
    if (settings.viewshow) {
      document.removeEventListener('viewshow', callback);
    }
  };
}

export default {
  element,
  insertAfter,
  isConnected,
  isVisible,
  replace,
  watchSpa,
};
