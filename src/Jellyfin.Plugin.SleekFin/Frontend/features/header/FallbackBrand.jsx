import { Fragment, dom, h, render } from '../../shared/runtime.js';
import { mark } from './shared.js';

function FallbackBrand({ imageSource, serverName }) {
  return (
    <>
      <img src={imageSource} />
      <span>{serverName}</span>
    </>
  );
}

export function createBrandController(isActive) {
  const state = {
    fallback: null,
    serverName: '',
    serverNameRequested: false,
  };

  function readServerName(nativeBrand) {
    const nativeText = nativeBrand?.textContent.trim();
    if (nativeText) {
      state.serverName = nativeText;
    }
    if (!state.serverName) {
      state.serverName = (document.title || 'Jellyfin').replace(/\s+[|·-]\s+Jellyfin$/i, '').trim() || 'Jellyfin';
    }
    return state.serverName;
  }

  function findImageSource() {
    const nativeImage = document.querySelector('a[href="#/"] img');
    if (nativeImage) return nativeImage.currentSrc || nativeImage.src;

    const icons = Array.from(document.querySelectorAll('link[rel~="icon"]'));
    const preferredIcon = icons.find((icon) => /icon-transparent|apple-touch|192|512/i.test(icon.getAttribute('href') || '')) || icons[icons.length - 1];
    return preferredIcon ? preferredIcon.href : '';
  }

  function renderFallback() {
    if (!dom.isConnected(state.fallback)) return;

    render(<FallbackBrand imageSource={findImageSource()} serverName={readServerName(null)} />, state.fallback);
  }

  function requestServerName() {
    if (state.serverNameRequested || typeof window.fetch !== 'function') return;

    const systemInfoUrl = window.ApiClient && typeof window.ApiClient.getUrl === 'function' ? window.ApiClient.getUrl('/System/Info/Public') : new URL('../System/Info/Public', document.baseURI).toString();
    state.serverNameRequested = true;
    window
      .fetch(systemInfoUrl, { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((systemInfo) => {
        if (!isActive()) return;

        const serverName = typeof systemInfo?.ServerName === 'string' ? systemInfo.ServerName.trim() : '';
        if (serverName) {
          state.serverName = serverName;
          renderFallback();
        }
      })
      .catch(() => {});
  }

  function removeFallback() {
    if (!state.fallback) return;

    render(null, state.fallback);
    state.fallback.remove();
    state.fallback = null;
  }

  function ensureFallback() {
    requestServerName();
    if (dom.isConnected(state.fallback)) return;

    removeFallback();
    const fallback = document.createElement('a');
    fallback.className = 'sleekfin-header-fallback-brand';
    fallback.href = '#/';
    document.body.appendChild(fallback);
    state.fallback = fallback;
    renderFallback();
  }

  function useNative(mount, nativeBrand) {
    readServerName(nativeBrand);
    mark(mount, nativeBrand, 'data-sleekfin-header-brand');
    removeFallback();
  }

  function updateOffset(mount) {
    mark(mount, mount.brand || state.fallback, 'data-sleekfin-header-menu-offset', dom.isVisible(mount.menu) ? 'true' : 'false');
  }

  return { ensureFallback, removeFallback, updateOffset, useNative };
}
