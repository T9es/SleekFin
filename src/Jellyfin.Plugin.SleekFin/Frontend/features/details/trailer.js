import { dom } from '../../shared/runtime.js';

const START_DELAY_MS = 2500;
const START_TIMEOUT_MS = 7000;
const YOUTUBE_API_TIMEOUT_MS = 10000;
const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
const VIDEO_MIME_TYPES = Object.freeze({
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  webm: 'video/webm',
});
const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
let youtubeApiPromise = null;

function isYouTubeApiScript(script) {
  try {
    const url = new URL(script.src, document.baseURI);
    return ['youtube.com', 'www.youtube.com'].includes(url.hostname.toLowerCase()) && url.pathname === '/iframe_api';
  } catch {
    return false;
  }
}

function loadYouTubeApi() {
  if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let poll = 0;
    let script = null;
    const deadline = Date.now() + YOUTUBE_API_TIMEOUT_MS;
    const finish = (error, api) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      if (error && script?.parentNode) script.parentNode.removeChild(script);
      if (error) reject(error);
      else resolve(api);
    };

    if (!Array.from(document.querySelectorAll('script[src]')).some(isYouTubeApiScript)) {
      script = document.createElement('script');
      script.src = YOUTUBE_API_URL;
      script.async = true;
      script.onerror = () => finish(new Error('YouTube iframe API failed to load'));
      (document.head || document.documentElement).appendChild(script);
    }

    poll = window.setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') finish(null, window.YT);
      else if (Date.now() >= deadline) finish(new Error('YouTube iframe API timed out'));
    }, 100);
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

function youtubeVideoId(value) {
  if (typeof value !== 'string' || !value) return '';

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return '';

    const hostname = url.hostname.toLowerCase();
    let id = '';
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
    } else if (['youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(hostname)) {
      id = url.pathname.match(/^\/embed\/([^/]+)/)?.[1] || '';
    }
    return YOUTUBE_VIDEO_ID.test(id) ? id : '';
  } catch {
    return '';
  }
}

function mediaSourceFor(trailer) {
  const video = document.createElement('video');
  const sources = Array.isArray(trailer.MediaSources) ? trailer.MediaSources : [];
  for (const source of sources) {
    const container = String(source.Container || trailer.Container || '').toLowerCase().replace(/^\./, '');
    const mimeType = VIDEO_MIME_TYPES[container];
    if (!source.Id || !mimeType || !video.canPlayType || !video.canPlayType(mimeType)) continue;
    const hasDirectFlags = Object.prototype.hasOwnProperty.call(source, 'SupportsDirectPlay') || Object.prototype.hasOwnProperty.call(source, 'SupportsDirectStream');
    if (hasDirectFlags && !source.SupportsDirectPlay && !source.SupportsDirectStream) continue;
    return { source, container };
  }

  const container = String(trailer.Container || '').toLowerCase().replace(/^\./, '');
  const mimeType = VIDEO_MIME_TYPES[container];
  if (!mimeType || !video.canPlayType || !video.canPlayType(mimeType)) return null;
  return { source: null, container };
}

function localTrailerUrl(client, trailer) {
  if (!trailer?.Id || !client || typeof client.getUrl !== 'function') return '';
  const selected = mediaSourceFor(trailer);
  if (!selected) return '';

  const options = { Static: true };
  if (selected.source?.Id) options.mediaSourceId = selected.source.Id;
  if (selected.source?.ETag) options.Tag = selected.source.ETag;
  if (selected.source?.LiveStreamId) options.LiveStreamId = selected.source.LiveStreamId;
  if (typeof client.deviceId === 'function') options.deviceId = client.deviceId();
  if (typeof client.accessToken === 'function') options.ApiKey = client.accessToken();
  return client.getUrl(`Videos/${encodeURIComponent(trailer.Id)}/stream.${selected.container}`, options);
}

