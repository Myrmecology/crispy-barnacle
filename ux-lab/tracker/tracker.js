/**
 * UX LAB — tracker.js
 * ─────────────────────────────────────────────────────────────
 * Drop this script into any page to silently capture:
 *   • Mouse movements  (sampled every 50ms)
 *   • Clicks           (x, y, target element)
 *   • Scroll depth     (% of page scrolled)
 *   • Full session     (rrweb DOM recording)
 *
 * Batches are flushed to the FastAPI backend every 5 seconds.
 * Session is saved after 30 seconds and again on page exit.
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────
  const CONFIG = {
    apiBase:       'http://localhost:8000',
    flushInterval: 5000,       // ms between batch POSTs
    mouseSample:   50,         // ms between mousemove captures
    maxBatchSize:  200,        // flush early if batch grows large
    sessionDelay:  30000,      // guaranteed session save after 30s
  };

  // ── Session identity ─────────────────────────────────────────
  const SESSION_ID = _getOrCreateSessionId();
  const PAGE_KEY   = _slugify(window.location.pathname);
  const START_TIME = Date.now();

  // ── Event buffer ─────────────────────────────────────────────
  let _buffer       = [];
  let _rrwebEvents  = [];
  let _lastMouse    = 0;
  let _sessionSaved = false;

  // ────────────────────────────────────────────────────────────
  //  SESSION ID
  // ────────────────────────────────────────────────────────────

  function _getOrCreateSessionId() {
    let id = sessionStorage.getItem('uxlab_session_id');
    if (!id) {
      id = 'ux-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem('uxlab_session_id', id);
    }
    return id;
  }

  // ────────────────────────────────────────────────────────────
  //  PAGE KEY
  //  Converts a URL path into a clean slug
  //  e.g. "/demo-site/about.html" → "ux-lab-demo-site-about"
  // ────────────────────────────────────────────────────────────

  function _slugify(path) {
    return path
      .replace(/\.html?$/i, '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase() || 'home';
  }

  // ────────────────────────────────────────────────────────────
  //  HELPERS
  // ────────────────────────────────────────────────────────────

  function _scrollDepth() {
    const scrolled = window.scrollY;
    const total    = document.documentElement.scrollHeight - window.innerHeight;
    return total > 0 ? Math.round((scrolled / total) * 100 * 10) / 10 : 0;
  }

  function _push(event_type, extras = {}) {
    _buffer.push({
      event_type,
      x:          extras.x          ?? null,
      y:          extras.y          ?? null,
      scroll_pct: extras.scroll_pct ?? _scrollDepth(),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      timestamp:  Date.now(),
    });

    if (_buffer.length >= CONFIG.maxBatchSize) _flush();
  }

  // ────────────────────────────────────────────────────────────
  //  FLUSH  — sends buffered events to the backend
  // ────────────────────────────────────────────────────────────

  async function _flush() {
    if (_buffer.length === 0) return;

    const payload = {
      session_id: SESSION_ID,
      page_key:   PAGE_KEY,
      events:     [..._buffer],
    };
    _buffer = [];

    try {
      await fetch(`${CONFIG.apiBase}/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch (err) {
      console.debug('[UX LAB] Backend unreachable, events dropped.');
    }
  }

  // ────────────────────────────────────────────────────────────
  //  SAVE SESSION
  //  Called after 30 seconds AND on page exit.
  //  The _sessionSaved flag prevents duplicate saves.
  // ────────────────────────────────────────────────────────────

  async function _saveSession() {
    if (_sessionSaved)                  return;
    if (Date.now() - START_TIME < 3000) return;

    _sessionSaved = true;

    const payload = {
      page_key:     PAGE_KEY,
      duration_ms:  Date.now() - START_TIME,
      rrweb_events: _rrwebEvents,
      user_agent:   navigator.userAgent,
      screen_w:     screen.width,
      screen_h:     screen.height,
    };

    try {
      await fetch(`${CONFIG.apiBase}/sessions`, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
      });
      console.debug('[UX LAB] Session saved →', PAGE_KEY);
    } catch (err) {
      console.debug('[UX LAB] Session save failed:', err);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  EVENT LISTENERS
  // ────────────────────────────────────────────────────────────

  // Mouse movement — throttled to CONFIG.mouseSample ms
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - _lastMouse < CONFIG.mouseSample) return;
    _lastMouse = now;
    _push('mousemove', { x: e.clientX, y: e.clientY });
  });

  // Clicks — capture exact coordinates
  document.addEventListener('click', (e) => {
    _push('click', {
      x: e.clientX,
      y: e.clientY,
    });
  });

  // Scroll depth
  window.addEventListener('scroll', () => {
    _push('scroll', { scroll_pct: _scrollDepth() });
  }, { passive: true });

  // ────────────────────────────────────────────────────────────
  //  RRWEB SESSION RECORDING
  //  rrweb is loaded via CDN in the demo site pages.
  //  This waits for it to be available before starting.
  // ────────────────────────────────────────────────────────────

  function _startRrweb() {
    if (typeof rrweb === 'undefined') {
      setTimeout(_startRrweb, 500);
      return;
    }

    rrweb.record({
      emit(event) {
        _rrwebEvents.push(event);
      },
      sampling: {
        mousemove: 50,
        scroll:    150,
        input:     'last',
      },
    });

    console.debug('[UX LAB] rrweb recording started →', PAGE_KEY);
  }

  _startRrweb();

  // ────────────────────────────────────────────────────────────
  //  FLUSH TIMER — every 5 seconds
  // ────────────────────────────────────────────────────────────

  setInterval(_flush, CONFIG.flushInterval);

  // ────────────────────────────────────────────────────────────
  //  GUARANTEED SESSION SAVE — fires after 30 seconds
  //  This is the primary save mechanism. Ensures a session
  //  is always recorded regardless of how the user exits.
  // ────────────────────────────────────────────────────────────

  setTimeout(async () => {
    await _flush();
    await _saveSession();
  }, CONFIG.sessionDelay);

  // ────────────────────────────────────────────────────────────
  //  PAGE UNLOAD — backup save on exit
  //  Catches users who leave before the 30 second timer fires.
  // ────────────────────────────────────────────────────────────

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      await _flush();
      await _saveSession();
    }
  });

  window.addEventListener('pagehide', async () => {
    await _flush();
    await _saveSession();
  });

  // ────────────────────────────────────────────────────────────
  //  READY
  // ────────────────────────────────────────────────────────────

  console.debug(
    `[UX LAB] Tracker active\n` +
    `  Session  : ${SESSION_ID}\n` +
    `  Page     : ${PAGE_KEY}\n` +
    `  Backend  : ${CONFIG.apiBase}`
  );

})();