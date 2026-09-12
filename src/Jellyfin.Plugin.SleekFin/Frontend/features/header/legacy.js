import { dom } from '../../shared/runtime.js';
import { cleanup, createMount, directChildren, layoutMode, mark, move, rememberMove, updateScrolledState } from './shared.js';

export function createLegacyAdapter(brand) {
  function mount(header) {
    const top = header.querySelector('.headerTop');
    const left = header.querySelector('.headerLeft');
    const right = header.querySelector('.headerRight');
    const tabs = header.querySelector('.headerTabs');
    const menu = left?.querySelector('.mainDrawerButton') || null;
    const cluster = dom.element('<div data-sleekfin-legacy-cluster="true"></div>');
    const headerMount = createMount({
      cluster,
      header,
      kind: 'legacy',
      layoutMode: layoutMode(),
      menu,
    });

    top.appendChild(cluster);
    mark(headerMount, header, 'data-sleekfin-header', 'legacy');
    mark(headerMount, top, 'data-sleekfin-legacy-top');
    mark(headerMount, left, 'data-sleekfin-legacy-left');
    if (left) {
      directChildren(left)
        .filter((element) => element !== menu && element.matches('button, .headerButton, .paper-icon-button-light'))
        .forEach((element) => move(headerMount, element, cluster));
    }
    if (menu) {
      rememberMove(headerMount, menu);
      top.insertBefore(menu, cluster);
      mark(headerMount, menu, 'data-sleekfin-header-menu');
    }
    if (tabs && headerMount.layoutMode === 'desktop') {
      move(headerMount, tabs, cluster);
    }
    move(headerMount, right, cluster);
    brand.ensureFallback();
    return headerMount;
  }

  function needsReplacement(mount, surface) {
    return mount.header !== surface.header || mount.layoutMode !== layoutMode() || !dom.isConnected(mount.cluster) || mount.menu !== surface.header.querySelector('.mainDrawerButton');
  }

  function refresh(mount) {
    updateScrolledState(mount);
    brand.updateOffset(mount);
  }

  return { cleanup, mount, needsReplacement, refresh };
}
