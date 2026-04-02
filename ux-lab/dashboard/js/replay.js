/**
 * UX LAB — replay.js
 * ─────────────────────────────────────────────────────────────
 * Handles session replay functionality using rrweb-player.
 * Fetches recorded sessions from the FastAPI backend and
 * renders them as a full DOM playback — exactly like FullStory.
 * ─────────────────────────────────────────────────────────────
 */

class SessionReplay {
  constructor() {
    this.player          = null;
    this.currentSession  = null;
    this.sessions        = [];
    this.isPlaying       = false;

    // DOM references
    this.playerContainer = document.getElementById('replayPlayer');
    this.placeholder     = document.getElementById('replayPlaceholder');
    this.controlBar      = document.getElementById('replayControlBar');
    this.playBtn         = document.getElementById('replayPlayBtn');
    this.progressFill    = document.getElementById('replayProgressFill');
    this.timeDisplay     = document.getElementById('replayTime');
    this.metaDisplay     = document.getElementById('replayMeta');
    this.sessionList     = document.getElementById('sessionList');
  }

  // ────────────────────────────────────────────────────────────
  //  LOAD ALL SESSIONS
  //  Fetches session metadata from the backend and
  //  populates the sidebar session list.
  // ────────────────────────────────────────────────────────────

  async loadSessions() {
    try {
      const res      = await fetch('http://localhost:8000/sessions');
      const data     = await res.json();
      this.sessions  = data.sessions || [];
      this._renderSessionList();
    } catch (err) {
      console.error('[UX LAB] Could not load sessions:', err);
      this.sessionList.innerHTML = `
        <p class="session-list__empty">
          Backend offline.<br/>Start the FastAPI server first.
        </p>`;
    }
  }

  // ────────────────────────────────────────────────────────────
  //  RENDER SESSION LIST
  //  Builds the sidebar list of clickable session cards.
  // ────────────────────────────────────────────────────────────

