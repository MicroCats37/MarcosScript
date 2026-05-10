import asyncio
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Shim: allow `uvicorn main:app --reload` from inside backend/ folder.
# Inserts the project root (parent of backend/) into sys.path so that
# `from backend.database import ...` resolves correctly in both:
#   - from root:  uv run uvicorn backend.main:app --reload
#   - from backend: uvicorn main:app --reload
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Load .env file so environment variables are available
# .env is in the same directory as main.py (backend/)
from dotenv import load_dotenv
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup: run SQLite migrations (idempotent, safe for existing data)
    from backend.migrations import run_migrations
    run_migrations()
    
    # Then create any NEW tables (create_all doesn't alter existing tables)
    Base.metadata.create_all(bind=engine)
    
    # Setup WebSocket manager loop
    from backend.services.websocket_manager import manager
    manager.set_loop(asyncio.get_running_loop())
    
    # Resume active watchers
    from backend.services.watcher import resume_all_watchers
    resume_all_watchers()
    
    yield
    # Shutdown: cleanup if needed
    pass


app = FastAPI(
    title="MarcosScript API",
    description="API for managing photo events and processing frames",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Vite dev server ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from backend.routers import events, photos, watcher, cip, email

app.include_router(events.router)
app.include_router(photos.router)
app.include_router(watcher.router)
app.include_router(cip.router)
app.include_router(email.router)

# WebSocket endpoint
@app.websocket("/ws/events/{event_id}")
async def event_websocket_endpoint(websocket: WebSocket, event_id: int):
    print(f"📡 WS: Incoming connection request for event {event_id}")
    from backend.services.websocket_manager import manager
    try:
        await manager.connect(websocket, event_id)
        print(f"✅ WS: Connection established for event {event_id}")
        while True:
            # Keep connection alive by waiting for any data
            await websocket.receive_text()
    except Exception as e:
        print(f"❌ WS: Connection closed or error for event {event_id}: {e}")
    finally:
        manager.disconnect(websocket, event_id)


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {"status": "ok", "service": "MarcosScript API"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/media")
async def get_media(path: str):
    """Serve a local image file from an absolute path."""
    normalized_path = os.path.normpath(path)
    if not os.path.isfile(normalized_path):
        raise HTTPException(
            status_code=404, 
            detail=f"File not found at: {normalized_path}. Current working directory: {os.getcwd()}"
        )
    return FileResponse(normalized_path)
