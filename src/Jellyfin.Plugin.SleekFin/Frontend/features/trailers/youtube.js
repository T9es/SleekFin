const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
const YOUTUBE_SHORT_HOSTS = ['youtu.be', 'www.youtu.be'];
const YOUTUBE_EMBED_HOSTS = ['youtube-nocookie.com', 'www.youtube-nocookie.com'];
let apiPromise = null;

export function youtubeVideoId(value) {
  if (typeof value !== 'string' || !value) return '';

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return '';

    const hostname = url.hostname.toLowerCase();
    let id = '';
    if (YOUTUBE_SHORT_HOSTS.indexOf(hostname) >= 0) {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (YOUTUBE_HOSTS.indexOf(hostname) >= 0) {
      id = url.pathname === '/watch'
        ? url.searchParams.get('v') || ''
        : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
    } else if (YOUTUBE_EMBED_HOSTS.indexOf(hostname) >= 0) {
      id = url.pathname.match(/^\/embed\/([^/]+)/)?.[1] || '';
    }
    return YOUTUBE_ID.test(id) ? id : '';
  } catch {
    return '';
  }
}

function isYouTubeApiScript(script) {
  try {
    const url = new URL(script.src, document.baseURI);
    return (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') && url.pathname === '/iframe_api';
  } catch {
    return false;
  }
}

export function loadYouTubeApi() {
  if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let poll = 0;
    let script = null;
    const deadline = Date.now() + 12000;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      if (error && script?.parentNode) script.parentNode.removeChild(script);
      if (error) reject(error);
      else resolve(window.YT);
    };

    if (!Array.from(document.querySelectorAll('script[src]')).some(isYouTubeApiScript)) {
      script = document.createElement('script');
      script.src = YOUTUBE_API_URL;
      script.async = true;
      script.onerror = () => finish(new Error('YouTube iframe API failed to load'));
      (document.head || document.documentElement).appendChild(script);
    }

    poll = window.setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') finish();
      else if (Date.now() >= deadline) finish(new Error('YouTube iframe API timed out'));
    }, 100);
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });

  return apiPromise;
}
