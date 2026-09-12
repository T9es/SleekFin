import { h, render, SectionHeading } from '../../shared/runtime.js';

function createHeading(title, subtitle) {
  const root = document.createElement('div');
  root.className = 'sleekfin-section-heading';
  render(<SectionHeading title={title} subtitle={subtitle} contentsOnly />, root);
  return root;
}

function removeHeading(root) {
  render(null, root);
  root.remove();
}

export function createSections(page) {
  const records = new Map();

  function add(selector, title, subtitle) {
    const section = page.querySelector(selector);
    if (!section) return;

    const original = section.querySelector(':scope > .sectionTitle');
    const record = records.get(section);
    if (record && record.heading.parentElement === section && record.original === original) return;
    if (record) {
      removeHeading(record.heading);
      record.original?.classList.remove('sleekfin-details-original-heading');
    }

    const heading = createHeading(title, subtitle);
    section.insertBefore(heading, original || section.firstChild);
    original?.classList.add('sleekfin-details-original-heading');
    records.set(section, { heading, original });
  }

  function reconcile() {
    add('#castCollapsible', 'Cast', 'The cast behind this title');
    add('#similarCollapsible', 'You may like', 'More titles like this one');
  }

  reconcile();
  return {
    destroy() {
      records.forEach((record) => {
        removeHeading(record.heading);
        record.original?.classList.remove('sleekfin-details-original-heading');
      });
      records.clear();
    },
    reconcile,
  };
}