function clearChildren(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

export function createTrailerPreview(page, nativeBackdrop, actions) {
  let currentItem = null;
  let enabled = false;
  let terminal = false;
  let generation = 0;
  let startTimer = 0;
  let attemptTimer = 0;
  let layer = null;
  let player = null;
  let sourceType = '';

  function sizeYouTubeFrame() {
    if (!player || !nativeBackdrop) return;
    const iframe = player.getIframe?.();
    const bounds = nativeBackdrop.getBoundingClientRect();
    if (!iframe || !bounds.width || !bounds.height) return;
    const width = Math.max(bounds.width, bounds.height * 16 / 9);
    const height = Math.max(bounds.height, bounds.width * 9 / 16);
    iframe.style.height = `${height}px`;
    iframe.style.left = '50%';
    iframe.style.position = 'absolute';
    iframe.style.top = '50%';
    iframe.style.transform = 'translate(-50%, -50%)';
    iframe.style.width = `${width}px`;
  }

  function stopLocalVideo(video) {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      // Older browser engines can reject load() while detaching a media element.
    }
  }

  function isCurrent(token) {
    return token === generation && enabled && !terminal;
  }

  function pageCanPlayPreview() {
    return document.visibilityState !== 'hidden'
      && !document.documentElement.classList.contains('sleekfin-details-concealed')
      && dom.isVisible(page);
  }

  function removeLayer() {
    const activePlayer = player;
    player = null;
    window.removeEventListener('resize', sizeYouTubeFrame);
    try {
      activePlayer?.destroy();
    } catch {
      // A detached YouTube iframe can throw while Jellyfin is replacing its page.
    }
    if (layer) {
      stopLocalVideo(layer.querySelector('video'));
      clearChildren(layer);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      layer = null;
    }
  }

  function clearAttempt() {
    generation += 1;
    window.clearTimeout(startTimer);
    window.clearTimeout(attemptTimer);
    startTimer = 0;
    attemptTimer = 0;
    sourceType = '';
    removeLayer();
    return generation;
  }

  function finish(token) {
    if (token !== generation) return;
    terminal = true;
    clearAttempt();
  }

  function createLayer() {
    layer = document.createElement('div');
    layer.className = 'sleekfin-details-trailer';
    layer.setAttribute('data-playing', 'false');
    nativeBackdrop.appendChild(layer);
    return layer;
  }

  function markPlaying(token) {
    if (!isCurrent(token)) return;
    if (!pageCanPlayPreview()) {
      finish(token);
      return;
    }
    window.clearTimeout(attemptTimer);
    attemptTimer = 0;
    if (layer) layer.setAttribute('data-playing', 'true');
  }

  function fallbackFromLocal(item, token) {
    if (!isCurrent(token) || sourceType !== 'local') return;
    sourceType = 'youtube';
    window.clearTimeout(attemptTimer);
    attemptTimer = 0;
    removeLayer();
    const videoId = validRemoteTrailer(item);
    if (!videoId) {
      finish(token);
      return;
    }
    attemptTimer = window.setTimeout(() => finish(token), START_TIMEOUT_MS);
    playYouTube(videoId, token);
  }

  function playLocal(url, item, token) {
    sourceType = 'local';
    const video = document.createElement('video');
    video.autoplay = true;
    video.controls = false;
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.addEventListener('playing', () => markPlaying(token));
    video.addEventListener('ended', () => finish(token));
    video.addEventListener('error', () => fallbackFromLocal(item, token));
    createLayer().appendChild(video);
    video.src = url;
    try {
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          if (isCurrent(token) && layer?.getAttribute('data-playing') !== 'true') fallbackFromLocal(item, token);
        });
      }
    } catch {
      fallbackFromLocal(item, token);
    }
  }

  function playYouTube(videoId, token) {
    sourceType = 'youtube';
    loadYouTubeApi().then((api) => {
      if (!isCurrent(token)) return;
      const target = document.createElement('div');
      createLayer().appendChild(target);
      try {
        player = new api.Player(target, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            mute: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady(event) {
              if (!isCurrent(token)) return;
              try {
                event.target.mute();
                event.target.setVolume(0);
                sizeYouTubeFrame();
                event.target.playVideo();
              } catch {
                finish(token);
              }
            },
            onStateChange(event) {
              if (!isCurrent(token)) return;
              if (event.data === api.PlayerState.PLAYING) markPlaying(token);
              else if (event.data === api.PlayerState.ENDED) finish(token);
            },
            onError() {
              finish(token);
            },
          },
        });
        player.getIframe()?.setAttribute('tabindex', '-1');
        window.addEventListener('resize', sizeYouTubeFrame);
      } catch {
        finish(token);
      }
    }).catch(() => finish(token));
  }

  function validRemoteTrailer(item) {
    const remote = Array.isArray(item.RemoteTrailers) ? item.RemoteTrailers : [];
    return remote.map((trailer) => youtubeVideoId(trailer?.Url)).find(Boolean) || '';
  }

  function playRemote(item, token) {
    const videoId = validRemoteTrailer(item);
    if (!videoId || !isCurrent(token)) {
      finish(token);
      return;
    }
    playYouTube(videoId, token);
  }

  function startAttempt(token) {
    if (!isCurrent(token)) return;
    if (!pageCanPlayPreview()) {
      startTimer = window.setTimeout(() => startAttempt(token), 250);
      return;
    }

    const item = currentItem;
    const client = window.ApiClient;
    if (!item || !client) {
      finish(token);
      return;
    }

    const itemServerId = String(item.ServerId || '').toLowerCase();
    if (itemServerId && typeof client.serverId === 'function' && String(client.serverId()).toLowerCase() !== itemServerId) {
      finish(token);
      return;
    }

    attemptTimer = window.setTimeout(() => {
      if (sourceType === 'local') fallbackFromLocal(item, token);
      else finish(token);
    }, START_TIMEOUT_MS);

    if (Number(item.LocalTrailerCount) > 0 && typeof client.getLocalTrailers === 'function') {
      Promise.resolve()
        .then(() => client.getLocalTrailers(client.getCurrentUserId(), item.Id))
        .then((trailers) => {
          if (!isCurrent(token)) return;
          const url = (Array.isArray(trailers) ? trailers : []).map((trailer) => localTrailerUrl(client, trailer)).find(Boolean);
          if (url) playLocal(url, item, token);
          else playRemote(item, token);
        })
        .catch(() => playRemote(item, token));
      return;
    }

    playRemote(item, token);
  }

  function schedule() {
    if (terminal || !enabled || !currentItem) return;
    const token = clearAttempt();
    terminal = false;
    startTimer = window.setTimeout(() => startAttempt(token), START_DELAY_MS);
  }

  function update(item, nextEnabled) {
    const itemChanged = currentItem?.Id !== item?.Id || currentItem?.ServerId !== item?.ServerId;
    const wasEnabled = enabled;
    if (itemChanged) {
      clearAttempt();
      terminal = false;
      currentItem = item;
    }

    enabled = nextEnabled === true;
    if (!enabled) {
      if (wasEnabled || startTimer || attemptTimer || layer) clearAttempt();
      terminal = false;
      return;
    }

    if (!wasEnabled || itemChanged) schedule();
  }

  function onActionClick(event) {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const actionElement = target?.closest('.btnPlay, .btnReplay, .btnPlayTrailer, [data-action]');
    if (!actionElement || !actions.contains(actionElement)) return;
    const action = String(actionElement.dataset.action || '').toLowerCase();
    if (actionElement.matches('.btnPlay, .btnReplay, .btnPlayTrailer') || ['play', 'resume', 'playtrailer', 'play-trailer', 'trailer'].includes(action)) {
      finish(generation);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden' && enabled && !terminal) finish(generation);
  }

  page.addEventListener('click', onActionClick, true);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    destroy() {
      enabled = false;
      terminal = true;
      clearAttempt();
      page.removeEventListener('click', onActionClick, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      currentItem = null;
    },
    update,
  };
}
