import { loadYouTubeApi, youtubeVideoId } from './youtube.js';

const PLAYER_ID = 'sleekfintrailerplayer';
const START_TIMEOUT_MS = 15000;
let playbackManager = null;
let activeArm = null;
let activeSession = null;
let activePlayer = null;

function routeDetails() {
  const target = (window.location.hash.slice(1) || `${window.location.pathname}${window.location.search}`).replace(/^!+/, '');
  const separator = target.search(/[?&]/);
  const path = (separator < 0 ? target : target.slice(0, separator)).replace(/^[!/]+/, '/');
  if (!/(^|\/)details\/?$/.test(path)) return null;
  const parameters = new URLSearchParams(separator < 0 ? '' : target.slice(separator + 1));
  return { id: parameters.get('id') || '', serverId: parameters.get('serverId') || '' };
}

function currentRoute() {
  return window.location.hash || `${window.location.pathname}${window.location.search}`;
}

function isLocalPlayback(manager) {
  try {
    return manager?.getPlayerInfo?.()?.isLocalPlayer !== false;
  } catch {
    return false;
  }
}

function armIsActive(arm) {
  const route = routeDetails();
  return Boolean(arm && arm === activeArm
    && arm.page?.isConnected
    && arm.page.id === 'itemDetailPage'
    && arm.page.dataset.sleekfinDetails === 'true'
    && !arm.page.classList.contains('hide')
    && document.documentElement.classList.contains('sleekfin-details-mounted')
    && !document.documentElement.classList.contains('sleekfin-details-concealed')
    && route
    && arm.route === currentRoute()
    && (!route.id || route.id === arm.itemId)
    && (!route.serverId || !arm.serverId || route.serverId.toLowerCase() === arm.serverId.toLowerCase()));
}

function clearArm(page) {
  if (!page || activeArm?.page === page) activeArm = null;
}

function clearPlayerSession(owner) {
  if (!owner || activeSession?.owner === owner) activeSession = null;
  if (owner) owner._session = null;
}

function clearTrailerArm(page) {
  clearArm(page);
  if (!page || activeSession?.page === page) {
    const owner = activeSession?.owner || activePlayer;
    clearPlayerSession(owner);
    if (owner?._currentSrc) owner.playbackManager?.stop?.(owner);
  }
}

function armTrailers(item, page) {
  clearArm();
  const route = routeDetails();
  if (!item?.Id || !page?.isConnected || !route || (route.id && route.id !== String(item.Id))) return false;

  if (!isLocalPlayback(playbackManager)) return false;

  const trailers = Array.isArray(item.RemoteTrailers) ? item.RemoteTrailers : [];
  const urls = trailers.map((trailer) => trailer?.Url);
  if (!urls.length || urls.some((url) => typeof url !== 'string' || !youtubeVideoId(url))) return false;

  activeArm = {
    itemId: String(item.Id),
    page,
    route: currentRoute(),
    serverId: String(item.ServerId || route.serverId || ''),
    urls,
  };
  return true;
}

function sessionIsActive(session) {
  const route = routeDetails();
  return Boolean(session
    && session === activeSession
    && route
    && session.route === currentRoute()
    && (!route.id || route.id === session.itemId)
    && (!route.serverId || !session.serverId || route.serverId.toLowerCase() === session.serverId.toLowerCase()));
}

