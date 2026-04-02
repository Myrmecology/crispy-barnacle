from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn

from database import init_db, get_stats
from models import EventBatch, SessionCreate

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    print("\n╔══════════════════════════════════════╗")
    print("║       UX LAB — Backend Online        ║")
    print("║   http://localhost:8000              ║")
    print("║   /docs  →  API Explorer             ║")
    print("╚══════════════════════════════════════╝\n")
    yield

app = FastAPI(
    title="UX Lab — Behavioral Analytics API",
    description="Tracks mouse movements, clicks, scroll depth and session replays.",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS: allow the demo site and dashboard to talk to this backend ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────────────────
#  STATUS
# ────────────────────────────────────────────

@app.get("/status", tags=["System"])
async def status():
    """Health check — also returns live session and event counts."""
    stats = get_stats()
    return {
        "status": "online",
        "sessions": stats["sessions"],
        "events":   stats["events"]
    }


# ────────────────────────────────────────────
#  EVENTS  (mouse moves, clicks, scrolls)
# ────────────────────────────────────────────

@app.post("/events", tags=["Tracking"])
async def receive_events(batch: EventBatch):
    """
    Receives a batch of tracking events from tracker.js.
    Each batch belongs to one session and one page URL.
    """
    from database import insert_events
    insert_events(batch)
    return {"received": len(batch.events)}


@app.get("/events/{page_key}", tags=["Tracking"])
async def get_events(page_key: str):
    """
    Returns all events for a given page key.
    page_key is a URL-safe slug of the page path.
    Example: 'home', 'about', 'contact'
    """
    from database import fetch_events
    events = fetch_events(page_key)
    return {"page": page_key, "count": len(events), "events": events}


# ────────────────────────────────────────────
#  HEATMAP  (aggregated click + move data)
# ────────────────────────────────────────────

@app.get("/heatmap/{page_key}", tags=["Heatmap"])
async def get_heatmap(page_key: str):
    """
    Returns aggregated click coordinates for heatmap rendering.
    Filters to click and mousemove events only.
    """
    from database import fetch_heatmap_data
    points = fetch_heatmap_data(page_key)
    return {"page": page_key, "points": points}


# ────────────────────────────────────────────
#  SESSIONS  (rrweb replay data)
# ────────────────────────────────────────────

@app.post("/sessions", tags=["Replay"])
async def create_session(session: SessionCreate):
    """
    Stores a full rrweb session recording.
    Called by tracker.js when the user leaves the page.
    """
    from database import insert_session
    session_id = insert_session(session)
    return {"session_id": session_id}


@app.get("/sessions", tags=["Replay"])
async def list_sessions():
    """Returns a list of all recorded sessions (metadata only)."""
    from database import fetch_sessions
    sessions = fetch_sessions()
    return {"count": len(sessions), "sessions": sessions}


@app.get("/sessions/{session_id}", tags=["Replay"])
async def get_session(session_id: str):
    """Returns the full rrweb event stream for one session."""
    from database import fetch_session_by_id
    session = fetch_session_by_id(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    return session


# ────────────────────────────────────────────
#  PAGES  (list of all tracked pages)
# ────────────────────────────────────────────

@app.get("/pages", tags=["Tracking"])
async def list_pages():
    """Returns all unique page keys that have recorded events."""
    from database import fetch_pages
    pages = fetch_pages()
    return {"pages": pages}


# ────────────────────────────────────────────
#  RUN
# ────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)