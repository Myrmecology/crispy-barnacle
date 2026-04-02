/**
 * UX LAB — app.js
 * ─────────────────────────────────────────────────────────────
 * The main controller. Ties together HeatmapRenderer and
 * SessionReplay, manages tab switching, sidebar controls,
 * backend communication, and live stat updates.
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const API = 'http://localhost:8000';

  // ── Module instances ─────────────────────────────────────────
  const heatmap = new HeatmapRenderer('heatmapCanvas');
  const replay  = new SessionReplay();

  // ── DOM references ───────────────────────────────────────────
  const pageSelect       = document.getElementById('pageSelect');
  const loadHeatmapBtn   = document.getElementById('loadHeatmapBtn');
  const showClicks       = document.getElementById('showClicks');
  const showMoves        = document.getElementById('showMoves');
  const showScroll       = document.getElementById('showScroll');
  const intensityRange   = document.getElementById('intensityRange');
  const canvasEl         = document.getElementById('heatmapCanvas');
  const canvasPlaceholder= document.getElementById('canvasPlaceholder');
  const scrollDepthEl    = document.getElementById('scrollDepth');
  const scrollFill       = document.getElementById('scrollFill');
  const heatmapMeta      = document.getElementById('heatmapMeta');
  const heatmapView      = document.getElementById('heatmapView');
  const replayView       = document.getElementById('replayView');
  const heatmapControls  = document.getElementById('heatmapControls');
  const replayControls   = document.getElementById('replayControls');
  const backendStatus    = document.getElementById('backendStatus');
  const statusDot        = backendStatus.querySelector('.topbar__dot');
  const statusText       = backendStatus.querySelector('.topbar__status-text');

  // ── Stat elements ────────────────────────────────────────────
  const totalEvents   = document.getElementById('totalEvents');
  const totalSessions = document.getElementById('totalSessions');
  const totalPages    = document.getElementById('totalPages');
  const totalClicks   = document.getElementById('totalClicks');

  // ── State ────────────────────────────────────────────────────
  let currentPageEvents = [];
  let currentTab        = 'heatmap';

  // ────────────────────────────────────────────────────────────
  //  BACKEND STATUS CHECK
  //  Pings /status on load and every 15 seconds.
  //  Updates the top bar indicator dot accordingly.
  // ────────────────────────────────────────────────────────────

  async function checkBackend() {
    try {
      const res  = await fetch(`${API}/status`);
      const data = await res.json();

      // Online
      statusDot.className        = 'topbar__dot topbar__dot--online';
      statusText.textContent     = 'Backend Online';
      totalEvents.textContent    = data.events   ?? '0';
      totalSessions.textContent  = data.sessions ?? '0';

    } catch (err) {
      // Offline
      statusDot.className    = 'topbar__dot topbar__dot--offline';
      statusText.textContent = 'Backend Offline';
      totalEvents.textContent    = '—';
      totalSessions.textContent  = '—';
    }
  }

  checkBackend();
  setInterval(checkBackend, 15000);

  // ────────────────────────────────────────────────────────────
  //  LOAD PAGES
  //  Populates the page selector dropdown with all tracked pages.
  // ────────────────────────────────────────────────────────────

  async function loadPages() {
    try {
      const res  = await fetch(`${API}/pages`);
      const data = await res.json();
      const pages = data.pages || [];

      totalPages.textContent = pages.length;

      if (pages.length === 0) {
        pageSelect.innerHTML = '<option value="">No pages tracked yet</option>';
        return;
      }

      pageSelect.innerHTML = '<option value="">Select a page...</option>';
      pages.forEach(p => {
        const opt   = document.createElement('option');
        opt.value   = p.page_key;
        opt.textContent = `${p.page_key}  (${p.event_count} events)`;
        pageSelect.appendChild(opt);
      });

    } catch (err) {
      pageSelect.innerHTML = '<option value="">Backend offline</option>';
    }
  }

  loadPages();

  // ────────────────────────────────────────────────────────────
  //  RENDER HEATMAP
  //  Fetches event data for the selected page, feeds it to
  //  HeatmapRenderer, and updates all supporting UI.
  // ────────────────────────────────────────────────────────────

  async function renderHeatmap() {
    const pageKey = pageSelect.value;
    if (!pageKey) {
      heatmapMeta.textContent = 'Please select a page first.';
      return;
    }

    loadHeatmapBtn.textContent = '◈ Loading...';
    loadHeatmapBtn.disabled    = true;

    try {
      // Fetch heatmap points (normalized coordinates)
      const hmRes  = await fetch(`${API}/heatmap/${pageKey}`);
      const hmData = await hmRes.json();

      // Fetch raw events for scroll analysis
      const evRes  = await fetch(`${API}/events/${pageKey}`);
      const evData = await evRes.json();

      currentPageEvents = evData.events || [];
      const points      = hmData.points || [];

      if (points.length === 0) {
        heatmapMeta.textContent = 'No data for this page yet. Browse the demo site first.';
        loadHeatmapBtn.textContent = '◈ Render Heatmap';
        loadHeatmapBtn.disabled    = false;
        return;
      }

      // Show canvas, hide placeholder
      canvasEl.style.display          = 'block';
      canvasPlaceholder.style.display = 'none';

      // Resize canvas to fill container
      heatmap.resize();

      // Load filtered points based on toggle state
      heatmap.loadPoints(
        points,
        showClicks.checked,
        showMoves.checked
      );

      // Render with current intensity setting
      heatmap.render(parseInt(intensityRange.value));

      // Update meta info
      const clickCount  = HeatmapRenderer.countClicks(currentPageEvents);
      const scrollDepth = HeatmapRenderer.analyzeScrollDepth(currentPageEvents);
      totalClicks.textContent = clickCount;

      heatmapMeta.textContent =
        `Page: ${pageKey}  ·  ` +
        `${points.length} data points  ·  ` +
        `${clickCount} clicks  ·  ` +
        `Avg scroll depth: ${scrollDepth}%`;

      // Show scroll depth bar if enabled
      if (showScroll.checked) {
        scrollDepthEl.style.display = 'block';
        setTimeout(() => {
          scrollFill.style.width = `${scrollDepth}%`;
        }, 100);
      } else {
        scrollDepthEl.style.display = 'none';
      }

    } catch (err) {
      heatmapMeta.textContent = 'Error loading data. Is the backend running?';
      console.error('[UX LAB] Heatmap error:', err);
    }

    loadHeatmapBtn.textContent = '◈ Render Heatmap';
    loadHeatmapBtn.disabled    = false;
  }

  // ────────────────────────────────────────────────────────────
  //  TAB SWITCHING
  //  Toggles between Heatmap and Session Replay views.
  //  Cleans up the inactive view to free resources.
  // ────────────────────────────────────────────────────────────

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === currentTab) return;

      currentTab = tab;

      // Update active tab button
      document.querySelectorAll('.tab-btn')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (tab === 'heatmap') {
        heatmapView.style.display    = 'flex';
        replayView.style.display     = 'none';
        heatmapControls.style.display = 'block';
        replayControls.style.display  = 'none';
        // Reload pages in case new ones were tracked
        loadPages();

      } else if (tab === 'replay') {
        heatmapView.style.display    = 'none';
        replayView.style.display     = 'flex';
        heatmapControls.style.display = 'none';
        replayControls.style.display  = 'block';
        // Load available sessions
        replay.loadSessions();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  //  HEATMAP CONTROLS
  // ────────────────────────────────────────────────────────────

  // Render button
  loadHeatmapBtn.addEventListener('click', renderHeatmap);

  // Re-render when toggles change (if data already loaded)
  [showClicks, showMoves].forEach(toggle => {
    toggle.addEventListener('change', () => {
      if (currentPageEvents.length > 0) renderHeatmap();
    });
  });

  // Scroll depth toggle
  showScroll.addEventListener('change', () => {
    if (currentPageEvents.length === 0) return;
    if (showScroll.checked) {
      const depth = HeatmapRenderer.analyzeScrollDepth(currentPageEvents);
      scrollDepthEl.style.display = 'block';
      setTimeout(() => { scrollFill.style.width = `${depth}%`; }, 100);
    } else {
      scrollDepthEl.style.display = 'none';
    }
  });

  // Intensity slider — re-render on release
  intensityRange.addEventListener('change', () => {
    if (currentPageEvents.length > 0) renderHeatmap();
  });

  // ────────────────────────────────────────────────────────────
  //  CANVAS RESIZE HANDLER
  //  Re-renders the heatmap if the window is resized so the
  //  overlay always matches the canvas dimensions exactly.
  // ────────────────────────────────────────────────────────────

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentPageEvents.length > 0 && currentTab === 'heatmap') {
        renderHeatmap();
      }
    }, 300);
  });

  // ────────────────────────────────────────────────────────────
  //  KEYBOARD SHORTCUTS
  //  Small detail that looks great during a live demo.
  // ────────────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    // R — render heatmap
    if (e.key === 'r' && currentTab === 'heatmap') {
      renderHeatmap();
    }
    // Space — play/pause replay
    if (e.key === ' ' && currentTab === 'replay') {
      e.preventDefault();
      document.getElementById('replayPlayBtn')?.click();
    }
    // 1 — switch to heatmap tab
    if (e.key === '1') {
      document.querySelector('[data-tab="heatmap"]')?.click();
    }
    // 2 — switch to replay tab
    if (e.key === '2') {
      document.querySelector('[data-tab="replay"]')?.click();
    }
  });

  console.debug('[UX LAB] Dashboard initialized');

})();