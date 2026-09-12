import { h, dom, Meta, render } from '../../shared/runtime.js';

function ratingFor(value) {
  const rating = Number(value);
  return rating > 0 ? rating.toFixed(1) : '';
}

function release(card, record) {
  render(null, record.meta);
  record.meta.remove();
}

export function createSimilar(page) {
  const records = new Map();
  const ratings = new Map();
  let pendingRatings = false;

  // These cards show no rating of their own and carry no rating attribute, so the values are
  // resolved from the ids actually rendered. A similar-items request cannot be used: Jellyfin
  // samples that endpoint independently, so its response never matches this row.
  function loadRatings(cards) {
    const client = window.ApiClient;
    if (!client || typeof client.getItems !== 'function') return;

    const ids = cards.map((card) => card.dataset.id).filter((id) => id && !ratings.has(id));
    if (!ids.length) return;

    // Ids are claimed before the request so a reconcile during the round trip cannot
    // start a duplicate one. An empty value keeps the star out until a rating is known.
    ids.forEach((id) => ratings.set(id, ''));
    pendingRatings = true;
    client
      .getItems(client.getCurrentUserId(), {
        EnableTotalRecordCount: false,
        Fields: 'CommunityRating',
        Ids: ids.join(','),
      })
      .then((result) => {
        (result.Items || []).forEach((mediaItem) => {
          ratings.set(mediaItem.Id, ratingFor(mediaItem.CommunityRating));
        });
      })
      .catch(() => {})
      .then(() => {
        pendingRatings = false;
        renderItems();
      });
  }

  function valuesFor(card) {
    const endDate = card.dataset.enddate;
    const year = endDate ? endDate.slice(0, 4) : '';
    const values = [];
    const rating = ratings.get(card.dataset.id);
    if (rating) {
      values.push({ accent: true, icon: 'star', text: rating });
    }
    values.push({ text: year });
    values.push({ text: card.dataset.type === 'Movie' ? 'Movie' : 'Series' });
    return values;
  }

  function renderItems() {
    const cards = Array.from(page.querySelectorAll('#similarCollapsible .card[data-id]'));
    cards.forEach((card) => {
      const cardBox = card.querySelector('.cardBox');
      if (!cardBox || !dom.isConnected(card)) return;

      let record = records.get(card);
      if (record && record.meta.parentElement !== cardBox) {
        release(card, record);
        record = null;
      }
      if (!record) {
        const meta = document.createElement('div');
        meta.className = 'sleekfin-details-similar-meta sleekfin-meta';
        cardBox.appendChild(meta);
        record = { endDate: '', meta, rating: '', type: '' };
        records.set(card, record);
      }

      // Jellyfin renders these cards from a different sample than any similar-items request,
      // so the card's own data is the only reliable description of this row. Rebuild the meta
      // line only when one of those values, including the resolved rating, changes.
      const rating = ratings.get(card.dataset.id) || '';
      if (record.endDate !== card.dataset.enddate || record.type !== card.dataset.type || record.rating !== rating) {
        record.endDate = card.dataset.enddate;
        record.rating = rating;
        record.type = card.dataset.type;
        render(<Meta values={valuesFor(card)} />, record.meta);
      }
    });

    Array.from(records.keys()).forEach((card) => {
      if (!dom.isConnected(card)) {
        release(card, records.get(card));
        records.delete(card);
      }
    });

    if (!pendingRatings) loadRatings(cards);
  }

  return {
    destroy() {
      records.forEach((record, card) => release(card, record));
      records.clear();
      ratings.clear();
    },
    render: renderItems,
  };
}