  _renderSessionList() {
    if (this.sessions.length === 0) {
      this.sessionList.innerHTML = `
        <p class="session-list__empty">
          No sessions recorded yet.<br/>
          Browse the demo site first.
        </p>`;
      return;
    }

    this.sessionList.innerHTML = '';

    this.sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'session-item';
      item.dataset.id = session.id;

      const duration = session.duration_ms
        ? this._formatDuration(session.duration_ms)
        : 'Unknown';

      const date = new Date(session.created_at).toLocaleString();
      const size = session.data_size_bytes
        ? `${Math.round(session.data_size_bytes / 1024)}kb`
        : '—';

      item.innerHTML = `
        <p class="session-item__page">${session.page_key}</p>
        <p class="session-item__meta">
          Duration: ${duration}<br/>
          Recorded: ${date}<br/>
          Size: ${size}
        </p>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.session-item')
          .forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        this.loadSession(session.id);
      });

      this.sessionList.appendChild(item);
    });
  }

  // ────────────────────────────────────────────────────────────
  //  LOAD ONE SESSION
  //  Fetches the full rrweb event stream for a session ID
  //  and initializes the rrweb-player.
  // ────────────────────────────────────────────────────────────

  async loadSession(sessionId) {
    try {
      this.metaDisplay.textContent = 'Loading session...';

      const res     = await fetch(`http://localhost:8000/sessions/${sessionId}`);
      const session = await res.json();

      if (!session || !session.rrweb_events || session.rrweb_events.length === 0) {
        this.metaDisplay.textContent = 'Session has no recorded events.';
        return;
      }

      this.currentSession = session;
      this._initPlayer(session);

    } catch (err) {
      console.error('[UX LAB] Could not load session:', err);
      this.metaDisplay.textContent = 'Error loading session.';
    }
  }

  // ────────────────────────────────────────────────────────────
  //  INIT PLAYER
  //  Creates an rrweb-player instance inside the replay panel.
  //  rrweb-player handles all DOM snapshot reconstruction
  //  and mutation replay internally.
  // ────────────────────────────────────────────────────────────

  _initPlayer(session) {
    // Clear previous player
    this.playerContainer.innerHTML = '';

    // Hide placeholder, show player
    this.placeholder.style.display     = 'none';
    this.playerContainer.style.display = 'block';
    this.controlBar.style.display      = 'flex';

    const duration = session.duration_ms || 0;

    // Update meta display
    this.metaDisplay.textContent =
      `Page: ${session.page_key}  ·  ` +
      `Duration: ${this._formatDuration(duration)}  ·  ` +
      `Events: ${session.rrweb_events.length}  ·  ` +
      `Screen: ${session.screen_w}×${session.screen_h}`;

    // Initialize rrweb-player
    // rrweb-player reconstructs the full DOM from the snapshot
    // and replays every mutation, scroll, and mouse movement.
    try {
      this.player = new rrwebPlayer({
        target: this.playerContainer,
        props: {
          events:        session.rrweb_events,
          width:         this.playerContainer.offsetWidth  || 800,
          height:        this.playerContainer.offsetHeight || 500,
          autoPlay:      false,
          showController: false,   // We use our own controls
          speedOption:   [1, 1.5, 2],
        },
      });

      this._bindPlayerEvents(duration);
      this.playBtn.textContent = '▶ Play';
      this.isPlaying = false;

    } catch (err) {
      console.error('[UX LAB] rrweb-player error:', err);
      this.metaDisplay.textContent = 'Could not initialize replay player.';
    }
  }

  // ────────────────────────────────────────────────────────────
  //  BIND PLAYER EVENTS
  //  Connects rrweb-player's internal timer to our custom
  //  progress bar and time display.
  // ────────────────────────────────────────────────────────────

  _bindPlayerEvents(totalDuration) {
    if (!this.player) return;

    // Poll player state every 250ms to update progress bar
    this._progressTimer = setInterval(() => {
      try {
        const state    = this.player.getMeta();
        const current  = state.currentTime || 0;
        const total    = state.totalTime   || totalDuration || 1;
        const pct      = Math.min((current / total) * 100, 100);

        this.progressFill.style.width = `${pct}%`;
        this.timeDisplay.textContent  = this._formatDuration(current);

        // Auto-stop at end
        if (pct >= 99.5) {
          this.isPlaying = false;
          this.playBtn.textContent = '↺ Replay';
          clearInterval(this._progressTimer);
        }
      } catch (e) {
        // Player not ready yet
      }
    }, 250);

    // Play/pause button
    this.playBtn.onclick = () => {
      if (!this.player) return;

      if (this.playBtn.textContent.includes('Replay')) {
        // Restart from beginning
        this.player.goto(0);
        this.player.play();
        this.isPlaying = true;
        this.playBtn.textContent = '⏸ Pause';
        this._restartProgressTimer(totalDuration);
        return;
      }

      if (this.isPlaying) {
        this.player.pause();
        this.isPlaying = false;
        this.playBtn.textContent = '▶ Play';
      } else {
        this.player.play();
        this.isPlaying = true;
        this.playBtn.textContent = '⏸ Pause';
      }
    };
  }

  // ────────────────────────────────────────────────────────────
  //  RESTART PROGRESS TIMER
  // ────────────────────────────────────────────────────────────

  _restartProgressTimer(totalDuration) {
    clearInterval(this._progressTimer);
    this.progressFill.style.width = '0%';
    this._bindPlayerEvents(totalDuration);
  }

  // ────────────────────────────────────────────────────────────
  //  CLEANUP
  //  Clears the player and resets the UI when switching tabs.
  // ────────────────────────────────────────────────────────────

  destroy() {
    clearInterval(this._progressTimer);
    if (this.player) {
      try { this.player.pause(); } catch(e) {}
      this.player = null;
    }
    this.playerContainer.innerHTML   = '';
    this.playerContainer.style.display = 'none';
    this.placeholder.style.display   = 'block';
    this.controlBar.style.display    = 'none';
    this.isPlaying = false;
  }

  // ────────────────────────────────────────────────────────────
  //  FORMAT DURATION
  //  Converts milliseconds to m:ss display format.
  // ────────────────────────────────────────────────────────────

  _formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins     = Math.floor(totalSec / 60);
    const secs     = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Export for use in app.js
window.SessionReplay = SessionReplay;