class SleekFinTrailerPlayer {
  constructor({ events, playbackManager: manager, inputManager, globalize }) {
    this.name = 'SleekFin Trailer Player';
    this.type = 'mediaplayer';
    this.id = PLAYER_ID;
    this.priority = 0;
    this.isLocalPlayer = true;
    this.events = events;
    this.playbackManager = manager;
    this.inputManager = inputManager;
    this.globalize = globalize;
    this._currentSrc = null;
    this._generation = 0;
    this._player = null;
    this._viewer = null;
    this._frame = null;
    this._backButton = null;
    this._startTimer = 0;
    this._timeTimer = 0;
    this._paused = true;
    this._volume = 100;
    this._muted = false;
    this._seekMilliseconds = null;
    this._lastCurrentTime = 0;
    this._lastDuration = null;
    this._session = null;
    this._onRouteChange = this._handleRouteChange.bind(this);
    this._onBackCommand = this._handleBackCommand.bind(this);
    this._onBackClick = this._handleBackClick.bind(this);
    this._onPlaybackStop = this._handlePlaybackStop.bind(this);
    this._onPlaybackStart = this._handlePlaybackStart.bind(this);
    playbackManager = manager;
    activePlayer = this;
    this.events?.on?.(manager, 'playbackstop', this._onPlaybackStop);
    this.events?.on?.(manager, 'playbackstart', this._onPlaybackStart);
  }

  canPlayMediaType(mediaType) {
    return String(mediaType || '').toLowerCase() === 'video';
  }

  canPlayItem() {
    return false;
  }

  canPlayUrl(url) {
    const session = activeSession;
    const scope = sessionIsActive(session) ? session : activeArm;
    const scopeIsActive = scope === session ? sessionIsActive(scope) : armIsActive(scope);
    if (!scopeIsActive || !youtubeVideoId(url) || scope.urls.indexOf(url) < 0) {
      if (scope && !scopeIsActive) clearArm();
      return false;
    }

    if (!isLocalPlayback(this.playbackManager)) {
      clearArm();
      return false;
    }
    return true;
  }

  play(options) {
    const videoId = youtubeVideoId(options?.url);
    const session = sessionIsActive(activeSession) ? activeSession : activeArm;
    const itemId = options?.item?.Id;
    if (!videoId || !session || (itemId && String(itemId) !== session.itemId) || session.urls.indexOf(options.url) < 0 || (session === activeArm && !armIsActive(session)) || !isLocalPlayback(this.playbackManager)) return Promise.reject('.NETWORK_ERROR');

    this._generation += 1;
    this._removeViewer();
    this._currentSrc = null;
    const token = ++this._generation;
    this._currentSrc = options.url;
    this._route = currentRoute();
    this._session = { ...session, owner: this, page: session.page, route: currentRoute(), urls: session.urls.slice() };
    activeSession = this._session;
    activeArm = null;
    this._paused = true;
    this._seekMilliseconds = null;
    this._lastCurrentTime = 0;
    this._lastDuration = null;
    this._createViewer();
    this._startTimer = window.setTimeout(() => this._fail(token), START_TIMEOUT_MS);
    loadYouTubeApi()
      .then((api) => {
        if (!this._isCurrent(token)) return;
        try {
          this._player = new api.Player(this._frame, {
            height: this._frame.clientHeight,
            width: this._frame.clientWidth,
            videoId,
            playerVars: { autoplay: 1, controls: 1, enablejsapi: 1, fs: 1, playsinline: 1, rel: 0 },
            events: {
              onReady: (event) => this._handleReady(event, token),
              onStateChange: (event) => this._handleStateChange(event, api, token),
              onError: () => this._fail(token),
            },
          });
        } catch {
          this._fail(token);
        }
      })
      .catch(() => this._fail(token));

    // Resolve after the viewer exists so a user can stop playback while the shared iframe API loads.
    return Promise.resolve();
  }

  stop(destroyPlayer) {
    const src = this._currentSrc;
    if (src) {
      this._generation += 1;
      this._snapshotPlaybackState();
      this._removeViewer();
      this.events?.trigger?.(this, 'stopped', [{ src }]);
      this._currentSrc = null;
      this._paused = true;
    }
    if (destroyPlayer) {
      clearArm();
      clearPlayerSession(this);
      this.destroy();
    }
    return Promise.resolve();
  }

