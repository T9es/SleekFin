import { dom } from '../../shared/runtime.js';
import { createDropdown } from './dropdown.js';

const FIELDS = ['selectSource', 'selectVideo', 'selectAudio', 'selectSubtitles'];

export function createTrackPickers(page, slot, onSourceChange) {
  if (slot) slot.hidden = true;
  const form = page.querySelector('form.trackSelections');
  if (!form || !slot) return { reconcile() {}, destroy() {} };
  const originalParent = form.parentNode;
  const originalNextSibling = form.nextSibling;
  let sourceId = '';
  let destroyed = false;
  let timer = 0;

  function restoreForm() {
    if (form.parentNode === slot && dom.isConnected(originalParent)) {
      originalParent.insertBefore(form, originalNextSibling?.parentNode === originalParent ? originalNextSibling : null);
    }
  }

  const pickers = FIELDS.map((className) => {
    const select = form.querySelector(`.${className}`);
    const container = select?.closest('.selectContainer');
    if (!container) return null;
    const root = dom.element('<div class="sleekfin-details-track"><button type="button" class="sleekfin-details-track-trigger"><span class="sleekfin-details-track-label"></span><span class="sleekfin-details-track-value"></span><span class="sleekfin-details-track-chevron"></span></button></div>');
    const trigger = root.firstElementChild;
    const label = root.querySelector('.sleekfin-details-track-label');
    const value = root.querySelector('.sleekfin-details-track-value');
    const dropdown = createDropdown({ root, trigger, onSelect(option) {
      if (select.value === option.value) return;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } });
    select.classList.add('sleekfin-details-track-native');
    select.addEventListener('change', sync);
    container.appendChild(root);
    return { container, dropdown, label, root, select, trigger, value };
  }).filter(Boolean);

  function sync() {
    if (destroyed || !dom.isConnected(page)) return;
    const formHidden = form.classList.contains('hide');
    pickers.forEach((picker) => {
      const { container, dropdown, label, root, select, trigger, value } = picker;
      root.hidden = formHidden || container.classList.contains('hide');
      trigger.disabled = select.disabled;
      const labelText = container.querySelector('.selectLabel')?.textContent.trim() || '';
      const valueText = select.options[select.selectedIndex]?.text || '';
      if (label.textContent !== labelText) label.textContent = labelText;
      if (value.textContent !== valueText) value.textContent = valueText;
      dropdown.update(Array.from(select.options, (option) => ({ value: option.value, label: option.text })), select.value);
    });
    const visible = pickers.some((picker) => !picker.root.hidden);
    slot.hidden = !visible;
    slot.parentElement.classList.toggle('sleekfin-details-has-tracks', visible);
    if (visible && form.parentNode !== slot) slot.appendChild(form);
    else if (!visible) restoreForm();

    const selectedSource = form.querySelector('.selectSource')?.value || '';
    if (selectedSource !== sourceId) {
      sourceId = selectedSource;
      if (sourceId) onSourceChange?.(sourceId);
    }
  }

  // Jellyfin 12 updates this form in place; only native mutations need another sync.
  const observer = new MutationObserver((records) => {
    if (!records.some((record) => !record.target.closest('.sleekfin-details-track'))) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(sync, 60);
  });
  observer.observe(form, { attributes: true, attributeFilter: ['class', 'disabled'], childList: true, subtree: true });
  sync();

  return {
    reconcile: sync,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      window.clearTimeout(timer);
      pickers.forEach(({ dropdown, root, select }) => {
        dropdown.destroy();
        select.removeEventListener('change', sync);
        root.remove();
        select.classList.remove('sleekfin-details-track-native');
      });
      restoreForm();
    },
  };
}
