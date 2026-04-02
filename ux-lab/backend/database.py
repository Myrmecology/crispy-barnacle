import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path

from models import EventBatch, SessionCreate

# ── Database lives in the data/ folder, one level up from backend/ ──
DB_PATH = Path(__file__).parent.parent / "data" / "uxlab.db"


def get_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ────────────────────────────────────────────
#  INIT
# ────────────────────────────────────────────

def init_db():
    """Creates all tables if they don't exist yet."""
    conn = get_connection()
    cursor = conn.cursor()

    # Events table — every mouse move, click, scroll
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            page_key    TEXT    NOT NULL,
            event_type  TEXT    NOT NULL,
            x           REAL,
            y           REAL,
            scroll_pct  REAL,
            viewport_w  INTEGER,
            viewport_h  INTEGER,
            timestamp   INTEGER NOT NULL,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    # Sessions table — full rrweb recordings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT    PRIMARY KEY,
            page_key    TEXT    NOT NULL,
            duration_ms INTEGER,
            events_json TEXT    NOT NULL,
            user_agent  TEXT,
            screen_w    INTEGER,
            screen_h    INTEGER,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    # Index for fast page-based lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_events_page
        ON events (page_key)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sessions_page
        ON sessions (page_key)
    """)

    conn.commit()
    conn.close()
    print(f"[DB] Initialized → {DB_PATH}")


# ────────────────────────────────────────────
#  EVENTS
# ────────────────────────────────────────────

def insert_events(batch: EventBatch):
    """Bulk inserts a batch of tracking events."""
    conn = get_connection()
    cursor = conn.cursor()

    rows = [
        (
            batch.session_id,
            batch.page_key,
            e.event_type,
            e.x,
            e.y,
            e.scroll_pct,
            e.viewport_w,
            e.viewport_h,
            e.timestamp,
        )
        for e in batch.events
    ]

    cursor.executemany("""
        INSERT INTO events
            (session_id, page_key, event_type, x, y,
             scroll_pct, viewport_w, viewport_h, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)

    conn.commit()
    conn.close()


def fetch_events(page_key: str):
    """Returns all raw events for a page as a list of dicts."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM events
        WHERE page_key = ?
        ORDER BY timestamp ASC
    """, (page_key,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def fetch_heatmap_data(page_key: str):
    """
    Returns click and mousemove coordinates for heatmap rendering.
    Normalizes x/y to percentages of the viewport for resolution independence.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            event_type,
            ROUND(CAST(x AS REAL) / viewport_w * 100, 2) AS x_pct,
            ROUND(CAST(y AS REAL) / viewport_h * 100, 2) AS y_pct,
            x, y, viewport_w, viewport_h
        FROM events
        WHERE page_key = ?
          AND event_type IN ('click', 'mousemove')
          AND x IS NOT NULL
          AND y IS NOT NULL
          AND viewport_w > 0
          AND viewport_h > 0
        ORDER BY timestamp ASC
    """, (page_key,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def fetch_pages():
    """Returns all unique page keys that have recorded events."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT page_key,
               COUNT(*) as event_count,
               MIN(created_at) as first_seen,
               MAX(created_at) as last_seen
        FROM events
        GROUP BY page_key
        ORDER BY last_seen DESC
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


# ────────────────────────────────────────────
#  SESSIONS
# ────────────────────────────────────────────

def insert_session(session: SessionCreate) -> str:
    """Stores a full rrweb session. Returns the new session ID."""
    session_id = str(uuid.uuid4())
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sessions
            (id, page_key, duration_ms, events_json,
             user_agent, screen_w, screen_h)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        session_id,
        session.page_key,
        session.duration_ms,
        json.dumps(session.rrweb_events),
        session.user_agent,
        session.screen_w,
        session.screen_h,
    ))
    conn.commit()
    conn.close()
    return session_id


def fetch_sessions():
    """Returns session metadata without the full rrweb event stream."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, page_key, duration_ms,
               user_agent, screen_w, screen_h, created_at,
               LENGTH(events_json) as data_size_bytes
        FROM sessions
        ORDER BY created_at DESC
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def fetch_session_by_id(session_id: str):
    """Returns one full session including the rrweb event stream."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM sessions WHERE id = ?
    """, (session_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    result = dict(row)
    result["rrweb_events"] = json.loads(result["events_json"])
    del result["events_json"]
    return result


# ────────────────────────────────────────────
#  STATS
# ────────────────────────────────────────────

def get_stats():
    """Returns total session and event counts for the status endpoint."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM events")
    events = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) as total FROM sessions")
    sessions = cursor.fetchone()["total"]
    conn.close()
    return {"events": events, "sessions": sessions}