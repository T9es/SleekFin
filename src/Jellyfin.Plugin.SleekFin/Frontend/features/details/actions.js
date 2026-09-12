import { decorateNativeButton, restoreNativeButton } from '../../shared/runtime.js';

export function createActions(container, isEpisode) {
  const decorated = new Set();

  function reconcile() {
    const buttons = container.querySelectorAll('.btnPlay, .btnReplay, .btnDownload, .btnUserRating');
    const hasEpisodeResume = isEpisode && Array.from(buttons).some((element) => element.dataset.action === 'resume' && !element.classList.contains('hide'));

    buttons.forEach((element) => {
      const isFavorite = element.classList.contains('btnUserRating');
      const isDownload = element.classList.contains('btnDownload');
      const icon = isFavorite ? (element.dataset.isfavorite === 'true' ? 'bookmarkCheck' : 'bookmark') : isDownload ? 'download' : 'play';
      const label = isFavorite ? (element.dataset.isfavorite === 'true' ? 'In watchlist' : 'Add to watchlist') : isDownload ? 'Download' : element.dataset.action === 'resume' ? 'Resume' : 'Play';

      element.classList.toggle('sleekfin-details-suppressed-action', hasEpisodeResume && element.dataset.action === 'play');
      decorateNativeButton(element, {
        content: element.querySelector('.detailButton-content') || element,
        icon,
        label,
        variant: icon === 'play' ? 'primary' : 'control',
      });
      decorated.add(element);
    });
  }

  const observer = new MutationObserver(reconcile);
  observer.observe(container, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-isfavorite'],
  });

  return {
    destroy() {
      observer.disconnect();
      decorated.forEach((element) => {
        element.classList.remove('sleekfin-details-suppressed-action');
        restoreNativeButton(element);
      });
      decorated.clear();
    },
    reconcile,
  };
}