  destroy() {
    this._generation += 1;
    this._snapshotPlaybackState();
    this._removeViewer();
    this._currentSrc = null;
    this._paused = true;
    clearArm();
    clearPlayerSession(this);
  }

  getDeviceProfile() {
    return Promise.resolve({});
  }

  currentSrc() {
    return this._currentSrc;
  }

  currentTime(value) {
    if (value != null) {
      this._seekMilliseconds = Math.max(0, Number(value) || 0);
      try {
        this._player?.seekTo(this._seekMilliseconds / 1000, true);
      } catch {
        // The queued seek is applied after the iframe reports ready.
      }
      return;
    }
    try {
      return this._player ? this._player.getCurrentTime() * 1000 : this._lastCurrentTime;
    } catch {
      return 0;
    }
  }

  duration() {
    try {
      return this._player ? this._player.getDuration() * 1000 : this._lastDuration;
    } catch {
      return null;
    }
  }

  pause() {
    try {
      this._player?.pauseVideo();
    } catch {
      return;
    }
  }

  unpause() {
    try {
      this._player?.playVideo();
    } catch {
      return;
    }
  }

  paused() {
    return this._paused;
  }

  volume(value) {
    if (value != null) this.setVolume(value);
    else return this.getVolume();
  }

  setVolume(value) {
    this._volume = Math.max(0, Math.min(100, Number(value) || 0));
    try {
      this._player?.setVolume(this._volume);
    } catch {
      return;
    }
    this.events?.trigger?.(this, 'volumechange');
  }

  getVolume() {
    try {
      return this._player ? this._player.getVolume() : this._volume;
    } catch {
      return this._volume;
    }
  }

  setMute(muted) {
    this._muted = muted === true;
    try {
      if (this._muted) this._player?.mute();
      else this._player?.unMute();
    } catch {
      return;
    }
    this.events?.trigger?.(this, 'volumechange');
  }

  isMuted() {
    try {
      return this._player ? this._player.isMuted() : this._muted;
    } catch {
      return this._muted;
    }
  }

  _isCurrent(token) {
    return token === this._generation && Boolean(this._currentSrc) && Boolean(this._viewer?.isConnected) && sessionIsActive(this._session);
  }

  _createViewer() {
    const viewer = document.createElement('div');
    viewer.className = 'sleekfin-trailer-player';
    const frame = document.createElement('div');
    frame.className = 'sleekfin-trailer-player__frame';
    const target = document.createElement('div');
    target.className = 'sleekfin-trailer-player__target';
    frame.appendChild(target);
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('is', 'paper-icon-button-light');
    button.className = 'sleekfin-trailer-player__back';
    const label = this.globalize?.translate?.('ButtonBack') || 'Back';
    button.title = label;
    button.setAttribute('aria-label', label);
    const icon = document.createElement('span');
    icon.className = 'material-icons arrow_back';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    const toolbar = document.createElement('div');
    toolbar.className = 'sleekfin-trailer-player__toolbar';
    toolbar.appendChild(button);
    const stage = document.createElement('div');
    stage.className = 'sleekfin-trailer-player__stage';
    stage.appendChild(frame);
    viewer.append(toolbar, stage);
    document.body.appendChild(viewer);
    this._viewer = viewer;
    this._frame = target;
    this._backButton = button;
    button.addEventListener('click', this._onBackClick);
    this.inputManager?.on?.(viewer, this._onBackCommand);
    window.addEventListener('hashchange', this._onRouteChange);
    window.addEventListener('popstate', this._onRouteChange);
    window.addEventListener('pagehide', this._onRouteChange);
    try {
      button.focus({ preventScroll: true });
    } catch {
      button.focus();
    }
  }

