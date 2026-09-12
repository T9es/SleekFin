import { h, dom, item, Meta, render } from '../../shared/runtime.js';

function imageStyleUrl(url) {
  return `url("${url.replace(/["\\]/g, '\\$&')}")`;
}

export function createSimilar(page) {
  const records = new Map();

  function restore(card) {
    const record = records.get(card);
    if (!record) return;
    if (dom.isConnected(record.image)) {
      if (record.backdrop) {
        record.image.style.setProperty('--sleekfin-similar-backdrop', record.backdrop);
      } else {
        record.image.style.removeProperty('--sleekfin-similar-backdrop');
      }
      if (record.poster) {
        record.image.style.setProperty('--sleekfin-similar-poster', record.poster);
      } else {
        record.image.style.removeProperty('--sleekfin-similar-poster');
      }
      record.image.classList.toggle('lazy-hidden', record.hadLazyHidden);
    }
    render(null, record.meta);
    record.meta.remove();
    records.delete(card);
  }

  function renderItems(items) {
    const byId = new Map(items.map((mediaItem) => [mediaItem.Id, mediaItem]));
    const active = new Set();
    page.querySelectorAll('#similarCollapsible .card[data-id]').forEach((card) => {
      const mediaItem = byId.get(card.dataset.id);
      if (!mediaItem) {
        restore(card);
        return;
      }

      const image = card.querySelector('.cardImageContainer');
      const cardBox = card.querySelector('.cardBox');
      if (!image || !cardBox) return;

      let record = records.get(card);
      if (record && (record.id !== card.dataset.id || record.image !== image || record.meta.parentElement !== cardBox)) {
        restore(card);
        record = null;
      }
      if (!record) {
        const meta = document.createElement('div');
        meta.className = 'sleekfin-details-similar-meta sleekfin-meta';
        cardBox.appendChild(meta);
        record = {
          backdrop: image.style.getPropertyValue('--sleekfin-similar-backdrop'),
          hadLazyHidden: image.classList.contains('lazy-hidden'),
          id: card.dataset.id,
          image,
          meta,
          poster: image.style.getPropertyValue('--sleekfin-similar-poster'),
        };
        records.set(card, record);
      }
      active.add(card);

      const backdrop = item.imageUrl(mediaItem, 'Backdrop', { inherit: true, maxWidth: 840, quality: 90 });
      const poster = item.imageUrl(mediaItem, 'Primary', { maxWidth: 342, quality: 90 });
      if (backdrop) {
        image.style.setProperty('--sleekfin-similar-backdrop', imageStyleUrl(backdrop));
      }
      if (poster) {
        image.style.setProperty('--sleekfin-similar-poster', imageStyleUrl(poster));
      }
      if (backdrop || poster) {
        image.classList.remove('lazy-hidden');
      }

      const values = [];
      if (Number(mediaItem.CommunityRating) > 0) {
        values.push({ accent: true, icon: 'star', text: Number(mediaItem.CommunityRating).toFixed(1) });
      }
      values.push({ text: item.year(mediaItem) });
      values.push({ text: item.typeLabel(mediaItem.Type) || 'Movie' });
      render(<Meta values={values} />, record.meta);
    });

    Array.from(records.keys()).forEach((card) => {
      if (!active.has(card) || !dom.isConnected(card)) {
        restore(card);
      }
    });
  }

  return {
    destroy() {
      Array.from(records.keys()).forEach(restore);
    },
    render: renderItems,
  };
}