  _removeViewer() {
    window.clearTimeout(this._startTimer);
    window.clearInterval(this._timeTimer);
    this._startTimer = 0;
    this._timeTimer = 0;
    window.removeEventListener('hashchange', this._onRouteChange);
    window.removeEventListener('popstate', this._onRouteChange);
    window.removeEventListener('pagehide', this._onRouteChange);
    if (this._viewer) this.inputManager?.off?.(this._viewer, this._onBackCommand);
    this._backButton?.removeEventListener('click', this._onBackClick);
    const player = this._player;
    this._player = null;
    try {
      player?.stopVideo();
      player?.destroy();
    } catch {
      // The iframe API can throw while its document is navigating away.
    }
    this._viewer?.remove();
    this._viewer = null;
    this._frame = null;
    this._backButton = null;
  }

  _handleReady(event, token) {
    if (!this._isCurrent(token)) return;
    window.clearTimeout(this._startTimer);
    this._startTimer = 0;
    try {
      if (this._seekMilliseconds != null) event.target.seekTo(this._seekMilliseconds / 1000, true);
      event.target.setVolume(this._volume);
      if (this._muted) event.target.mute();
      else event.target.unMute();
      event.target.playVideo();
    } catch {
      this._fail(token);
    }
  }

  _handleStateChange(event, api, token) {
    if (!this._isCurrent(token)) return;
    if (event.data === api.PlayerState.PLAYING) {
      this._paused = false;
      if (!this._timeTimer) this._timeTimer = window.setInterval(() => this.events?.trigger?.(this, 'timeupdate'), 500);
      this.events?.trigger?.(this, 'unpause');
    } else if (event.data === api.PlayerState.PAUSED) {
      this._paused = true;
      window.clearInterval(this._timeTimer);
      this._timeTimer = 0;
      this.events?.trigger?.(this, 'pause');
    } else if (event.data === api.PlayerState.ENDED) {
      this._finishNaturally(token);
    }
  }

  _finishNaturally(token) {
    if (!this._isCurrent(token)) return;
    const src = this._currentSrc;
    this._generation += 1;
    this._snapshotPlaybackState();
    this._removeViewer();
    this.events?.trigger?.(this, 'stopped', [{ src }]);
    this._currentSrc = null;
    this._paused = true;
  }

  _fail(token) {
    if (!this._isCurrent(token)) return;
    this._generation += 1;
    this._snapshotPlaybackState();
    this._removeViewer();
    clearArm();
    clearPlayerSession(this);
    this.events?.trigger?.(this, 'stopped', ['.NETWORK_ERROR']);
    this._currentSrc = null;
    this._paused = true;
  }

  _handleRouteChange(event) {
    if (this._currentSrc && (event.type === 'pagehide' || currentRoute() !== this._route)) this.playbackManager?.stop?.(this);
  }

  _handleBackCommand(event) {
    if (event.detail?.command !== 'back') return;
    event.preventDefault();
    this.playbackManager?.stop?.(this);
  }

  _handleBackClick() {
    this.playbackManager?.stop?.(this);
  }

  _handlePlaybackStop(event, info) {
    if (info?.player !== this) return;
    const nextUrl = info?.nextItem?.Url;
    if (nextUrl && activeSession?.owner === this && activeSession.urls.indexOf(nextUrl) >= 0 && sessionIsActive(activeSession)) return;
    clearArm();
    clearPlayerSession(this);
  }

  _handlePlaybackStart(event, player) {
    if (player !== this) {
      clearArm();
      clearPlayerSession(this);
    }
  }

  _snapshotPlaybackState() {
    try {
      if (this._player) {
        this._lastCurrentTime = this._player.getCurrentTime() * 1000;
        this._lastDuration = this._player.getDuration() * 1000;
      }
    } catch {
      // The YouTube iframe can become unavailable while its document is navigating away.
    }
  }
}

async function SleekFin() {
  return SleekFinTrailerPlayer;
}

SleekFin.armTrailers = armTrailers;
SleekFin.clearTrailerArm = clearTrailerArm;
SleekFin.isSleekFinTrailerPlayer = true;
if (!window.SleekFin) window.SleekFin = SleekFin;
